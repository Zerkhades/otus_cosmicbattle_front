import { http } from './http'

const base = import.meta.env.VITE_TOURNAMENT_API

export const fetchUpcoming = () => 
  http.get(`${base}/tournaments/upcoming`).then(r => r.data)

export const createTournament = (dto: any) => 
  http.post(`${base}/tournaments`, dto)

export const registerTournament = (id: string, playerId: string) => 
  http.post(`${base}/tournaments/${id}/register`, { playerId })
