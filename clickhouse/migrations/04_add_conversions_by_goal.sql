-- Миграция: таблицы конверсий с разбивкой по целям для групп и объявлений

-- 1. Таблица конверсий по группам объявлений с разбивкой по целям
CREATE TABLE IF NOT EXISTS ad_group_conversions (
    id String DEFAULT generateUUIDv4(),
    connection_id String,

    -- Идентификаторы
    campaign_id String,
    ad_group_id String,

    -- Дата
    date Date,

    -- Цель
    goal_id String,

    -- Конверсии
    conversions UInt32 DEFAULT 0,
    revenue Decimal(18, 2) DEFAULT 0,

    -- Служебные поля
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(date)
ORDER BY (connection_id, campaign_id, ad_group_id, goal_id, date, id);


-- 2. Таблица конверсий по объявлениям с разбивкой по целям
CREATE TABLE IF NOT EXISTS ad_conversions (
    id String DEFAULT generateUUIDv4(),
    connection_id String,

    -- Идентификаторы
    campaign_id String,
    ad_group_id String,
    ad_id String,

    -- Дата
    date Date,

    -- Цель
    goal_id String,

    -- Конверсии
    conversions UInt32 DEFAULT 0,
    revenue Decimal(18, 2) DEFAULT 0,

    -- Служебные поля
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(date)
ORDER BY (connection_id, campaign_id, ad_group_id, ad_id, goal_id, date, id);
