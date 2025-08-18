import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { userManager } from '../auth/userManager'

export default function Callback() {
  const nav = useNavigate()
  
  useEffect(() => {
    userManager.signinRedirectCallback().then(() => nav('/'))
  }, [nav])
  
  return <p>Completing sign‑in…</p>
}
