import axios from 'axios'
import { userManager } from '../auth/userManager'

export const http = axios.create()

http.interceptors.request.use(async cfg => {
  const user = await userManager.getUser()
  if (user?.access_token) {
    cfg.headers.Authorization = `Bearer ${user.access_token}`
  }
  return cfg
})
