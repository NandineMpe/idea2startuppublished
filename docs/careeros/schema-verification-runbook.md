# CareerOS Schema Verification Runbook (Partition-Aware)

Use this runbook to verify the deployed `careeros` schema matches the locked design decisions.

## Query 1 — Schema and table inventory (core tables only)

`generation_runs` monthly partitions are physical child tables, so they appear in
`information_schema.tables` as base tables. Exclude inherited child tables from
the inventory count to keep the expected total stable.

```sql
SELECT t.table_name
FROM information_schema.tables t
LEFT JOIN pg_class c
  ON c.relname = t.table_name
LEFT JOIN pg_namespace n
  ON n.oid = c.relnamespace
LEFT JOIN pg_inherits i
  ON i.inhrelid = c.oid
WHERE t.table_schema = 'careeros'
  AND t.table_type = 'BASE TABLE'
  AND n.nspname = 'careeros'
  AND i.inhrelid IS NULL
ORDER BY t.table_name;
```

Expected with current locked schema: **27 rows**.

## Query 2 — Partition children of generation_runs

Use this separately to confirm monthly partitioning:

```sql
SELECT inhrelid::regclass AS partition_name
FROM pg_inherits
WHERE inhparent = 'careeros.generation_runs'::regclass
ORDER BY inhrelid::regclass::text;
```
