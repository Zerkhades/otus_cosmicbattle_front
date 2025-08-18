import { http } from './http';
const base = import.meta.env.VITE_PLAYER_API;

export type Player = { id: string; userName: string; rating: number };

export const getMe = () =>
  http.get<Player>(`${base}/players/me`).then(r => r.data);