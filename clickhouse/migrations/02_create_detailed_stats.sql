-- Миграция: детализированная статистика по кампаниям

-- 1. Основная таблица статистики (заменяет упрощённую campaign_stats)
CREATE TABLE IF NOT EXISTS campaign_performance (
    id String DEFAULT generateUUIDv4(),
    connection_id String,
    account_name String,

    -- Идентификаторы
    campaign_id String,
    campaign_name String,
    campaign_type String,
    ad_group_id Nullable(String),
    ad_group_name Nullable(String),
    ad_id Nullable(String),

    -- Дата
    date Date,

    -- Основные метрики
    impressions UInt32 DEFAULT 0,
    clicks UInt32 DEFAULT 0,
    cost Decimal(18, 2) DEFAULT 0,

    -- Расчётные метрики
    ctr Decimal(10, 4) DEFAULT 0,
    avg_cpc Decimal(18, 2) DEFAULT 0,
    avg_cpm Decimal(18, 2) DEFAULT 0,
    avg_click_position Nullable(Decimal(10, 2)),
    avg_impression_position Nullable(Decimal(10, 2)),

    -- Измерения (dimensions)
    device Nullable(String),
    age Nullable(String),
    gender Nullable(String),
    income_grade Nullable(String),

    -- Таргетинг
    targeting_location_id Nullable(UInt64),
    targeting_location_name Nullable(String),
    targeting_category Nullable(String),

    -- Тип размещения
    ad_network_type Nullable(String),  -- SEARCH или AD_NETWORK
    placement Nullable(String),  -- площадка
    slot Nullable(String),  -- блок показа

    -- Ключевые слова и условия
    criterion Nullable(String),  -- ключевое слово или условие
    criterion_type Nullable(String),  -- KEYWORD или AUTOTARGETING
    match_type Nullable(String),  -- тип соответствия

    -- Технические параметры
    mobile_platform Nullable(String),
    carrier_type Nullable(String),

    -- Служебные поля
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(date)
ORDER BY (connection_id, campaign_id, date, id);

-- 2. Таблица конверсий (отдельно от основной статистики)
CREATE TABLE IF NOT EXISTS campaign_conversions (
    id String DEFAULT generateUUIDv4(),
    connection_id String,

    -- Привязка к кампании
    campaign_id String,
    ad_group_id Nullable(String),
    ad_id Nullable(String),

    -- Дата
    date Date,

    -- Цель конверсии
    goal_id String,  -- ID цели из Яндекс.Метрики
    goal_name Nullable(String),  -- Название цели (опционально)
    attribution_model String DEFAULT 'AUTO',  -- AUTO, LYCCD, FC, LC, LSC

    -- Метрики конверсии
    conversions UInt32 DEFAULT 0,
    revenue Decimal(18, 2) DEFAULT 0,

    -- Расчётные поля (заполняются при запросе)
    -- cost_per_conversion - будет JOIN с campaign_performance
    -- conversion_rate - будет JOIN с campaign_performance

    -- Служебные поля
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(date)
ORDER BY (connection_id, campaign_id, goal_id, date, id);

-- 3. Таблица поисковых запросов
CREATE TABLE IF NOT EXISTS search_queries (
    id String DEFAULT generateUUIDv4(),
    connection_id String,
    account_name String,

    -- Идентификаторы
    campaign_id String,
    campaign_name String,
    ad_group_id Nullable(String),
    ad_group_name Nullable(String),
    ad_id Nullable(String),

    -- Дата
    date Date,

    -- Запрос
    query String,  -- поисковый запрос пользователя
    matched_keyword Nullable(String),  -- совпавшее ключевое слово
    match_type Nullable(String),  -- тип соответствия

    -- Метрики
    impressions UInt32 DEFAULT 0,
    clicks UInt32 DEFAULT 0,
    cost Decimal(18, 2) DEFAULT 0,

    -- Дополнительные поля
    criterion Nullable(String),
    criterion_type Nullable(String),
    targeting_category Nullable(String),
    placement Nullable(String),
    income_grade Nullable(String),

    -- Служебные поля
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(date)
ORDER BY (connection_id, campaign_id, date, query, id);

-- 4. Таблица объявлений (содержимое)
CREATE TABLE IF NOT EXISTS ad_contents (
    id String DEFAULT generateUUIDv4(),
    connection_id String,
    account_name String,

    -- Идентификаторы
    ad_id String,
    ad_group_id String,
    campaign_id String,

    -- Статусы
    state Nullable(String),  -- DRAFT, MODERATION, PREACCEPTED, ACCEPTED, REJECTED
    status Nullable(String),  -- ACCEPTED, REJECTED, DRAFT
    status_clarification Nullable(String),

    -- Тип и подтип
    type Nullable(String),  -- TEXT_AD, MOBILE_APP_AD, etc
    subtype Nullable(String),

    -- Содержимое текстового объявления
    title Nullable(String),
    title2 Nullable(String),
    text Nullable(String),
    href Nullable(String),
    display_url_path Nullable(String),
    mobile Nullable(String),  -- YES/NO

    -- Изображения
    ad_image_hash Nullable(String),
    image_url Nullable(String),

    -- Расширения
    sitelink_set_id Nullable(String),
    vcard_id Nullable(String),

    -- Служебные поля
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (connection_id, ad_id, id);

-- Индексы для быстрых запросов
-- По умолчанию ClickHouse создаёт индексы по ORDER BY, но добавим материализованные view для частых агрегаций

-- View для быстрого получения статистики по кампаниям с конверсиями
CREATE MATERIALIZED VIEW IF NOT EXISTS campaign_stats_with_conversions
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (connection_id, campaign_id, date)
AS
SELECT
    connection_id,
    campaign_id,
    campaign_name,
    date,
    sumState(impressions) as total_impressions,
    sumState(clicks) as total_clicks,
    sumState(cost) as total_cost,
    avgState(ctr) as avg_ctr,
    avgState(avg_cpc) as avg_cpc_metric
FROM campaign_performance
GROUP BY connection_id, campaign_id, campaign_name, date;
