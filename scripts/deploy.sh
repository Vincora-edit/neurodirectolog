#!/bin/bash

# =============================================================================
# NEURODIRECTOLOG DEPLOY SCRIPT
# =============================================================================
# Использование:
#   ./scripts/deploy.sh           - деплой всего (client + server)
#   ./scripts/deploy.sh client    - деплой только клиента
#   ./scripts/deploy.sh server    - деплой только сервера
# =============================================================================

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Конфигурация
SERVER_HOST="91.222.239.217"
SERVER_USER="root"
SERVER_PASSWORD="c9R+eLvxtQJ-,x"
PROJECT_PATH="/root/neurodirectolog"
BACKUP_PATH="/root/backups"

# Функции
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# SSH команда
ssh_cmd() {
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "$1"
}

# Шаг 1: Проверка TypeScript
check_typescript() {
    log_info "Проверка TypeScript..."
    cd "$(dirname "$0")/../client"
    if npx tsc --noEmit 2>&1; then
        log_success "TypeScript проверка пройдена"
    else
        log_error "TypeScript ошибки! Исправьте перед деплоем."
        exit 1
    fi
    cd - > /dev/null
}

# Шаг 2: Проверка сборки
check_build() {
    log_info "Проверка сборки..."
    cd "$(dirname "$0")/.."
    if npm run build 2>&1 | tail -5; then
        log_success "Сборка успешна"
    else
        log_error "Ошибка сборки! Исправьте перед деплоем."
        exit 1
    fi
    cd - > /dev/null
}

# Шаг 3: Коммит и пуш
git_push() {
    log_info "Проверка git статуса..."
    cd "$(dirname "$0")/.."

    if [[ -n $(git status --porcelain) ]]; then
        log_warn "Есть незакоммиченные изменения:"
        git status --short
        echo ""
        read -p "Закоммитить с сообщением? (Enter для пропуска): " commit_msg
        if [[ -n "$commit_msg" ]]; then
            git add .
            git commit -m "$commit_msg"
            log_success "Изменения закоммичены"
        fi
    fi

    log_info "Push в origin main..."
    git push origin main
    log_success "Push выполнен"
    cd - > /dev/null
}

# Шаг 4: Бэкап данных на сервере
backup_data() {
    log_info "Создание бэкапа данных на сервере..."

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)

    ssh_cmd "mkdir -p $BACKUP_PATH"

    # Бэкап projects.json
    ssh_cmd "cp /var/lib/docker/volumes/neurodirectolog_server_data/_data/projects.json $BACKUP_PATH/projects_${TIMESTAMP}.json 2>/dev/null || echo 'projects.json not found'"

    # Бэкап users.json
    ssh_cmd "cp /var/lib/docker/volumes/neurodirectolog_server_data/_data/users.json $BACKUP_PATH/users_${TIMESTAMP}.json 2>/dev/null || echo 'users.json not found'"

    log_success "Бэкап создан: $BACKUP_PATH/*_${TIMESTAMP}.json"
}

# Шаг 5: Pull на сервере
server_pull() {
    log_info "Pulling changes на сервере..."
    ssh_cmd "cd $PROJECT_PATH && git pull"
    log_success "Pull выполнен"
}

# Шаг 6: Пересборка и перезапуск
rebuild_service() {
    local service=$1
    log_info "Пересборка $service..."
    ssh_cmd "cd $PROJECT_PATH && docker-compose -f docker-compose.prod.yml build $service"
    log_success "$service пересобран"

    log_info "Перезапуск $service..."
    ssh_cmd "cd $PROJECT_PATH && docker-compose -f docker-compose.prod.yml up -d $service"
    log_success "$service перезапущен"
}

# Шаг 7: Проверка после деплоя
verify_deploy() {
    log_info "Проверка деплоя..."

    # Проверка статуса контейнеров
    ssh_cmd "docker ps | grep neurodirectolog"

    # Проверка API
    if ssh_cmd "curl -s http://localhost:3001/api/health" | grep -q "ok"; then
        log_success "API работает"
    else
        log_warn "API не отвечает или не настроен health endpoint"
    fi

    log_success "Деплой завершён!"
    echo ""
    echo -e "${GREEN}Production:${NC} https://dashboard.vincora.ru"
}

# Главная функция
main() {
    echo ""
    echo "=========================================="
    echo "   NEURODIRECTOLOG DEPLOY"
    echo "=========================================="
    echo ""

    local deploy_target=${1:-"all"}

    # Проверки перед деплоем
    check_typescript
    check_build

    # Git операции
    git_push

    # Операции на сервере
    backup_data
    server_pull

    # Деплой сервисов
    case $deploy_target in
        "client")
            rebuild_service "client"
            ;;
        "server")
            rebuild_service "server"
            ;;
        "all"|*)
            rebuild_service "server"
            rebuild_service "client"
            ;;
    esac

    # Проверка
    verify_deploy
}

# Запуск
main "$@"
