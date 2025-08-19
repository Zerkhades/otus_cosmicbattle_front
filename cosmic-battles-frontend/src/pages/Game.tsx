import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

// ---------- Протокол сообщений ----------
type CmdTurn = { type: 'TURN'; value: -1 | 0 | 1 };         // -1=left, 1=right, 0=stop
type CmdMove = { type: 'MOVE'; thrust: boolean; brake: boolean };
type CmdShoot = { type: 'SHOOT' };                          // разовое событие

type ClientEnvelope = {
  kind: 'cmd';
  battleId: string;
  tick: number;
  commands: Array<CmdTurn | CmdMove | CmdShoot>;
};

type ShipSnap = {
  id: string;
  x: number; y: number;
  a: number;                 // radians
  vx: number; vy: number;
  hp?: number;
  me?: boolean;              // пометка моего корабля
};

type BulletSnap = { x: number; y: number };
type ServerEnvelope =
  | { kind: 'snapshot'; tick: number; you: string; ships: ShipSnap[]; bullets: BulletSnap[] }
  | { kind: 'ack'; tick: number };

// ---------- Канвас/отрисовка ----------
const WORLD = { w: 1200, h: 800 };
const getDPR = () => (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
const SHIP_RADIUS = 18;
// Локальный кулдаун для звука выстрела (мс); можно переопределить через VITE_WEAPON_COOLDOWN_MS
const WEAPON_COOLDOWN_MS = Number(import.meta.env?.VITE_WEAPON_COOLDOWN_MS ?? 3000);

// простейший хэш для анимационных фаз (стабильное колыхание на корабль)
function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) / 1e9; // малое число в качестве сдвига фазы
}

function drawStars(ctx: CanvasRenderingContext2D, stars: Array<{ x: number; y: number }>) {
  ctx.save();
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const s of stars) ctx.fillRect(s.x, s.y, 1, 1);
  ctx.restore();
}

