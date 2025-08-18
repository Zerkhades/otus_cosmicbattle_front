import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

export const userManager = new UserManager({
  authority:  import.meta.env.VITE_AUTH_URL,             // http://localhost:8080/auth
  client_id:  'cosmic-web',
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: window.location.origin,
  scope: 'openid profile player-api tournament-api battle-api notification-api',
  response_type: 'code',

  // КЛЮЧЕВОЕ: сохраняем юзера между перезагрузками
  userStore: new WebStorageStateStore({ store: window.localStorage }),

  // в dev без HTTPS silent-iframe не взлетит → отключаем
  automaticSilentRenew: false,
  monitorSession: false
});