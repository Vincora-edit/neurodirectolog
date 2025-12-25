# Neurodirectolog

Аналитическая платформа для Яндекс.Директ с интеграцией Яндекс.Метрики и AI-рекомендациями.

## Возможности

- **Подключение Яндекс.Директ** — OAuth авторизация, поддержка нескольких аккаунтов
- **Детальная аналитика** — статистика по кампаниям, группам, объявлениям
- **Цели конверсий** — фильтрация по целям из Яндекс.Метрики
- **KPI трекинг** — установка целей и отслеживание выполнения
- **AI-рекомендации** — автоматический анализ и советы по оптимизации
- **Гибкие отчёты** — устройства, гео, поисковые запросы, демография

## Технологии

| Компонент | Технологии |
|-----------|------------|
| **Frontend** | React, TypeScript, Vite, TailwindCSS, Recharts |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | ClickHouse |
| **Deploy** | Docker, Docker Compose |

## Быстрый старт

### 1. Клонирование и установка

```bash
git clone <repository-url>
cd Neurodirectolog
npm install
```

### 2. Настройка окружения

Скопируйте `.env.example` в корень, `server/.env` и `client/.env`:

```bash
cp .env.example server/.env
```

Отредактируйте `server/.env`:

```env
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secret-key

# ClickHouse
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=your_password
CLICKHOUSE_DB=neurodirectolog

# OpenAI (для AI-рекомендаций)
OPENAI_API_KEY=your_openai_key

# CORS
CORS_ORIGIN=http://localhost:5173
```

Создайте `client/.env`:

```env
VITE_API_URL=http://localhost:3001/api
```

### 3. Запуск ClickHouse

```bash
docker-compose up -d
```

### 4. Запуск приложения

```bash
# Одновременно backend и frontend
npm run dev

# Или раздельно
npm run dev:server  # Backend на :3001
npm run dev:client  # Frontend на :5173
```

### 5. Открыть в браузере

- Frontend: http://localhost:5173
- API: http://localhost:3001

## Структура проекта

```
Neurodirectolog/
├── client/                 # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/     # UI компоненты
│   │   │   ├── ui/         # Базовые компоненты (Button, Card, Modal...)
│   │   │   └── dashboard/  # Компоненты дашборда
│   │   ├── pages/          # Страницы приложения
│   │   ├── services/       # API сервисы
│   │   ├── store/          # Zustand stores
│   │   ├── types/          # TypeScript типы
│   │   ├── utils/          # Утилиты и хелперы
│   │   └── constants/      # Константы
│   └── ...
│
├── server/                 # Backend (Express)
│   ├── src/
│   │   ├── routes/         # API роуты
│   │   ├── services/       # Бизнес-логика
│   │   ├── middleware/     # Middleware
│   │   └── jobs/           # Cron задачи
│   └── ...
│
├── docs/                   # Документация
│   ├── yandex-dashboard.md # Гайд по дашборду
│   ├── goals-selector.md   # Работа с целями
│   └── migration-guide.md  # Миграция данных
│
├── clickhouse/             # ClickHouse конфигурация
├── docker-compose.yml      # Docker конфигурация
└── .env.example            # Пример переменных окружения
```

## Документация

- [Яндекс Дашборд](docs/yandex-dashboard.md) — подключение и использование
- [Цели конверсий](docs/goals-selector.md) — настройка целей
- [Миграция](docs/migration-guide.md) — обновление структуры данных
- [Yandex API](docs/yandex-api.md) — работа с API Яндекса

## Production деплой

### Docker Compose

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Ручной деплой

1. Сборка frontend:
```bash
cd client && npm run build
```

2. Сборка backend:
```bash
cd server && npm run build
```

3. Запуск:
```bash
cd server && npm start
```

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Запуск dev-сервера (backend + frontend) |
| `npm run dev:server` | Только backend |
| `npm run dev:client` | Только frontend |
| `npm run build` | Сборка проекта |
| `npm run lint` | Проверка кода |

## Лицензия

MIT
