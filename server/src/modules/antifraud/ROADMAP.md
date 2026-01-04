# Antifraud Module Roadmap

## MVP (текущая реализация)

### Безопасные проверки (низкий риск false positive)
- [x] `navigator.webdriver === true` (+5) — Selenium, Puppeteer
- [x] `HeadlessChrome` в User-Agent (+5)
- [x] Canvas fingerprint пустой/короткий (+3)
- [x] Окно < 300x100 пикселей (+4)
- [x] Нет плагинов + нет языков (+2)
- [x] Honeypot поле заполнено (+10)
- [x] PhantomJS detection (+5)

### Интеграция
- [x] Генерация персонального скрипта с ID Метрики
- [x] Отправка `ym(ID, 'reachGoal', 'bot_detected')`
- [x] Отправка `ym(ID, 'userParams', { is_bot: true, bot_score: N })`

---

## Фаза 2: Расширенные проверки

### Технические (добавлено в v1.1)
- [x] Отсутствие WebGL (+2) — headless без GPU
- [x] WebGL Software Renderer (SwiftShader/llvmpipe) (+2)
- [x] navigator.languages пустой (+1)
- [x] screen.colorDepth < 24 (+1) — виртуальные экраны
- [x] Мобильный UA без touch events (+3)
- [x] Несоответствие platform и userAgent (+2)
- [x] Подозрительный connection type (+1)

### Поведенческие (с осторожностью!)
- [ ] Нет взаимодействия 30 сек (+1) — увеличить таймер, низкий вес
- [ ] Форма заполнена < 3 сек (+2) — учитывать autofill
- [ ] Линейное движение мыши (+1) — сложно реализовать надёжно
- [ ] Нет скролла при длинной странице (+1)

### Оставшиеся технические
- [ ] Timezone несоответствие IP и браузера (+2)

### Внешние сервисы (требуют API ключи)
- [ ] ipinfo.io — проверка datacenter IP
- [ ] Scamalytics — fraud score
- [ ] ip-api.com — VPN/Proxy detection

---

## Фаза 3: Серверная аналитика

### Хранение в ClickHouse
- [ ] Таблица `antifraud_events` (fingerprint, score, checks, timestamp)
- [ ] Агрегация по fingerprint — выявление повторных ботов
- [ ] Общий blacklist fingerprints по всем клиентам

### UI в дашборде
- [ ] Статистика: сколько ботов поймано за период
- [ ] График: доля ботов от общего трафика
- [ ] Список последних пойманных ботов с деталями
- [ ] Оценка экономии бюджета

### Автоматизация
- [ ] Автосоздание сегмента в Метрике через API
- [ ] Автодобавление корректировки -100% в Директе
- [ ] Алерты: "Доля ботов выросла до X%"

---

## Фаза 4: AI-улучшения

- [ ] ML-модель для scoring на основе комбинации признаков
- [ ] Обучение на данных всех клиентов
- [ ] Адаптивные пороги под конкретную нишу
- [ ] Определение паттернов скликивания (время, IP диапазоны)

---

## Рискованные проверки (НЕ включать в MVP)

Эти проверки часто дают false positive:

| Проверка | Проблема |
|----------|----------|
| `plugins.length === 0` | Firefox privacy mode, iOS Safari |
| Нет скролла за 15 сек | Человек читает заголовок |
| Быстрая отправка формы | Chrome/Safari autofill |
| IP из датацентра | Легитимные VPN пользователи |
| >3 визитов + отказ | Возвращающиеся клиенты |
| Блокировка по IP | Shared IP, мобильные операторы |

---

## Полезные ресурсы

- [BotD от FingerprintJS](https://github.com/fingerprintjs/BotD) — open source библиотека
- [Статья на Хабре](https://habr.com/ru/articles/929926/) — подход с Matomo
- [Яндекс Метрика userParams](https://yandex.ru/support/metrica/ru/objects/user-params.html)
- [Передача параметров посетителей](https://yandex.ru/support/metrica/ru/data/user-params-data)

---

## Конкуренты для анализа

- Botfaqtor.ru
- Click.ru/clickfraud
- Clickfraud.ru
