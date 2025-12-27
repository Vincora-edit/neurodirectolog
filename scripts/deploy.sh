#!/bin/bash
# Safe deploy script
# Usage: ./scripts/deploy.sh [staging|prod]

set -e

ENV=${1:-staging}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Деплой в $ENV${NC}"
echo ""

# 1. Проверка что мы в правильной директории
if [ ! -f "$PROJECT_DIR/package.json" ]; then
  echo -e "${RED}❌ Ошибка: не найден package.json${NC}"
  exit 1
fi

# 2. Локальная сборка для проверки ошибок
echo "📦 Локальная сборка..."
cd "$PROJECT_DIR"
npm run build
echo -e "${GREEN}✅ Сборка успешна${NC}"
echo ""

# 3. Коммит изменений если есть
if ! git diff --quiet; then
  echo -e "${YELLOW}⚠️  Есть незакоммиченные изменения${NC}"
  read -p "Закоммитить и продолжить? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add -A
    read -p "Commit message: " MSG
    git commit -m "$MSG"
  else
    echo -e "${RED}❌ Отменено${NC}"
    exit 1
  fi
fi

# 4. Push в git
echo "📤 Push в git..."
git push

# 5. Деплой на сервер
SERVER="root@91.222.239.217"
SERVER_DIR="/root/neurodirectolog"

if [ "$ENV" = "prod" ]; then
  COMPOSE_FILE="docker-compose.prod.yml"
  SERVICES="client server"
else
  COMPOSE_FILE="docker-compose.staging.yml"
  SERVICES="client-staging server-staging"
fi

echo "🔄 Деплой на сервер ($ENV)..."
sshpass -p 'c9R+eLvxtQJ-,x' ssh -o StrictHostKeyChecking=no $SERVER "
  cd $SERVER_DIR &&
  git pull &&
  docker-compose -f $COMPOSE_FILE build --no-cache $SERVICES &&
  docker-compose -f $COMPOSE_FILE up -d $SERVICES
"
echo -e "${GREEN}✅ Контейнеры запущены${NC}"
echo ""

# 6. Ждём пока контейнеры запустятся
echo "⏳ Ожидание запуска (15 сек)..."
sleep 15

# 7. Health check
echo "🔍 Проверка работоспособности..."
"$SCRIPT_DIR/health-check.sh" $ENV

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}🎉 Деплой $ENV завершён успешно!${NC}"

  if [ "$ENV" = "staging" ]; then
    echo ""
    echo -e "${YELLOW}Проверь на https://test-dashboard.vincora.ru${NC}"
    echo "Если всё ок, запусти: ./scripts/deploy.sh prod"
  fi
else
  echo ""
  echo -e "${RED}❌ Health check провален!${NC}"
  exit 1
fi
