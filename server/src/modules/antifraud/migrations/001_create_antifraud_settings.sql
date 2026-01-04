-- Antifraud Settings Table
-- Хранит настройки антифрод-защиты для каждого подключения

CREATE TABLE IF NOT EXISTS neurodirectolog.antifraud_settings
(
    connection_id String,
    enabled UInt8 DEFAULT 0,
    metrika_id String DEFAULT '',
    threshold UInt8 DEFAULT 5,
    enable_honeypot UInt8 DEFAULT 1,
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY connection_id;

-- Примечания:
-- ReplacingMergeTree позволяет обновлять записи (последняя версия по updated_at)
-- При запросах используйте FINAL: SELECT * FROM antifraud_settings FINAL WHERE ...
