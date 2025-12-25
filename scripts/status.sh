#!/bin/bash

# =============================================================================
# NEURODIRECTOLOG STATUS CHECK
# =============================================================================

SERVER_HOST="91.222.239.217"
SERVER_USER="root"
SERVER_PASSWORD="c9R+eLvxtQJ-,x"

# Цвета
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ssh_cmd() {
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "$1" 2>/dev/null
}

echo ""
echo "=========================================="
echo "   NEURODIRECTOLOG STATUS"
echo "=========================================="
echo ""

# Docker контейнеры
echo -e "${YELLOW}Docker Containers:${NC}"
ssh_cmd "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep neurodirectolog"
echo ""

# Git статус на сервере
echo -e "${YELLOW}Git Status (server):${NC}"
ssh_cmd "cd /root/neurodirectolog && git log --oneline -1"
echo ""

# Git статус локально
echo -e "${YELLOW}Git Status (local):${NC}"
git log --oneline -1
echo ""

# Проверка синхронизации
LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(ssh_cmd "cd /root/neurodirectolog && git rev-parse HEAD")

if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
    echo -e "${GREEN}✓ Local and server are in sync${NC}"
else
    echo -e "${RED}✗ Local and server are OUT OF SYNC${NC}"
    echo "  Local:  $LOCAL_COMMIT"
    echo "  Server: $REMOTE_COMMIT"
fi
echo ""

# Проверка данных
echo -e "${YELLOW}Data Status:${NC}"
PROJECTS_COUNT=$(ssh_cmd "cat /var/lib/docker/volumes/neurodirectolog_server_data/_data/projects.json 2>/dev/null | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' 2>/dev/null || echo '0'")
USERS_COUNT=$(ssh_cmd "cat /var/lib/docker/volumes/neurodirectolog_server_data/_data/users.json 2>/dev/null | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' 2>/dev/null || echo '0'")
CONNECTIONS_COUNT=$(ssh_cmd "docker exec neurodirectolog-clickhouse clickhouse-client --query 'SELECT count() FROM neurodirectolog.yandex_direct_connections' 2>/dev/null || echo '0'")

echo "  Projects: $PROJECTS_COUNT"
echo "  Users: $USERS_COUNT"
echo "  Connections: $CONNECTIONS_COUNT"
echo ""

echo -e "${GREEN}Production URL:${NC} https://dashboard.vincora.ru"
echo ""
