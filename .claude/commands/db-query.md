---
description: Execute ClickHouse query on production database
---

# ClickHouse Query

Execute a query against the production ClickHouse database.

## Usage

Run the provided query on production ClickHouse:

```bash
sshpass -p 'c9R+eLvxtQJ-,x' ssh -o StrictHostKeyChecking=no root@91.222.239.217 "docker exec neurodirectolog-clickhouse clickhouse-client --query \"$ARGUMENTS\""
```

## Common Queries

### List tables
```sql
SHOW TABLES FROM neurodirectolog
```

### Check users
```sql
SELECT id, email, name, is_admin FROM neurodirectolog.users
```

### Check connections
```sql
SELECT id, user_id, project_id, login, status FROM neurodirectolog.yandex_direct_connections
```

### Table row counts
```sql
SELECT 'campaigns' as tbl, count() FROM neurodirectolog.campaigns
UNION ALL
SELECT 'campaign_performance', count() FROM neurodirectolog.campaign_performance
```

### Describe table
```sql
DESCRIBE neurodirectolog.table_name
```

## Arguments
$ARGUMENTS - The SQL query to execute (required)
