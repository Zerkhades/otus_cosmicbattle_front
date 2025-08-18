import { http } from './http';
const base = import.meta.env.VITE_GATEWAY_API;
export const startCasual = () =>
  http.post<{ battleId: string }>(`${base}/api/matchmaking/casual`).then(r => r.data);