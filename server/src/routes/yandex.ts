/**
 * Yandex Routes
 * Все роуты Яндекс.Директ API разбиты на модули в папке ./yandex/
 *
 * Модули:
 * - auth.ts: OAuth авторизация и подключение аккаунтов
 * - connections.ts: CRUD операции с подключениями
 * - stats.ts: Статистика (агрегированная, детальная, иерархическая)
 * - reports.ts: Отчёты (поисковые запросы, демография, гео, устройства и т.д.)
 * - kpi.ts: KPI, прогноз бюджета, рекомендации
 * - goals.ts: Работа с целями конверсий
 * - sync.ts: Синхронизация данных
 */

import yandexRouter from './yandex/index';

export default yandexRouter;
