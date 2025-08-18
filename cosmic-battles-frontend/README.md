# Cosmic Battles Frontend

React-приложение для платформы космических битв с аутентификацией через IdentityServer4, управлением турнирами и real-time уведомлениями.

## Технологии

- **React 18** с TypeScript
- **Vite** - сборщик и dev-сервер
- **TailwindCSS** - стили
- **React Router** - маршрутизация
- **TanStack Query** - кеширование и управление состоянием API
- **OIDC Client** - аутентификация через IdentityServer4
- **SignalR** - real-time уведомления
- **Sonner** - toast уведомления
- **Axios** - HTTP клиент

## Быстрый старт

```bash
# Установка зависимостей
npm install

# Запуск dev сервера
npm run dev

# Сборка для продакшена
npm run build

# Предварительный просмотр билда
npm run preview
```

## Структура проекта

```
src/
├── auth/           # OIDC аутентификация
├── api/            # HTTP клиенты для API
├── hooks/          # React хуки
├── components/     # React компоненты
├── pages/          # Страницы приложения
├── main.tsx        # Точка входа
├── router.tsx      # Конфигурация маршрутов
└── App.tsx         # Корневой компонент
```

## Окружение

Скопируйте `.env.development` в `.env.production` и настройте URL для продакшена:

```env
VITE_AUTH_URL=http://localhost:7000
VITE_PLAYER_API=http://localhost:5001
VITE_TOURNAMENT_API=http://localhost:5002
VITE_NOTIFICATION_WS=ws://localhost:5004/ws/notifications
```

## Функциональность

- ✅ Аутентификация через IdentityServer4
- ✅ Просмотр и создание турниров
- ✅ Регистрация в турнирах
- ✅ Real-time уведомления через SignalR
- ✅ Адаптивный дизайн с TailwindCSS
- 🚧 Просмотр битв в реальном времени
- 🚧 Детальная информация о турнирах

## Разработка

Приложение подключается к микросервисной архитектуре:

- **Auth Service** (IdentityServer4) - аутентификация
- **Player API** - управление игроками
- **Tournament API** - управление турнирами  
- **Notification Service** - real-time уведомления

После успешной аутентификации JWT токен автоматически добавляется ко всем API запросам.
