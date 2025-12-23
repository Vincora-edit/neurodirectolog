FROM node:18-alpine

WORKDIR /app

# Копируем package files
COPY package*.json ./

# Устанавливаем зависимости (включая devDependencies для сборки)
RUN npm install

# Копируем исходники
COPY . .

# Собираем TypeScript
RUN npm run build

# Удаляем devDependencies после сборки
RUN npm prune --production

# Создаем непривилегированного пользователя
RUN addgroup -g 1000 appuser && \
    adduser -D -u 1000 -G appuser appuser && \
    chown -R appuser:appuser /app

# Переключаемся на непривилегированного пользователя
USER appuser

# Открываем порт
EXPOSE 3001

# Запускаем приложение
CMD ["node", "dist/index.js"]
