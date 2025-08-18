/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_URL: string
  readonly VITE_PLAYER_API: string
  readonly VITE_TOURNAMENT_API: string
  readonly VITE_NOTIFICATION_HUB: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
