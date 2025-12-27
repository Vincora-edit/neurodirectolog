/**
 * Migration: Create alerts, search_query_analyses, telegram_users tables
 * Run with: npx ts-node src/scripts/migrate-alerts-tables.ts
 */

import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DB || 'neurodirectolog',
});

async function migrate() {
  console.log('Starting migration...');

  // 1. Create alerts table
  console.log('Creating alerts table...');
  await client.command({
    query: `
      CREATE TABLE IF NOT EXISTS alerts (
        id UUID,
        connection_id String,
        user_id String,
        type Enum8('critical' = 1, 'warning' = 2, 'info' = 3),
        category Enum8('budget' = 1, 'ctr' = 2, 'conversions' = 3, 'cpl' = 4, 'impressions' = 5, 'anomaly' = 6),
        title String,
        message String,
        campaign_id Nullable(String),
        campaign_name Nullable(String),
        metric_name Nullable(String),
        previous_value Nullable(Float64),
        current_value Nullable(Float64),
        change_percent Nullable(Float64),
        threshold Nullable(Float64),
        is_read UInt8 DEFAULT 0,
        is_dismissed UInt8 DEFAULT 0,
        created_at DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(created_at)
      ORDER BY (user_id, created_at, id)
      PARTITION BY toYYYYMM(created_at)
    `,
  });
  console.log('✅ alerts table created');

  // 2. Create alert_settings table
  console.log('Creating alert_settings table...');
  await client.command({
    query: `
      CREATE TABLE IF NOT EXISTS alert_settings (
        user_id String,
        email_notifications UInt8 DEFAULT 1,
        telegram_notifications UInt8 DEFAULT 0,
        telegram_chat_id Nullable(String),
        daily_digest UInt8 DEFAULT 1,
        digest_time String DEFAULT '09:00',
        monitor_budget UInt8 DEFAULT 1,
        monitor_ctr UInt8 DEFAULT 1,
        monitor_conversions UInt8 DEFAULT 1,
        monitor_cpl UInt8 DEFAULT 1,
        monitor_impressions UInt8 DEFAULT 1,
        budget_threshold Float64 DEFAULT 80,
        ctr_drop_threshold Float64 DEFAULT 30,
        conversions_drop_threshold Float64 DEFAULT 50,
        cpl_increase_threshold Float64 DEFAULT 50,
        impressions_drop_threshold Float64 DEFAULT 50,
        created_at DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(created_at)
      ORDER BY (user_id)
    `,
  });
  console.log('✅ alert_settings table created');

  // 3. Create search_query_analyses table
  console.log('Creating search_query_analyses table...');
  await client.command({
    query: `
      CREATE TABLE IF NOT EXISTS search_query_analyses (
        id UUID,
        connection_id String,
        user_id String,
        date_from Date,
        date_to Date,
        total_queries UInt32,
        target_count UInt32,
        trash_count UInt32,
        review_count UInt32,
        total_cost Float64,
        wasted_cost Float64,
        potential_savings Float64,
        suggested_minus_words String,
        created_at DateTime DEFAULT now()
      ) ENGINE = MergeTree()
      ORDER BY (connection_id, created_at)
      PARTITION BY toYYYYMM(created_at)
    `,
  });
  console.log('✅ search_query_analyses table created');

  // 4. Create telegram_users table
  console.log('Creating telegram_users table...');
  await client.command({
    query: `
      CREATE TABLE IF NOT EXISTS telegram_users (
        id UUID,
        user_id String,
        chat_id String,
        username Nullable(String),
        first_name Nullable(String),
        is_active UInt8 DEFAULT 1,
        created_at DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(created_at)
      ORDER BY (user_id, chat_id)
    `,
  });
  console.log('✅ telegram_users table created');

  console.log('\n🎉 Migration completed successfully!');
  process.exit(0);
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
