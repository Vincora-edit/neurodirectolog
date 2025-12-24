#!/bin/bash

# ===========================================
# Скрипт настройки домена с SSL для Neurodirectolog
# ===========================================
# Запускать на СЕРВЕРЕ (не локально!)
# Использование: ./setup-domain.sh <domain>
# Пример: ./setup-domain.sh neurodirectolog.ru
# ===========================================

set -e

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DOMAIN="${1:-dashboard.vincora.ru}"
EMAIL="admin@${DOMAIN}"

echo -e "${BLUE}===========================================
 Настройка домена: $DOMAIN
===========================================${NC}"

# 1. Установка nginx и certbot (если не установлены)
echo -e "${YELLOW}📦 Проверка и установка nginx, certbot...${NC}"
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx

# 2. Остановка nginx для certbot
echo -e "${YELLOW}🛑 Останавливаем nginx...${NC}"
systemctl stop nginx || true

# 3. Создаем директорию для certbot
mkdir -p /var/www/certbot

# 4. Получение SSL сертификата
echo -e "${YELLOW}🔐 Получаем SSL сертификат от Let's Encrypt...${NC}"
certbot certonly --standalone \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --no-eff-email

# 5. Создаем nginx конфигурацию
echo -e "${YELLOW}⚙️  Настраиваем nginx...${NC}"
cat > /etc/nginx/conf.d/neurodirectolog.conf << 'NGINX_CONF'
# HTTP редирект на HTTPS
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER www.DOMAIN_PLACEHOLDER;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS сервер
server {
    listen 443 ssl http2;
    server_name DOMAIN_PLACEHOLDER www.DOMAIN_PLACEHOLDER;

    ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    add_header Strict-Transport-Security "max-age=63072000" always;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/xml+rss application/json;

    # Фронтенд
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API бэкенд
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    location /yandex/callback {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_CONF

# Заменяем плейсхолдер на реальный домен
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/conf.d/neurodirectolog.conf

# 6. Удаляем дефолтный конфиг nginx
rm -f /etc/nginx/sites-enabled/default

# 7. Проверяем конфигурацию
echo -e "${YELLOW}✅ Проверяем конфигурацию nginx...${NC}"
nginx -t

# 8. Запускаем nginx
echo -e "${YELLOW}🚀 Запускаем nginx...${NC}"
systemctl start nginx
systemctl enable nginx

# 9. Настраиваем автообновление сертификата
echo -e "${YELLOW}🔄 Настраиваем автообновление сертификата...${NC}"
(crontab -l 2>/dev/null | grep -v certbot; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -

echo ""
echo -e "${GREEN}===========================================
✅ Домен настроен успешно!
===========================================${NC}"
echo ""
echo -e "Сайт доступен по адресам:"
echo -e "  ${BLUE}https://$DOMAIN${NC}"
echo -e "  ${BLUE}https://www.$DOMAIN${NC}"
echo ""
echo -e "${YELLOW}⚠️  Не забудьте:${NC}"
echo "1. Обновить CORS_ORIGIN на сервере: https://$DOMAIN"
echo "2. Обновить YANDEX_REDIRECT_URI: https://$DOMAIN/yandex/callback"
echo "3. Обновить приложение в Яндекс OAuth"
echo "4. Обновить client/.env.production с новым API URL"
echo ""
