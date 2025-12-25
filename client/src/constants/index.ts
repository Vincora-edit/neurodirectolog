// Константы приложения

// Периоды дат
export const DATE_RANGES = [
  { value: 7, label: '7 дней' },
  { value: 14, label: '14 дней' },
  { value: 30, label: '30 дней' },
  { value: 90, label: '90 дней' },
] as const;

// Периоды группировки
export const GROUP_BY_OPTIONS = [
  { value: 'day', label: 'По дням' },
  { value: '3days', label: 'По 3 дня' },
  { value: 'week', label: 'По неделям' },
  { value: 'month', label: 'По месяцам' },
] as const;

// Метрики для графиков
export const CHART_METRICS = [
  { value: 'cost', label: 'Расход', color: '#ef4444' },
  { value: 'clicks', label: 'Клики', color: '#3b82f6' },
  { value: 'impressions', label: 'Показы', color: '#8b5cf6' },
  { value: 'conversions', label: 'Конверсии', color: '#10b981' },
  { value: 'ctr', label: 'CTR', color: '#f59e0b' },
  { value: 'cpc', label: 'CPC', color: '#ec4899' },
  { value: 'cpl', label: 'CPL', color: '#6366f1' },
  { value: 'cr', label: 'CR', color: '#14b8a6' },
] as const;

// Колонки таблицы кампаний
export const CAMPAIGN_TABLE_COLUMNS = [
  { key: 'name', label: 'Название', sortable: false },
  { key: 'totalImpressions', label: 'Показы', sortable: true },
  { key: 'totalClicks', label: 'Клики', sortable: true },
  { key: 'avgCtr', label: 'CTR', sortable: true },
  { key: 'totalCost', label: 'Расход', sortable: true },
  { key: 'avgCpc', label: 'CPC', sortable: true },
  { key: 'totalConversions', label: 'Конверсии', sortable: true },
  { key: 'cr', label: 'CR', sortable: true },
  { key: 'cpl', label: 'CPL', sortable: true },
  { key: 'avgBounceRate', label: 'Отказы', sortable: true },
] as const;

// Статусы кампаний
export const CAMPAIGN_STATUSES = {
  ACTIVE: { label: 'Активна', color: 'green' },
  SUSPENDED: { label: 'Приостановлена', color: 'yellow' },
  ARCHIVED: { label: 'В архиве', color: 'gray' },
  DRAFT: { label: 'Черновик', color: 'blue' },
} as const;

// Типы устройств
export const DEVICE_TYPES = {
  DESKTOP: { label: 'Десктоп', icon: 'Monitor' },
  MOBILE: { label: 'Мобильный', icon: 'Smartphone' },
  TABLET: { label: 'Планшет', icon: 'Tablet' },
} as const;

// Приоритеты рекомендаций
export const RECOMMENDATION_PRIORITIES = {
  high: { label: 'Высокий', color: 'red' },
  medium: { label: 'Средний', color: 'yellow' },
  low: { label: 'Низкий', color: 'blue' },
} as const;

// API endpoints
export const API_ENDPOINTS = {
  YANDEX: {
    CONNECTION: '/api/yandex/connection',
    CONNECTIONS: '/api/yandex/connections',
    CAMPAIGNS: '/api/yandex/campaigns',
    STATS: '/api/yandex/detailed-stats',
    DAILY_STATS: '/api/yandex/daily-stats',
    HIERARCHICAL_STATS: '/api/yandex/hierarchical-stats',
    GOALS: '/api/yandex/available-goals',
    SYNC: '/api/yandex/sync',
    KPI: '/api/yandex/kpi',
    BUDGET_FORECAST: '/api/yandex/budget-forecast',
    LANDING_PAGES: '/api/yandex/landing-pages',
    RECOMMENDATIONS: '/api/yandex/recommendations',
  },
} as const;

// Лимиты
export const LIMITS = {
  MAX_GOALS_SELECTION: 10,
  MAX_TABLE_ROWS: 100,
  CHART_DATA_POINTS: 90,
  SEARCH_DEBOUNCE_MS: 300,
} as const;

// Интервалы обновления (в миллисекундах)
export const REFRESH_INTERVALS = {
  BUDGET_FORECAST: 5 * 60 * 1000, // 5 минут
  RECOMMENDATIONS: 10 * 60 * 1000, // 10 минут
  STATS: 15 * 60 * 1000, // 15 минут
} as const;
