---
description: Build and deploy changes to production server
---

# Deploy to Production

Execute full deployment to production server.

## CRITICAL: Client Build Argument

**ВАЖНО!** При сборке клиента ОБЯЗАТЕЛЬНО передавать `VITE_API_URL` через build-arg!

Без этого аргумента клиент будет использовать `localhost:3001` и API-запросы не будут работать.

```bash
# ПРАВИЛЬНО - для production:
docker build --build-arg VITE_API_URL=https://dashboard.vincora.ru/api -t neurodirectolog_client:latest ./client

# ПРАВИЛЬНО - для staging:
docker build --build-arg VITE_API_URL=https://test-dashboard.vincora.ru/api -t neurodirectolog_client-staging:latest ./client

# НЕПРАВИЛЬНО - БЕЗ build-arg (клиент будет ломаться!):
docker build -t neurodirectolog_client:latest ./client
```

### Как проверить что URL правильный:
```bash
docker exec neurodirectolog-client cat /usr/share/nginx/html/assets/index-*.js | grep -o 'VITE_API_URL\|dashboard.vincora\|localhost:3001' | head -5
# Должно показать: dashboard.vincora.ru (НЕ localhost!)
```

## Steps

1. **Build locally** (to catch errors early):
```bash
cd /Users/artemsubbotin/Desktop/Neurodirectolog
npm run build
```

2. **Commit changes** (if not committed):
```bash
git add -A
git commit -m "Deploy: [description]"
git push
```

3. **Deploy to server** (Production - dashboard.vincora.ru):
```bash
sshpass -p 'c9R+eLvxtQJ-,x' ssh -o StrictHostKeyChecking=no root@91.222.239.217 "cd /root/neurodirectolog && git pull && docker build --build-arg VITE_API_URL=https://dashboard.vincora.ru/api -t neurodirectolog_client:latest ./client && docker build -t neurodirectolog_server:latest ./server && docker stop neurodirectolog-client neurodirectolog-server 2>/dev/null; docker rm neurodirectolog-client neurodirectolog-server 2>/dev/null; docker run -d --name neurodirectolog-server --network neurodirectolog_neurodirectolog-network -p 3001:3001 --env-file /root/neurodirectolog/.env --restart unless-stopped neurodirectolog_server:latest && docker run -d --name neurodirectolog-client --network neurodirectolog_neurodirectolog-network -p 3000:80 --restart unless-stopped neurodirectolog_client:latest && docker ps | grep neurodirectolog"
```

4. **Verify deployment**:
```bash
# Проверить что контейнеры запущены
sshpass -p 'c9R+eLvxtQJ-,x' ssh -o StrictHostKeyChecking=no root@91.222.239.217 "docker ps | grep neurodirectolog"

# Проверить что клиент использует правильный API URL
sshpass -p 'c9R+eLvxtQJ-,x' ssh -o StrictHostKeyChecking=no root@91.222.239.217 "docker exec neurodirectolog-client grep -o 'dashboard.vincora.ru/api' /usr/share/nginx/html/assets/index-*.js | head -1"

# Проверить health endpoint сервера
curl -s https://dashboard.vincora.ru/health
```

## Staging Deployment (test-dashboard.vincora.ru)

```bash
sshpass -p 'c9R+eLvxtQJ-,x' ssh -o StrictHostKeyChecking=no root@91.222.239.217 "cd /root/neurodirectolog && git pull && docker build --build-arg VITE_API_URL=https://test-dashboard.vincora.ru/api -t neurodirectolog_client-staging:latest ./client && docker build -t neurodirectolog_server-staging:latest ./server && docker stop client-staging server-staging 2>/dev/null; docker rm client-staging server-staging 2>/dev/null; docker run -d --name server-staging --network neurodirectolog_neurodirectolog-network -p 3003:3001 --env-file /root/neurodirectolog/.env.staging --restart unless-stopped neurodirectolog_server-staging:latest && docker run -d --name client-staging --network neurodirectolog_neurodirectolog-network -p 3002:80 --restart unless-stopped neurodirectolog_client-staging:latest"
```

## Troubleshooting

### Preflight/CORS ошибки в браузере
Если в Network tab видите `(failed)` для preflight запросов:
1. Проверьте API URL в клиенте (см. выше)
2. Если показывает `localhost` - пересоберите клиент с `--build-arg VITE_API_URL=...`

### Логин не работает
```bash
# Проверить логи сервера
sshpass -p 'c9R+eLvxtQJ-,x' ssh -o StrictHostKeyChecking=no root@91.222.239.217 "docker logs neurodirectolog-server --tail 50"

# Проверить rate limiting (перезапустить если нужно)
sshpass -p 'c9R+eLvxtQJ-,x' ssh -o StrictHostKeyChecking=no root@91.222.239.217 "docker restart neurodirectolog-server"
```

### Проекты не показываются
```bash
# Проверить что проекты есть в ClickHouse
sshpass -p 'c9R+eLvxtQJ-,x' ssh -o StrictHostKeyChecking=no root@91.222.239.217 "docker exec clickhouse clickhouse-client --query \"SELECT id, name, user_id FROM neurodirectolog.projects FINAL\""
```

## Server Details
- Production URL: https://dashboard.vincora.ru
- Staging URL: https://test-dashboard.vincora.ru
- Server IP: 91.222.239.217
- Server port: 3001
- Client port: 3000
- Docker network: neurodirectolog_neurodirectolog-network

## Arguments
$ARGUMENTS - Optional description of what's being deployed
