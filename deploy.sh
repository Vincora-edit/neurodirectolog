#!/bin/bash

# ===========================================
# Neurodirectolog Deploy Script
# ===========================================
# Автоматический деплой на сервер 91.222.239.217
# Использование: ./deploy.sh [client|server|rebuild|all]
# ===========================================

set -e  # Остановка при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Конфигурация сервера
SERVER_HOST="91.222.239.217"
SERVER_USER="root"
SERVER_PATH="/root/neurodirectolog"

# Проверка наличия sshpass
check_sshpass() {
    if ! command -v sshpass &> /dev/null; then
        echo -e "${RED}Ошибка: sshpass не установлен${NC}"
        echo "Установите: brew install hudochenkov/sshpass/sshpass"
        exit 1
    fi
}

# Чтение пароля
read_password() {
    if [ -z "$DEPLOY_PASSWORD" ]; then
        echo -n "SSH пароль для $SERVER_USER@$SERVER_HOST: "
        read -s DEPLOY_PASSWORD
        echo
    fi
}

# SSH команда с паролем
ssh_cmd() {
    sshpass -p "$DEPLOY_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_HOST" "$1"
}

# SCP команда с паролем
scp_cmd() {
    sshpass -p "$DEPLOY_PASSWORD" scp -o StrictHostKeyChecking=no -r "$1" "$SERVER_USER@$SERVER_HOST:$2"
}

# Сборка клиента
build_client() {
    echo -e "${BLUE}📦 Сборка клиента...${NC}"
    cd client
    npm run build
    cd ..
    echo -e "${GREEN}✅ Клиент собран${NC}"
}

# Сборка сервера
build_server() {
    echo -e "${BLUE}📦 Сборка сервера...${NC}"
    cd server
    npm run build
    cd ..
    echo -e "${GREEN}✅ Сервер собран${NC}"
}

# Деплой клиента
deploy_client() {
    echo -e "${BLUE}🚀 Деплой клиента...${NC}"

    # Копируем файлы во временную директорию на сервере
    ssh_cmd "rm -rf /tmp/client-dist 2>/dev/null || true"
    scp_cmd "client/dist" "/tmp/client-dist"

    # Заменяем файлы в volume (контейнер примонтирован как ro)
    ssh_cmd "rm -rf $SERVER_PATH/client/dist/* && cp -r /tmp/client-dist/* $SERVER_PATH/client/dist/ && rm -rf /tmp/client-dist"

    # Перезагружаем nginx в контейнере
    ssh_cmd "docker exec neurodirectolog-client nginx -s reload 2>/dev/null || true"

    echo -e "${GREEN}✅ Клиент задеплоен${NC}"
}

# Деплой сервера (быстрый - только копируем dist)
deploy_server() {
    echo -e "${BLUE}🚀 Деплой сервера (быстрый режим)...${NC}"

    # Копируем только собранный dist
    ssh_cmd "mkdir -p /tmp/server-update && rm -rf /tmp/server-update/*"
    scp_cmd "server/dist" "/tmp/server-update/"

    # Обновляем код в контейнере и рестартим
    ssh_cmd "docker cp /tmp/server-update/dist/. neurodirectolog-server:/app/dist/ && \
        docker restart neurodirectolog-server && \
        rm -rf /tmp/server-update"

    # Ждем пока сервер запустится
    echo -e "${BLUE}⏳ Ожидание запуска сервера...${NC}"
    sleep 3

    # Проверяем статус
    ssh_cmd "docker ps --filter 'name=neurodirectolog-server' --format '{{.Status}}'"

    echo -e "${GREEN}✅ Сервер задеплоен${NC}"
}

