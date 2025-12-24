-- Таблица KPI для аккаунтов (месячные цели)
CREATE TABLE IF NOT EXISTS neurodirectolog.account_kpi (
    id UUID DEFAULT generateUUIDv4(),
    connection_id String,
    month String,  -- формат: '2024-12'
    target_cost Float64 DEFAULT 0,      -- целевой расход на месяц
    target_cpl Float64 DEFAULT 0,       -- целевой CPL
    target_leads UInt32 DEFAULT 0,      -- целевое количество лидов
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (connection_id, month)
PRIMARY KEY (connection_id, month);