function drawShip(ctx: CanvasRenderingContext2D, s: ShipSnap, isMe: boolean = !!s.me) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.a);

  // Корпус + крылья — более «корабельная» форма
  const nose = SHIP_RADIUS + 8; // нос
  const wing = SHIP_RADIUS * 0.95; // вылет крыла по Y
  const tail = -SHIP_RADIUS * 1.4; // хвостовая точка по X

  // Градиент металла по корпусу
  const grad = ctx.createLinearGradient(tail, 0, nose, 0);
  grad.addColorStop(0, '#1f2937'); // slate-800
  grad.addColorStop(0.5, '#334155'); // slate-700
  grad.addColorStop(1, '#0f172a'); // slate-900

  ctx.beginPath();
  // верхняя линия корпуса: от носа к верхней кромке крыла
  ctx.moveTo(nose, 0);
  ctx.lineTo(0, -wing);
  // верхнее крыло
  ctx.lineTo(-SHIP_RADIUS * 1.2, -wing * 0.55);
  // хвостовая выемка
  ctx.lineTo(tail, 0);
  // нижнее крыло (симметрия)
  ctx.lineTo(-SHIP_RADIUS * 1.2, wing * 0.55);
  // нижняя линия корпуса к носу
  ctx.lineTo(0, wing);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = isMe ? '#34d399' : 'rgba(229,231,235,0.9)';
  ctx.stroke();

  // Кабина — овальная «шишка» ближе к носу
  ctx.beginPath();
  ctx.ellipse(SHIP_RADIUS * 0.2, 0, 7, 9, 0, 0, Math.PI * 2);
  const glass = ctx.createRadialGradient(SHIP_RADIUS * 0.25, -2, 1, SHIP_RADIUS * 0.2, 0, 10);
  glass.addColorStop(0, 'rgba(147,197,253,0.95)'); // sky-300
  glass.addColorStop(1, 'rgba(59,130,246,0.3)');   // blue-500
  ctx.fillStyle = glass;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(148,163,184,0.7)';
  ctx.stroke();

  // Пламя двигателя — динамическая длина для своего корабля при нажатой тяге
  const thrusting = isMe && (isDown('KeyW') || isDown('ArrowUp'));
  // колыхание пламени при ускорении — более заметная амплитуда + фазовый сдвиг по id
  const t = typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000;
  const phase = s.id ? hashStr(s.id) * Math.PI * 2 : 0;
  const wobbleBase = Math.sin(t * 20 + phase) * 0.35 + Math.sin(t * 33 + phase * 1.7) * 0.15;
  const wobbleLen = thrusting ? Math.max(0.75, Math.min(1.45, 1 + wobbleBase)) : 1;
  const wobbleWidth = thrusting ? Math.max(0.85, Math.min(1.25, 1 + wobbleBase * 0.6)) : 1;
  const flameLen = (thrusting ? 18 : 10) * wobbleLen;
  const flameWidth = (thrusting ? 6 : 4) * wobbleWidth;

  // мягкое свечение у сопел
  const glow = ctx.createRadialGradient(tail - 2, 0, 0, tail - 2, 0, flameLen + 8);
  glow.addColorStop(0, 'rgba(251,191,36,0.35)');   // amber-400
  glow.addColorStop(1, 'rgba(251,191,36,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(tail - 2, 0, flameLen + 6, 0, Math.PI * 2);
  ctx.fill();

  // собственно «пламя» — вытянутый треугольник
  const flameGrad = ctx.createLinearGradient(tail, 0, tail - flameLen, 0);
  flameGrad.addColorStop(0, 'rgba(253,186,116,0.95)'); // orange-300
  flameGrad.addColorStop(1, 'rgba(244,63,94,0.1)');    // rose-500
  ctx.beginPath();
  ctx.moveTo(tail, 0);
  ctx.lineTo(tail - flameLen, -flameWidth);
  ctx.lineTo(tail - flameLen, flameWidth);
  ctx.closePath();
  ctx.fillStyle = flameGrad;
  ctx.fill();

  // Доп. панельные линии (легкие штрихи)
  ctx.strokeStyle = 'rgba(100,116,139,0.4)'; // slate-500
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(SHIP_RADIUS * 0.6, -wing * 0.5);
  ctx.lineTo(-SHIP_RADIUS * 0.8, -wing * 0.25);
  ctx.moveTo(SHIP_RADIUS * 0.6, wing * 0.5);
  ctx.lineTo(-SHIP_RADIUS * 0.8, wing * 0.25);
  ctx.stroke();

  ctx.restore();
}

// Невращающаяся полоска HP над кораблём (в координатах экрана)
function drawShipHp(ctx: CanvasRenderingContext2D, s: ShipSnap) {
  if (typeof s.hp !== 'number' || !Number.isFinite(s.hp)) return;
  const hpVal = s.hp;
  const pct = hpVal <= 1 ? Math.max(0, Math.min(1, hpVal)) : Math.max(0, Math.min(1, hpVal / 100));
  const barW = 46;
  const barH = 6;
  const x = s.x - barW / 2;
  const y = s.y - SHIP_RADIUS - 18 - barH; // фиксированный зазор над кораблём
  // фон
  ctx.fillStyle = 'rgba(148,163,184,0.35)';
  ctx.fillRect(x, y, barW, barH);
  // цвет заполнения
  const hpColor = pct > 0.6 ? '#34d399' : pct > 0.3 ? '#f59e0b' : '#ef4444';
  ctx.fillStyle = hpColor;
  ctx.fillRect(x, y, barW * pct, barH);
  // рамка
  ctx.strokeStyle = 'rgba(148,163,184,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 0.5, y - 0.5, barW + 1, barH + 1);
  // число справа
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textBaseline = 'bottom';
  const label = hpVal <= 1 ? `${Math.round(pct * 100)}` : `${Math.round(hpVal)}`;
  ctx.fillText(label, x + barW + 4, y + barH);
}

function drawBullet(ctx: CanvasRenderingContext2D, b: BulletSnap) {
  ctx.beginPath();
  ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#93c5fd';
  ctx.fill();
}

// ---------- Клавиши/инпут ----------
const keys = new Set<string>();
const isDown = (code: string) => keys.has(code);

// ---------- Вспомогательное ----------
const toArray = (v: any) =>
  Array.isArray(v) ? v
    : v && typeof v === 'object' ? Object.values(v)
      : [];

