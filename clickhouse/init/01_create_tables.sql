-- База данных создается автоматически через env переменную CLICKHOUSE_DB

-- Таблица подключений к Яндекс.Директ
CREATE TABLE IF NOT EXISTS yandex_direct_connections (
    id String,
    user_id String,
    project_id String,
    login String,
    access_token String,
    refresh_token String,
    metrika_counter_id String,
    metrika_token String,
    conversion_goals String, -- JSON string
    status String, -- active, error, disconnected
    last_sync_at DateTime,
    created_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(created_at)
ORDER BY (id)
SETTINGS index_granularity = 8192;

-- Таблица кампаний
CREATE TABLE IF NOT EXISTS campaigns (
    id String,
    connection_id String,
    external_id String, -- ID кампании в Яндекс.Директ
    name String,
    status String, -- ON, OFF, ARCHIVED
    type String, -- TEXT_CAMPAIGN, MOBILE_APP_CAMPAIGN, DYNAMIC_TEXT_CAMPAIGN
    daily_budget Decimal64(2),

    -- Кастомные поля
    responsible String,
    executor String,
    kpi String, -- JSON: { target_cpa: 500, target_roi: 300 }

    created_at DateTime,
    updated_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (id, connection_id)
SETTINGS index_granularity = 8192;

-- Таблица статистики кампаний (основная таблица для аналитики)
CREATE TABLE IF NOT EXISTS campaign_stats (
    id String,
    campaign_id String,
    campaign_external_id String,
    connection_id String,
    date Date,

    -- Основные метрики
    impressions UInt64,
    clicks UInt64,
    cost Decimal64(2),

    -- Вычисляемые метрики (сохраняем для скорости)
    ctr Decimal(5,2),
    avg_cpc Decimal(10,2),
    avg_cpm Decimal(10,2),

    -- Конверсии (из Метрики)
    conversions UInt32,
    conversion_rate Decimal(5,2),
    cost_per_conversion Decimal(10,2),

    -- Квалифицированные лиды (custom goal)
    qualified_leads UInt32,
    cost_per_qualified_lead Decimal(10,2),

    -- ROI (если настроена интеграция с CRM)
    revenue Decimal(12,2),
    roi Decimal(10,2),

    created_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(created_at)
PARTITION BY toYYYYMM(date)
ORDER BY (campaign_id, date)
SETTINGS index_granularity = 8192;

-- Таблица групп объявлений
CREATE TABLE IF NOT EXISTS ad_groups (
    id String,
    campaign_id String,
    external_id String,
    name String,
    status String,
    created_at DateTime,
    updated_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (id, campaign_id)
SETTINGS index_granularity = 8192;

-- Статистика групп объявлений
CREATE TABLE IF NOT EXISTS ad_group_stats (
    id String,
    ad_group_id String,
    ad_group_external_id String,
    campaign_id String,
    date Date,

    impressions UInt64,
    clicks UInt64,
    cost Decimal64(2),
    ctr Decimal(5,2),
    avg_cpc Decimal(10,2),
    conversions UInt32,
    conversion_rate Decimal(5,2),
    cost_per_conversion Decimal(10,2),

    created_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(created_at)
PARTITION BY toYYYYMM(date)
ORDER BY (ad_group_id, date)
SETTINGS index_granularity = 8192;

-- Таблица объявлений
CREATE TABLE IF NOT EXISTS ads (
    id String,
    ad_group_id String,
    external_id String,
    headline String,
    text String,
    status String,
    created_at DateTime,
    updated_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (id, ad_group_id)
SETTINGS index_granularity = 8192;

-- Статистика объявлений
CREATE TABLE IF NOT EXISTS ad_stats (
    id String,
    ad_id String,
    ad_external_id String,
    ad_group_id String,
    date Date,

    impressions UInt64,
    clicks UInt64,
    cost Decimal64(2),
    ctr Decimal(5,2),
    avg_cpc Decimal(10,2),
    conversions UInt32,
    conversion_rate Decimal(5,2),

    created_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(created_at)
PARTITION BY toYYYYMM(date)
ORDER BY (ad_id, date)
SETTINGS index_granularity = 8192;

-- AI рекомендации
CREATE TABLE IF NOT EXISTS ai_recommendations (
    id String,
    campaign_id String,
    type String, -- warning, suggestion, critical
    category String, -- budget, ctr, conversions, keywords
    title String,
    description String,
    action_text String,
    is_applied UInt8,
    is_dismissed UInt8,
    created_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(created_at)
ORDER BY (campaign_id, created_at)
SETTINGS index_granularity = 8192;

-- История изменений (лог всех действий)
CREATE TABLE IF NOT EXISTS change_history (
    id String,
    campaign_id String,
    changed_by String, -- user, ai, system, yandex
    change_type String, -- bid_change, budget_change, status_change
    old_value String,
    new_value String,
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (campaign_id, created_at)
SETTINGS index_granularity = 8192;

-- Материализованные представления для быстрой аналитики

-- Агрегированная статистика по кампаниям за последние 30 дней
CREATE MATERIALIZED VIEW IF NOT EXISTS campaign_stats_30d
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (campaign_id, date)
AS SELECT
    campaign_id,
    date,
    sumState(impressions) AS impressions,
    sumState(clicks) AS clicks,
    sumState(cost) AS cost,
    sumState(conversions) AS conversions,
    sumState(qualified_leads) AS qualified_leads,
    sumState(revenue) AS revenue
FROM campaign_stats
WHERE date >= today() - INTERVAL 30 DAY
GROUP BY campaign_id, date;

-- Сводка по дням для быстрого доступа
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_summary
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (connection_id, date)
AS SELECT
    connection_id,
    date,
    sum(impressions) AS total_impressions,
    sum(clicks) AS total_clicks,
    sum(cost) AS total_cost,
    sum(conversions) AS total_conversions,
    sum(qualified_leads) AS total_qualified_leads,
    sum(revenue) AS total_revenue
FROM campaign_stats
GROUP BY connection_id, date;
