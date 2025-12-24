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

# Создаем непривилегированного пользователя (используем существующего node)
RUN chown -R node:node /app

# Переключаемся на непривилегированного пользователя
USER node

# Открываем порт
EXPOSE 3001

# Запускаем приложение
CMD ["node", "dist/index.js"]
