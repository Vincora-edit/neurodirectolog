-- Миграция: добавление таблиц users и projects
-- Заменяет JSON-файлы на ClickHouse для масштабируемости

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id String,
    email String,
    password_hash String,      -- bcrypt хеш пароля
    name String,
    is_admin UInt8 DEFAULT 0,  -- 0 = обычный пользователь, 1 = админ
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (id)
SETTINGS index_granularity = 8192;

-- Индекс для быстрого поиска по email (используется при логине)
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email) TYPE bloom_filter() GRANULARITY 1;


-- Таблица проектов
CREATE TABLE IF NOT EXISTS projects (
    id String,
    user_id String,
    name String,

    -- Бриф (JSON для гибкости, структура может меняться)
    brief String,              -- JSON: { businessName, niche, budget, etc. }

    -- Результаты работы модулей (все в JSON)
    semantics String,          -- JSON: { keywords: [], generatedAt }
    creatives String,          -- JSON: { ideas: [], generatedAt }
    ads String,                -- JSON: { headlines: [], texts: [], generatedAt }
    complete_ads String,       -- JSON: { campaignType, ads: [], generatedAt }
    minus_words String,        -- JSON: { words: [], analysis, generatedAt }
    keyword_analysis String,   -- JSON: { classified: [], minusWords: [], statistics, recommendations, generatedAt }
    campaigns String,          -- JSON: { structure, generatedAt }
    strategy String,           -- JSON: { plan, generatedAt }
    analytics String,          -- JSON: { competitorAdsAnalysis, targetAudienceAnalysis, etc., generatedAt }

    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (id)
SETTINGS index_granularity = 8192;

-- Индекс для быстрого поиска проектов пользователя
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects (user_id) TYPE bloom_filter() GRANULARITY 1;
