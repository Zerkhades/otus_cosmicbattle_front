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

function drawStars(ctx: CanvasRenderingContext2D, stars: Array<{ x: number; y: number }>) {
  ctx.save();
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const s of stars) ctx.fillRect(s.x, s.y, 1, 1);
  ctx.restore();
}

function drawShip(ctx: CanvasRenderingContext2D, s: ShipSnap) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.a);
  ctx.beginPath();
  ctx.moveTo(SHIP_RADIUS + 6, 0);
  ctx.lineTo(-SHIP_RADIUS, -SHIP_RADIUS * 0.75);
  ctx.lineTo(-SHIP_RADIUS * 0.6, 0);
  ctx.lineTo(-SHIP_RADIUS, SHIP_RADIUS * 0.75);
  ctx.closePath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = s.me ? '#34d399' : '#e5e7eb';
  ctx.stroke();
  ctx.restore();
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
          for (const s of snap.ships) drawShip(ctx, s);
          // HUD
          const me = snap.ships.find(x => x.id === snap.you);
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
  };

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