const deg2rad = (d: any) => Number(d) * Math.PI / 180;

function normalizeEnvelope(raw: any, mySub?: string): ServerEnvelope | null {
  // иногда приходит { kind:'snapshot', ... }, иногда просто {tick,state:{...}}, иногда просто state
  const kind = (raw?.kind ?? raw?.Kind ?? '').toString().toLowerCase();

  if (kind === 'snapshot') {
    const you = raw.you ?? raw.You ?? mySub ?? '';
    const shipsRaw = toArray(raw.ships ?? raw.Ships ?? []);
    const bulletsRaw = toArray(raw.bullets ?? raw.Bullets ?? []);

    const ships: ShipSnap[] = shipsRaw.map((s: any) => {
      const pos = s.position ?? s.Position ?? {};
      const vel = s.velocity ?? s.Velocity ?? {};
      const id = s.id ?? s.Id ?? s.playerId ?? s.PlayerId ?? s.ownerId ?? s.OwnerId ?? '';
      const x = Number(s.x ?? s.X ?? pos.x ?? pos.X ?? 0);
      const y = Number(s.y ?? s.Y ?? pos.y ?? pos.Y ?? 0);

      // угол: либо в радианах (a/Angle/AngleRad), либо в градусах (rotationDeg/HeadingDeg и т.п.)
      const a =
        s.a ?? s.A ?? s.angle ?? s.Angle ?? s.angleRad ?? s.AngleRad ??
          deg2rad(s.rotationDeg ?? s.RotationDeg ?? s.headingDeg ?? s.HeadingDeg ?? 0);

      const vx = Number(s.vx ?? s.Vx ?? vel.x ?? vel.X ?? 0);
      const vy = Number(s.vy ?? s.Vy ?? vel.y ?? vel.Y ?? 0);
      const hp = s.hp ?? s.Hp;
      return { id, x, y, a: Number(a), vx, vy, hp, me: id && you ? id === you : false };
    });

    const bullets: BulletSnap[] = bulletsRaw.map((b: any) => {
      const pos = b.position ?? b.Position ?? {};
      const x = Number(b.x ?? b.X ?? pos.x ?? pos.X ?? 0);
      const y = Number(b.y ?? b.Y ?? pos.y ?? pos.Y ?? 0);
      return { x, y };
    });

    return {
      kind: 'snapshot',
      tick: Number(raw.tick ?? raw.Tick ?? Date.now()),
      you,
      ships,
      bullets,
    };
  }

  // вариант { tick, state: {...} } или просто { ...state }
  const base = raw?.state ?? raw;
  if (base && typeof base === 'object') {
    const you = base.you ?? base.You ?? mySub ?? '';
    const shipsSrc = base.ships ?? base.Ships ?? base.players ?? base.Players ?? base.entities ?? base.Entities ?? [];
    const bulletsSrc = base.bullets ?? base.Bullets ?? base.projectiles ?? base.Projectiles ?? [];

    const shipsRaw = toArray(shipsSrc);
    const bulletsRaw = toArray(bulletsSrc);

    const ships: ShipSnap[] = shipsRaw.map((s: any) => {
      const pos = s.position ?? s.Position ?? {};
      const vel = s.velocity ?? s.Velocity ?? {};
      const id = s.id ?? s.Id ?? s.playerId ?? s.PlayerId ?? s.ownerId ?? s.OwnerId ?? '';
      const x = Number(s.x ?? s.X ?? pos.x ?? pos.X ?? 0);
      const y = Number(s.y ?? s.Y ?? pos.y ?? pos.Y ?? 0);
      const a =
        s.a ?? s.A ?? s.angle ?? s.Angle ?? s.angleRad ?? s.AngleRad ??
          deg2rad(s.rotationDeg ?? s.RotationDeg ?? s.headingDeg ?? s.HeadingDeg ?? 0);
      const vx = Number(s.vx ?? s.Vx ?? vel.x ?? vel.X ?? 0);
      const vy = Number(s.vy ?? s.Vy ?? vel.y ?? vel.Y ?? 0);
      const hp = s.hp ?? s.Hp;
      return { id, x, y, a: Number(a), vx, vy, hp, me: id && you ? id === you : false };
    });

    const bullets: BulletSnap[] = bulletsRaw.map((b: any) => {
      const pos = b.position ?? b.Position ?? {};
      const x = Number(b.x ?? b.X ?? pos.x ?? pos.X ?? 0);
      const y = Number(b.y ?? b.Y ?? pos.y ?? pos.Y ?? 0);
      return { x, y };
    });

    return {
      kind: 'snapshot',
      tick: Number(raw.tick ?? base.tick ?? Date.now()),
      you,
      ships,
      bullets,
    };
  }

  if (kind === 'ack') {
    return { kind: 'ack', tick: Number(raw.tick ?? raw.Tick ?? 0) };
  }

  return null;
}

