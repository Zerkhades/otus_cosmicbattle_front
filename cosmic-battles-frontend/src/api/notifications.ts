// api/notifications.ts
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'

export function buildHub(token: string) {
  // пробуем новое имя, потом старое, потом относительный путь
  const url =
    import.meta.env.VITE_NOTIFICATION_HUB ??
    import.meta.env.VITE_NOTIFICATION_WS ??
    `${location.origin}/ws/notifications`

  if (!url) {
    // более явная ошибка, чем "The 'url' argument is required"
    throw new Error('SignalR hub URL is not set. Define VITE_NOTIFICATION_HUB in your .env')
  }

  return new HubConnectionBuilder()
    .withUrl(url, {
      accessTokenFactory: () => token
    })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Information)
    .build()
}