# Полная пересборка Docker образа сервера
rebuild_server() {
    echo -e "${YELLOW}🔨 Пересборка Docker образа сервера...${NC}"

    # Копируем весь сервер для сборки
    ssh_cmd "mkdir -p /tmp/server-rebuild && rm -rf /tmp/server-rebuild/*"
    scp_cmd "server" "/tmp/server-rebuild/"

    # Собираем новый образ
    echo -e "${BLUE}🏗️  Сборка Docker образа (это может занять несколько минут)...${NC}"
    ssh_cmd "cd /tmp/server-rebuild/server && docker build -t neurodirectolog_server:latest . 2>&1 | tail -5"

    # Останавливаем и удаляем старый контейнер
    ssh_cmd "docker stop neurodirectolog-server 2>/dev/null || true"
    ssh_cmd "docker rm neurodirectolog-server 2>/dev/null || true"

    # Запускаем новый контейнер
    ssh_cmd "docker run -d \
        --name neurodirectolog-server \
        --network neurodirectolog_neurodirectolog-network \
        -p 3001:3001 \
        -v $SERVER_PATH/server/data:/app/data \
        -e NODE_ENV=production \
        -e CORS_ORIGIN=http://$SERVER_HOST:8080 \
        -e PRODUCTION_URL=http://$SERVER_HOST:8080 \
        -e JWT_SECRET=super-secret-jwt-key-change-in-production \
        -e CLICKHOUSE_HOST=http://clickhouse:8123 \
        -e CLICKHOUSE_DB=neurodirectolog \
        -e CLICKHOUSE_USER=default \
        -e CLICKHOUSE_PASSWORD= \
        -e YANDEX_CLIENT_ID=f34eef7db7da4f4191b14766ef74fbc0 \
        -e YANDEX_REDIRECT_URI=http://$SERVER_HOST:8080/yandex/callback \
        --restart unless-stopped \
        neurodirectolog_server:latest"

    # Очистка
    ssh_cmd "rm -rf /tmp/server-rebuild"

    echo -e "${GREEN}✅ Docker образ пересобран и запущен${NC}"
}

# Полный деплой
deploy_all() {
    echo -e "${YELLOW}🔄 Полный деплой Neurodirectolog${NC}"
    echo "=================================="

    build_client
    build_server
    deploy_client
    deploy_server

    echo ""
    echo -e "${GREEN}🎉 Деплой завершен успешно!${NC}"
    echo "=================================="
    status
}

# Статус контейнеров
status() {
    echo -e "${BLUE}📊 Статус контейнеров:${NC}"
    ssh_cmd "docker ps --filter 'name=neurodirectolog' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
}

# Логи
logs() {
    local container="${1:-server}"
    echo -e "${BLUE}📜 Логи neurodirectolog-$container:${NC}"
    ssh_cmd "docker logs neurodirectolog-$container --tail 50"
}

# Рестарт
restart() {
    local container="${1:-all}"
    if [ "$container" == "all" ]; then
        echo -e "${YELLOW}🔄 Рестарт всех контейнеров...${NC}"
        ssh_cmd "docker restart neurodirectolog-server neurodirectolog-client neurodirectolog-clickhouse"
    else
        echo -e "${YELLOW}🔄 Рестарт neurodirectolog-$container...${NC}"
        ssh_cmd "docker restart neurodirectolog-$container"
    fi
    echo -e "${GREEN}✅ Готово${NC}"
}

# Health check
health() {
    echo -e "${BLUE}🏥 Проверка здоровья сервисов:${NC}"
    echo ""

    # Сервер
    echo -n "Server API: "
    if ssh_cmd "curl -s http://localhost:3001/health | grep -q 'ok'" 2>/dev/null; then
        echo -e "${GREEN}✅ OK${NC}"
    else
        echo -e "${RED}❌ FAIL${NC}"
    fi

    # ClickHouse
    echo -n "ClickHouse: "
    if ssh_cmd "curl -s http://localhost:8124/ping | grep -q 'Ok'" 2>/dev/null; then
        echo -e "${GREEN}✅ OK${NC}"
    else
        echo -e "${RED}❌ FAIL${NC}"
    fi

    # Client
    echo -n "Client:     "
    if ssh_cmd "curl -s http://localhost:8080/ | grep -q 'html'" 2>/dev/null; then
        echo -e "${GREEN}✅ OK${NC}"
    else
        echo -e "${RED}❌ FAIL${NC}"
    fi
}

