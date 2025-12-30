# Этап сборки
FROM node:18-alpine as builder

WORKDIR /app

# Копируем package files
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходники
COPY . .

# CRITICAL: VITE_API_URL ОБЯЗАТЕЛЕН при сборке!
# Без этого аргумента клиент будет использовать localhost и не сможет подключиться к API.
#
# Production:  docker build --build-arg VITE_API_URL=https://dashboard.vincora.ru/api -t neurodirectolog_client:latest ./client
# Staging:     docker build --build-arg VITE_API_URL=https://test-dashboard.vincora.ru/api -t neurodirectolog_client-staging:latest ./client
#
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Собираем production build
RUN npm run build

# Этап production с nginx
FROM nginx:alpine

# Копируем собранные файлы
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем конфиг nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Открываем порт
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
