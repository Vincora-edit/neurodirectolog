# Схема разработки и деплоя Neurodirectolog

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRODUCTION                                │
│                   91.222.239.217                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   nginx     │  │   client    │  │        server           │  │
│  │  (host)     │──│  :8080      │  │        :3001            │  │
│  │  :80/:443   │  │  (docker)   │  │        (docker)         │  │
│  └─────────────┘  └─────────────┘  └───────────┬─────────────┘  │
│                                                 │                │
│                                    ┌────────────┴────────────┐  │
│                                    │      ClickHouse         │  │
│                                    │      :8124 (ext)        │  │
│                                    │      :8123 (int)        │  │
│                                    └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         LOCAL                                    │
│                   localhost                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Vite      │  │   client    │  │        server           │  │
│  │   :5173     │  │   dev       │  │        :3001            │  │
│  └─────────────┘  └─────────────┘  └───────────┬─────────────┘  │
│                                                 │                │
│                                    ┌────────────┴────────────┐  │
│                                    │      ClickHouse         │  │
│                                    │      :8123              │  │
│                                    └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Хранение данных

| Данные | Хранилище | Путь на production |
|--------|-----------|-------------------|
| Пользователи | JSON | `/var/lib/docker/volumes/neurodirectolog_server_data/_data/users.json` |
| Проекты | JSON | `/var/lib/docker/volumes/neurodirectolog_server_data/_data/projects.json` |
| Yandex Connections | ClickHouse | `neurodirectolog.yandex_direct_connections` |
| Статистика кампаний | ClickHouse | `neurodirectolog.campaign_stats` и др. |

## Процесс разработки

### 1. Локальная разработка

```bash
# Запуск dev-сервера
npm run dev

# Проверка TypeScript
cd client && npx tsc --noEmit

# Проверка сборки
npm run build
```

### 2. Перед коммитом (ОБЯЗАТЕЛЬНО!)

```bash
# 1. Проверить TypeScript ошибки
cd client && npx tsc --noEmit

# 2. Проверить сборку
npm run build

# 3. Посмотреть что изменилось
git diff

# 4. Только после успешных проверок - коммит
git add .
git commit -m "описание изменений"
```

### 3. Деплой на production

```bash
# Вариант 1: Скрипт деплоя (рекомендуется)
./scripts/deploy.sh

# Вариант 2: Ручной деплой
git push origin main

# SSH на сервер
ssh root@91.222.239.217

# На сервере:
cd /root/neurodirectolog
git pull

# Пересборка нужного сервиса
docker-compose -f docker-compose.prod.yml build client
docker-compose -f docker-compose.prod.yml up -d client

# или для server:
docker-compose -f docker-compose.prod.yml build server
docker-compose -f docker-compose.prod.yml up -d server
```

## Правила работы

### Золотые правила

1. **Никогда не пушить без проверки TypeScript**
2. **Никогда не деплоить без проверки сборки**
3. **Всегда проверять production после деплоя**
4. **Бэкап данных перед критическими изменениями**

### Что может сломаться

| Проблема | Причина | Решение |
|----------|---------|---------|
| Проекты пропали | projectId в connections не совпадает с projects.json | Добавить проекты в JSON или обновить connections |
| Connections пустые | Таблица ClickHouse не создана | Выполнить миграции |
| Client не обновился | Docker использует кэш | `docker build --no-cache` |
| API ошибки | Server контейнер упал | `docker logs neurodirectolog-server` |

### Бэкап данных

```bash
# Бэкап projects.json
ssh root@91.222.239.217 "cp /var/lib/docker/volumes/neurodirectolog_server_data/_data/projects.json /root/backups/projects_$(date +%Y%m%d_%H%M%S).json"

# Бэкап users.json
ssh root@91.222.239.217 "cp /var/lib/docker/volumes/neurodirectolog_server_data/_data/users.json /root/backups/users_$(date +%Y%m%d_%H%M%S).json"

# Бэкап ClickHouse (connections)
ssh root@91.222.239.217 "docker exec neurodirectolog-clickhouse clickhouse-client --query 'SELECT * FROM neurodirectolog.yandex_direct_connections FORMAT JSONEachRow' > /root/backups/connections_$(date +%Y%m%d_%H%M%S).json"
```

## Полезные команды

### Диагностика на production

```bash
# Статус контейнеров
docker ps

# Логи сервера
docker logs neurodirectolog-server --tail 100

# Логи клиента
docker logs neurodirectolog-client --tail 100

# Проверка API
curl http://localhost:3001/api/health

# Проверка ClickHouse
docker exec neurodirectolog-clickhouse clickhouse-client --query "SHOW TABLES FROM neurodirectolog"
```

### Быстрое исправление

```bash
# Перезапуск всех сервисов
cd /root/neurodirectolog && docker-compose -f docker-compose.prod.yml restart

# Пересборка и перезапуск клиента
docker-compose -f docker-compose.prod.yml build client && docker-compose -f docker-compose.prod.yml up -d client

# Пересборка и перезапуск сервера
docker-compose -f docker-compose.prod.yml build server && docker-compose -f docker-compose.prod.yml up -d server
```

## Чеклист деплоя

- [ ] TypeScript проверен (`npx tsc --noEmit`)
- [ ] Сборка успешна (`npm run build`)
- [ ] Изменения закоммичены
- [ ] Push в main выполнен
- [ ] Pull на сервере выполнен
- [ ] Docker образы пересобраны
- [ ] Контейнеры перезапущены
- [ ] Production проверен в браузере
- [ ] API работает
