import { useEffect } from 'react'
import { buildHub } from '../api/notifications'
import { useToast } from './useToast'

export const useNotificationHub = (token?: string) => {
  const { push } = useToast()
  
  useEffect(() => {
    if (!token) return
    
    const hub = buildHub(token)
    hub.on('notify', (_topic, msg) => push(msg.text ?? '🔔 Notification'))
    hub.start()
    
    return () => {
      hub.stop()
    }
  }, [token, push])
}
