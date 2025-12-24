-- Добавляем колонку href в таблицу ad_contents для хранения ссылок на посадочные страницы
ALTER TABLE neurodirectolog.ad_contents ADD COLUMN IF NOT EXISTS href Nullable(String);
