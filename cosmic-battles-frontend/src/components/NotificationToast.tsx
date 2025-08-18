import { useAuth } from '../auth/AuthProvider'
import { useNotificationHub } from '../hooks/useSignalR'

export default function NotificationToast() {
  const { user } = useAuth()
  
  // Подключаемся к SignalR хабу для получения уведомлений
  useNotificationHub(user?.access_token)
  
  return null // Этот компонент не рендерит UI, только подключается к уведомлениям
}
