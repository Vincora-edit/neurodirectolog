-- Добавляем поле goal_ids в таблицу account_kpi для привязки конкретных целей к KPI
ALTER TABLE neurodirectolog.account_kpi ADD COLUMN IF NOT EXISTS goal_ids String DEFAULT '[]';
