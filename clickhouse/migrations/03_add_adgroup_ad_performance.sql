-- Миграция: таблицы для статистики по группам объявлений и объявлениям

-- 1. Таблица статистики по группам объявлений
CREATE TABLE IF NOT EXISTS ad_group_performance (
    id String DEFAULT generateUUIDv4(),
    connection_id String,

    -- Идентификаторы
    campaign_id String,
    campaign_name String,
    ad_group_id String,
    ad_group_name String,

    -- Дата
    date Date,

    -- Основные метрики
    impressions UInt32 DEFAULT 0,
    clicks UInt32 DEFAULT 0,
    cost Decimal(18, 2) DEFAULT 0,

    -- Расчётные метрики
    ctr Decimal(10, 4) DEFAULT 0,
    avg_cpc Decimal(18, 2) DEFAULT 0,
    bounce_rate Decimal(10, 4) DEFAULT 0,

    -- Конверсии
    conversions UInt32 DEFAULT 0,
    revenue Decimal(18, 2) DEFAULT 0,

    -- Служебные поля
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(date)
ORDER BY (connection_id, campaign_id, ad_group_id, date, id);


-- 2. Таблица статистики по объявлениям
CREATE TABLE IF NOT EXISTS ad_performance (
    id String DEFAULT generateUUIDv4(),
    connection_id String,

    -- Идентификаторы
    campaign_id String,
    campaign_name String,
    ad_group_id String,
    ad_group_name String,
    ad_id String,

    -- Дата
    date Date,

    -- Основные метрики
    impressions UInt32 DEFAULT 0,
    clicks UInt32 DEFAULT 0,
    cost Decimal(18, 2) DEFAULT 0,

    -- Расчётные метрики
    ctr Decimal(10, 4) DEFAULT 0,
    avg_cpc Decimal(18, 2) DEFAULT 0,
    bounce_rate Decimal(10, 4) DEFAULT 0,

    -- Конверсии
    conversions UInt32 DEFAULT 0,
    revenue Decimal(18, 2) DEFAULT 0,

    -- Служебные поля
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(date)
ORDER BY (connection_id, campaign_id, ad_group_id, ad_id, date, id);


-- 3. Добавляем колонки конверсий в существующие таблицы, если их нет
ALTER TABLE ad_group_performance ADD COLUMN IF NOT EXISTS conversions UInt32 DEFAULT 0;
ALTER TABLE ad_group_performance ADD COLUMN IF NOT EXISTS revenue Decimal(18, 2) DEFAULT 0;

ALTER TABLE ad_performance ADD COLUMN IF NOT EXISTS conversions UInt32 DEFAULT 0;
ALTER TABLE ad_performance ADD COLUMN IF NOT EXISTS revenue Decimal(18, 2) DEFAULT 0;