// ---------- Компонент ----------
export default function Game() {
  const { user } = useAuth();

  const cvsRef = useRef<HTMLCanvasElement | null>(null);
  const [connected, setConnected] = useState(false);
  const [running, setRunning] = useState(true);
  const [battleId, setBattleId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // последнее состояние мира от сервера
  const snapshotRef = useRef<ServerEnvelope | null>(null);
  const [serverPackets, setServerPackets] = useState(0);

  // для edge-триггера выстрела
  const lastSpaceRef = useRef(false);
  const lastShotAtRef = useRef(0);

  // --- WebAudio для звуков ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const thrustNodeRef = useRef<{
    osc: OscillatorNode;
    gain: GainNode;
    filter: BiquadFilterNode;
    lfo: OscillatorNode;
    lfoGain: GainNode;
  } | null>(null);
  const thrustActiveRef = useRef(false);

  // фоновые звёзды
  const stars = useMemo(
    () => Array.from({ length: 180 }, () => ({ x: Math.random() * WORLD.w, y: Math.random() * WORLD.h })),
    []
  );

  // размер/DPR
  useEffect(() => {
    const c = cvsRef.current!;
    const dpr = getDPR();
    c.width = Math.floor(WORLD.w * dpr);
    c.height = Math.floor(WORLD.h * dpr);
    c.style.width = WORLD.w + 'px';
    c.style.height = WORLD.h + 'px';
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  // подписка на клавиатуру
  useEffect(() => {
    const down = (e: KeyboardEvent) => keys.add(e.code);
    const up = (e: KeyboardEvent) => keys.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // рендер-цикл: просто рисуем последний снапшот сервера
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const loop = () => {
      const ctx = cvsRef.current?.getContext('2d');
      if (ctx) {
        drawStars(ctx, stars);
        const snap = snapshotRef.current;
        if (snap && snap.kind === 'snapshot') {
          for (const b of snap.bullets) drawBullet(ctx, b);
          for (const s of snap.ships) {
            const isMe = s.id === snap.you || s.me === true;
            drawShip(ctx, s, isMe);
          }
          // поверх — HP каждого корабля (без вращения)
          for (const s of snap.ships) {
            drawShipHp(ctx, s);
          }
          // HUD
          // Выбираем «мой» корабль: по id === you, иначе по флагу me, иначе первый доступный
          const me =
            snap.ships.find(x => x.id === snap.you) ||
            snap.ships.find(x => x.me) ||
            snap.ships[0];
          ctx.fillStyle = '#e5e7eb';
          ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
          ctx.fillText(`Packets: ${serverPackets}`, 12, 18);
          if (me) {
            const speed = Math.hypot(me.vx, me.vy) | 0;
            ctx.fillText(`Speed: ${speed}`, 12, 34);
            ctx.fillText(`Angle: ${(me.a * 180 / Math.PI).toFixed(0)}°`, 12, 50);
          }
        } else {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
          ctx.fillText('Нет данных сервера. Подключитесь к матчу.', 12, 20);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, stars, serverPackets]);

  // отправка команд каждые 50мс
  useEffect(() => {
    if (!connected || !battleId) return;
    const iv = setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      // агрегируем команды
      const thrust = isDown('KeyW') || isDown('ArrowUp');
      const brake  = isDown('KeyS') || isDown('ArrowDown');
      const left   = isDown('KeyA') || isDown('ArrowLeft');
      const right  = isDown('KeyD') || isDown('ArrowRight');
      const space  = isDown('Space');

      const cmds: ClientEnvelope['commands'] = [];

      // TurnCommand
      const turnVal: -1 | 0 | 1 = left ? -1 : right ? 1 : 0;
      cmds.push({ type: 'TURN', value: turnVal });

      // MoveCommand
      cmds.push({ type: 'MOVE', thrust, brake });

      // ShootCommand — только по фронту клавиши (edge)
      if (space && !lastSpaceRef.current) {
        cmds.push({ type: 'SHOOT' });
        const now = Date.now();
        if (now - lastShotAtRef.current >= WEAPON_COOLDOWN_MS) {
          try { playShoot(); } catch {}
          lastShotAtRef.current = now;
        }
      }
      lastSpaceRef.current = space;

      const env: ClientEnvelope = {
        kind: 'cmd',
        battleId,
        tick: Date.now(),
        commands: cmds
      };
      const bytes = new TextEncoder().encode(JSON.stringify(env));
      ws.send(bytes);
    }, 50);
    return () => clearInterval(iv);
  }, [connected, battleId]);

  // контроль звука тяги по клавишам
  useEffect(() => {
    if (!running) { stopThrust(true); return; }
    let raf = 0;
    const loop = () => {
      const thrust = isDown('KeyW') || isDown('ArrowUp');
      if (thrust && !thrustActiveRef.current) {
        startThrust();
      } else if (!thrust && thrustActiveRef.current) {
        stopThrust();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); stopThrust(true); };
  }, [running]);

  // матчмейкинг + WS
  const connect = async () => {
    if (!user?.access_token) { alert('Сначала войдите'); return; }
    try {
      // 1) создать (или найти) матч
      const res = await fetch(`${import.meta.env.VITE_GATEWAY_API}/api/matchmaking/casual`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.access_token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Matchmaking failed: ${res.status}`);
      const data = await res.json() as { battleId: string };
      setBattleId(data.battleId);

      // 2) открыть WS
      const wsUrl = `${import.meta.env.VITE_GATEWAY_WS}/ws/game?battleId=${data.battleId}&access_token=${encodeURIComponent(user.access_token)}`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => setConnected(true);
      ws.onclose = () => setConnected(false);
      ws.onerror = () => setConnected(false);

      const handleIncomingText = (txt: string) => {
        const raw = JSON.parse(txt);
        const norm = normalizeEnvelope(raw, (user as any)?.profile?.sub);
        if (norm?.kind === 'snapshot') {
          // Отметим «me» на кораблях для подсветки
          norm.ships = norm.ships.map(s => ({ ...s, me: s.id === norm.you }));
          // звук попадания — если HP моего корабля уменьшился
          try {
            const prev = snapshotRef.current;
            if (prev && prev.kind === 'snapshot') {
              const prevMe = prev.ships.find(x => x.id === prev.you);
              const curMe = norm.ships.find(x => x.id === norm.you);
              const prevHp = typeof prevMe?.hp === 'number' ? prevMe!.hp : undefined;
              const curHp = typeof curMe?.hp === 'number' ? curMe!.hp : undefined;
              if (typeof prevHp === 'number' && typeof curHp === 'number' && curHp < prevHp) {
                try { playHit(); } catch {}
              }
            }
          } catch {}
          snapshotRef.current = norm;
          setServerPackets(n => n + 1);
        }
      };

      ws.onmessage = (ev) => {
        try {
          if (typeof ev.data === 'string') {
            handleIncomingText(ev.data);
            return;
          }
          if (ev.data instanceof ArrayBuffer) {
            const txt = new TextDecoder().decode(new Uint8Array(ev.data));
            handleIncomingText(txt);
            return;
          }
          // Blob fallback
          // @ts-ignore
          if (ev.data?.arrayBuffer) {
            // @ts-ignore
            (ev.data as Blob).arrayBuffer().then((buf: ArrayBuffer) => {
              const txt = new TextDecoder().decode(new Uint8Array(buf));
              handleIncomingText(txt);
            });
          }
        } catch (e) {
          console.error('WS parse/adapt error', e);
        }
      };

      wsRef.current = ws;
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Не удалось подключиться');
    }
  };

  const disconnect = () => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
    stopThrust(true);
  };

  // --- функции WebAudio ---
  function getAudioContext(): AudioContext {
    if (!audioCtxRef.current) {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    return audioCtxRef.current!;
  }

  function startThrust() {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    if (thrustNodeRef.current) return; // уже играет

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 70; // базовая частота двигателя

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.value = 0.0; // огибающая

    // цепь: osc -> filter -> gain -> out
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    // быстрая атака громкости
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0.0, now);
  // было 0.12 — стало тише примерно на 60%
  gain.gain.linearRampToValueAtTime(0.048, now + 0.06);

    // LFO для легкого «рычания» двигателя
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 12;
    lfoGain.gain.value = 4; // глубина модуляции (Гц)
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start();

    osc.start();
    thrustNodeRef.current = { osc, gain, filter, lfo, lfoGain };
    thrustActiveRef.current = true;
  }

  function stopThrust(immediate = false) {
    const ctx = audioCtxRef.current;
    const nodes = thrustNodeRef.current;
    if (!ctx || !nodes) return;
    const now = ctx.currentTime;
    if (immediate) {
      try { nodes.osc.stop(); } catch {}
      try { nodes.lfo.stop(); } catch {}
      try { nodes.gain.disconnect(); } catch {}
      try { nodes.filter.disconnect(); } catch {}
      try { nodes.lfoGain.disconnect(); } catch {}
      thrustNodeRef.current = null;
      thrustActiveRef.current = false;
      return;
    }
    nodes.gain.gain.cancelScheduledValues(now);
    nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, now);
    nodes.gain.gain.linearRampToValueAtTime(0, now + 0.12);
    setTimeout(() => {
      try { nodes.osc.stop(); } catch {}
      try { nodes.lfo.stop(); } catch {}
      try { nodes.gain.disconnect(); } catch {}
      try { nodes.filter.disconnect(); } catch {}
      try { nodes.lfoGain.disconnect(); } catch {}
    }, 140);
    thrustNodeRef.current = null;
    thrustActiveRef.current = false;
  }

  function playShoot() {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    osc.type = 'square';
    const gain = ctx.createGain();
    gain.gain.value = 0.0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 3.5;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.start();
    osc.stop(now + 0.14);
  }

  function playHit() {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    // шум через Biquad для «ударного» звука
    const bufSize = 0.15; // сек
    const rate = ctx.sampleRate;
    const frameCount = Math.floor(rate * bufSize);
    const buffer = ctx.createBuffer(1, frameCount, rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      // затухающий белый шум
      const t = i / frameCount;
      data[i] = (Math.random() * 2 - 1) * (1 - t);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.value = 0.0;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    src.start();
    src.stop(now + 0.2);
  }

  return (
    <div className="p-4 flex flex-col items-center gap-3">
      <div className="w-full max-w-5xl flex flex-wrap items-center gap-2">
        {!connected ? (
          <button className="px-3 py-1 border rounded" onClick={connect} disabled={!user}>
            Подключиться к матчу
          </button>
        ) : (
          <button className="px-3 py-1 border rounded" onClick={disconnect}>
            Отключиться
          </button>
        )}
        <button className="px-3 py-1 border rounded" onClick={() => setRunning(r => !r)}>
          {running ? '⏸ Пауза' : '▶️ Продолжить'}
        </button>

        <div className="text-sm text-gray-500 ml-auto">
          {connected ? <span className="text-green-400">● Online</span> : <span className="text-gray-400">● Offline</span>}
          {battleId && <span className="ml-2">Battle: <span className="font-mono">{battleId}</span></span>}
          <span className="ml-4">Packets: {serverPackets}</span>
        </div>
      </div>

      <div className="text-sm text-gray-500 -mt-1">
        Управление: <kbd>W/S</kbd> — тяга/тормоз, <kbd>A/D</kbd> — поворот, <kbd>Space</kbd> — огонь
      </div>

      <canvas ref={cvsRef} className="rounded-lg shadow-lg border border-slate-700 bg-black" width={WORLD.w} height={WORLD.h} />
    </div>
  );
}