# Настройка домена с SSL
setup_domain() {
    local domain="${1:-dashboard.vincora.ru}"

    echo -e "${YELLOW}🌐 Настройка домена: $domain${NC}"
    echo "=================================="

    # Копируем скрипт на сервер
    scp_cmd "setup-domain.sh" "$SERVER_PATH/"

    # Запускаем скрипт на сервере
    ssh_cmd "chmod +x $SERVER_PATH/setup-domain.sh && $SERVER_PATH/setup-domain.sh $domain"

    echo ""
    echo -e "${GREEN}✅ Домен настроен!${NC}"
    echo ""
    echo -e "${YELLOW}Теперь обновите:${NC}"
    echo "1. client/.env.production - VITE_API_URL=https://$domain/api"
    echo "2. Перезапустите контейнер сервера с новыми ENV:"
    echo "   - CORS_ORIGIN=https://$domain"
    echo "   - YANDEX_REDIRECT_URI=https://$domain/yandex/callback"
    echo "3. Обновите OAuth приложение в Яндексе"
    echo "4. Запустите: ./deploy.sh all"
}

# Обновить конфигурацию сервера для домена
update_server_env() {
    local domain="${1:-dashboard.vincora.ru}"

    echo -e "${YELLOW}⚙️  Обновление конфигурации сервера для домена: $domain${NC}"

    # Останавливаем и удаляем старый контейнер
    ssh_cmd "docker stop neurodirectolog-server 2>/dev/null || true"
    ssh_cmd "docker rm neurodirectolog-server 2>/dev/null || true"

    # Запускаем новый контейнер с обновленными переменными
    ssh_cmd "docker run -d \
        --name neurodirectolog-server \
        --network neurodirectolog_neurodirectolog-network \
        -p 3001:3001 \
        -v $SERVER_PATH/server/data:/app/data \
        -e NODE_ENV=production \
        -e CORS_ORIGIN=https://$domain \
        -e PRODUCTION_URL=https://$domain \
        -e JWT_SECRET=super-secret-jwt-key-change-in-production \
        -e CLICKHOUSE_HOST=http://clickhouse:8123 \
        -e CLICKHOUSE_DB=neurodirectolog \
        -e CLICKHOUSE_USER=default \
        -e CLICKHOUSE_PASSWORD= \
        -e YANDEX_CLIENT_ID=f34eef7db7da4f4191b14766ef74fbc0 \
        -e YANDEX_REDIRECT_URI=https://$domain/yandex/callback \
        --restart unless-stopped \
        neurodirectolog_server:latest"

    echo -e "${GREEN}✅ Сервер перезапущен с новой конфигурацией${NC}"
}

# Главная функция
main() {
    check_sshpass
    read_password

    case "${1:-help}" in
        client)
            build_client
            deploy_client
            ;;
        server)
            build_server
            deploy_server
            ;;
        rebuild)
            rebuild_server
            ;;
        all)
            deploy_all
            ;;
        status)
            status
            ;;
        logs)
            logs "$2"
            ;;
        restart)
            restart "$2"
            ;;
        health)
            health
            ;;
        domain)
            setup_domain "$2"
            ;;
        update-env)
            update_server_env "$2"
            ;;
        *)
            echo "Neurodirectolog Deploy Script"
            echo "=============================="
            echo ""
            echo "Использование: ./deploy.sh [команда]"
            echo ""
            echo "Команды деплоя:"
            echo "  all      - Полный деплой клиента и сервера"
            echo "  client   - Деплой только клиента (быстро)"
            echo "  server   - Деплой только сервера (быстро)"
            echo "  rebuild  - Пересборка Docker образа сервера (при изменении зависимостей)"
            echo ""
            echo "Мониторинг:"
            echo "  status   - Статус контейнеров"
            echo "  health   - Проверка здоровья сервисов"
            echo "  logs     - Логи (logs server|client|clickhouse)"
            echo ""
            echo "Управление:"
            echo "  restart  - Рестарт (restart all|server|client|clickhouse)"
            echo ""
            echo "Домен и SSL:"
            echo "  domain     - Настройка домена с SSL (domain example.com)"
            echo "  update-env - Обновить ENV сервера для домена (update-env example.com)"
            echo ""
            echo "Примеры:"
            echo "  ./deploy.sh all              # Полный деплой"
            echo "  ./deploy.sh client           # Быстрый деплой UI"
            echo "  ./deploy.sh rebuild          # Пересборка образа сервера"
            echo "  ./deploy.sh domain mysite.ru # Настроить SSL для домена"
            echo "  DEPLOY_PASSWORD=xxx ./deploy.sh status  # Без ввода пароля"
            ;;
    esac
}

main "$@"
