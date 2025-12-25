# AI Agents для Neurodirectolog

Набор AI-агентов для автоматизации работы с проектом.

## Установленные агенты

### 1. Yandex Analytics Agent
**Файл:** `yandex-analytics-agent.js`

Анализирует данные рекламных кампаний Яндекс.Директ.

```bash
# Примеры использования
node agents/yandex-analytics-agent.js "Список всех проектов" --yolo
node agents/yandex-analytics-agent.js "Анализ CPL для проекта proj_123" --yolo
node agents/yandex-analytics-agent.js "Найди кампании с высоким CPL и дай рекомендации" --yolo
```

**Возможности:**
- Анализ CPL по кампаниям
- Оценка конверсии
- Анализ бюджета
- Генерация рекомендаций по оптимизации

---

### 2. Code Review Agent
**Файл:** `code-review-agent.js`

Автоматический ревью кода и анализ качества.

```bash
# Примеры использования
node agents/code-review-agent.js "Проверь последние изменения" --yolo
node agents/code-review-agent.js "Найди проблемы безопасности" --yolo
node agents/code-review-agent.js "Анализ сложности кода в client/src" --yolo
```

**Возможности:**
- Git diff анализ
- TypeScript проверка
- ESLint анализ
- Анализ сложности кода
- Поиск TODO/FIXME

---

### 3. Deploy Agent
**Файл:** `deploy-agent.js`

Безопасное развертывание приложений.

```bash
# Примеры использования
node agents/deploy-agent.js "Сборка и тестирование" --yolo
node agents/deploy-agent.js "Деплой в продакшн" --yolo
node agents/deploy-agent.js "Откат к предыдущей версии" --yolo
```

**Возможности:**
- npm build/test
- Docker сборка и пуш
- PM2 управление
- Бэкапы и откаты
- Health checks

---

### 4. Data Sync Agent
**Файл:** `data-sync-agent.js`

Синхронизация данных между Яндекс.Директ и базой данных.

```bash
# Примеры использования
node agents/data-sync-agent.js "Синхронизация кампаний для proj_123" --yolo
node agents/data-sync-agent.js "Полная синхронизация за последние 7 дней" --yolo
node agents/data-sync-agent.js "Проверка статуса синхронизации" --yolo
```

**Возможности:**
- Синхронизация кампаний, групп объявлений, объявлений
- Синхронизация статистики
- Валидация данных
- Обработка ошибок

---

### 5. Report Generator Agent
**Файл:** `report-generator-agent.js`

Генерация отчетов по рекламным данным.

```bash
# Примеры использования
node agents/report-generator-agent.js "Недельный отчет для proj_123" --yolo
node agents/report-generator-agent.js "Сравнение этой недели с прошлой" --yolo
node agents/report-generator-agent.js "Executive summary в HTML" --yolo
```

**Возможности:**
- Недельные/месячные отчеты
- Сравнение периодов
- Экспорт в Markdown и HTML
- Автоматические рекомендации

---

## Общие параметры

Все агенты поддерживают следующие флаги:

| Флаг | Описание |
|------|----------|
| `--yolo`, `-y` | Автоматическое выполнение инструментов |
| `--model`, `-m` | Выбор AI модели |
| `--provider`, `-p` | Провайдер (ollama, openai, anthropic) |
| `--cwd` | Рабочая директория |
| `--api-url` | URL API сервера |

## Настройка

### Переменные окружения

Создайте `.env` файл в корне проекта:

```env
# Для локального Ollama (по умолчанию)
OLLAMA_HOST=http://localhost:11434

# Для OpenAI
OPENAI_API_KEY=sk-...

# Для Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# API сервер
API_BASE_URL=http://localhost:3001
AUTH_TOKEN=your-token
```

### Модели

**Ollama (бесплатно, локально):**
- `mistral-small` (по умолчанию)
- `llama3.2`
- `deepseek-r1`

**OpenAI:**
- `gpt-4o-mini`
- `gpt-4o`

**Anthropic:**
- `claude-sonnet-4-5-20250929`

## Примеры workflow

### Утренний анализ
```bash
# Проверка синхронизации данных
node agents/data-sync-agent.js "Синхронизация статистики за вчера" --yolo

# Анализ CPL
node agents/yandex-analytics-agent.js "Рекомендации по оптимизации CPL" --yolo

# Генерация отчета
node agents/report-generator-agent.js "Ежедневный отчет" --yolo
```

### Перед деплоем
```bash
# Код ревью
node agents/code-review-agent.js "Полная проверка кода" --yolo

# Сборка и тесты
node agents/deploy-agent.js "Сборка и тестирование" --yolo

# Деплой
node agents/deploy-agent.js "Деплой в продакшн" --yolo
```
