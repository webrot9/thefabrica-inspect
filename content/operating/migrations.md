---
title: "Changing the schema safely"
description: "Safety classes and expand-contract playbooks for production changes."
fabrica_documentation_source: "1ee1bc9cb6619c19f57766731e7884b37f515dc9"
fabrica_product_version: "thefabrica-v0.1.2"
---

<!-- GENERATED FILE — DO NOT EDIT.
     Produced from The Fabrica v0.1.2 by its
     documentation exporter, which lives in the private repository.
     Edit the source there instead. -->

# Changing the schema safely

> Applies to **The Fabrica v0.1.2**. Documentation source: `1ee1bc9cb661`, including post-release documentation corrections.

Most database changes are safe (adding nullable columns, adding tables,
adding indexes CONCURRENTLY). A few categories are dangerous and need
a multi-step playbook.

## Migration safety classes

| Class | Examples | Posture |
|--|--|--|
| **GREEN** — instant + safe | ADD TABLE; ADD nullable COLUMN; CREATE INDEX CONCURRENTLY | Apply via single migration. |
| **YELLOW** — locks briefly | ADD NOT NULL with `server_default`; ADD UNIQUE on small table; DROP unused INDEX | Apply during low-traffic window. |
| **RED** — locks long or rewrites | ADD NOT NULL without default; CHANGE TYPE; RENAME COLUMN in use; ADD FK on large table | Multi-step (see playbooks below). |

When in doubt, treat as RED.

## Always-on rules

1. **Never** `ALTER TABLE ... ADD COLUMN ... NOT NULL` without `server_default` on tables > 10k rows — locks the table for the full backfill.
2. **Never** `ALTER TABLE ... DROP COLUMN` in the same release as the code that stopped writing to it. Wait one release minimum.
3. **Never** `RENAME COLUMN` on a live table. Add new + dual-write + migrate + drop old.
4. **Always** `CREATE INDEX CONCURRENTLY` on tables > 100k rows. Standard CREATE INDEX locks writes.
5. **Always** test the migration on a recent prod snapshot, not just an empty dev DB.

## Playbook: add a NOT NULL column to a large table

Wrong way (locks table for minutes-hours):
```python
op.add_column("users", sa.Column("region", sa.String(2), nullable=False))
```

Right way — 3 migrations across 3 releases:

### Release N — add nullable

```python
def upgrade():
    op.add_column("users", sa.Column("region", sa.String(2), nullable=True))
```

Ship + deploy. App writes to BOTH old + new column.

### Release N — backfill (async)

```python
def upgrade():
    op.execute("UPDATE users SET region = 'US' WHERE region IS NULL")
    # For LARGE tables (>1M rows), use a chunked backfill in a Celery
    # task instead — keeps the migration fast.
```

### Release N+1 — flip to NOT NULL

```python
def upgrade():
    op.alter_column("users", "region", nullable=False)
    # By now every row has a value. The alter is fast (just a constraint check).
```

Three releases. Boring. Safe.

## Playbook: rename a column

There is no atomic SQL "rename column safely in production". Decompose:

### Release N — add new column + dual-write

```python
def upgrade():
    op.add_column("users", sa.Column("display_name", sa.String(200), nullable=True))
```

Update app code to write BOTH `name` and `display_name`. Reads still
from `name`.

### Release N+1 — backfill + swap reads

```python
def upgrade():
    op.execute("UPDATE users SET display_name = name WHERE display_name IS NULL")
```

Update app code: reads switch to `display_name`. Writes still to BOTH.

### Release N+2 — drop old

```python
def upgrade():
    op.drop_column("users", "name")
```

Update app code: drop the dual-write.

## Playbook: add foreign key on a large table

The constraint check is a table scan. Without `NOT VALID`, the table
is locked until the scan completes.

```python
def upgrade():
    # Phase 1: create the constraint without validating existing rows.
    op.execute(
        "ALTER TABLE orders "
        "ADD CONSTRAINT fk_orders_user_id "
        "FOREIGN KEY (user_id) REFERENCES users(id) "
        "NOT VALID"
    )
    # Phase 2: validate in a separate migration (or Celery task).
    # Validation acquires a SHARE UPDATE EXCLUSIVE lock — concurrent
    # writes can still happen.
    op.execute("ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_user_id")
```

## Playbook: drop a table

Same as rename — never in one release. Stop writes, wait one release,
verify nothing breaks, then drop.

```python
# Release N: app stops writing to legacy_table.
# Release N+1: drop.
def upgrade():
    op.drop_table("legacy_table")
```

If you panic mid-release, recovery is trivial: revert the app code
that stopped writing. The table is still there.

## Playbook: change column type

The hard one. `ALTER COLUMN ... TYPE` rewrites the column → table
lock + huge WAL volume.

### For type widenings that Postgres handles natively (VARCHAR(50) → VARCHAR(200))

```python
op.alter_column("users", "name", type_=sa.String(200))
```

Postgres knows it's a no-op rewrite for VARCHAR-widen. Safe.

### For real type changes (INT → BIGINT, TEXT → JSONB, …)

Add new column + dual-write + backfill + swap + drop old. Same as
the rename playbook.

## Always check before deploy

```bash
# Show pending migrations
uv run alembic current
uv run alembic history --indicate-current

# Dry-run SQL (most safety reviews start here)
uv run alembic upgrade head --sql > pending.sql
cat pending.sql

# Look for these red flags in pending.sql:
#   - ALTER TABLE ... DROP COLUMN
#   - ALTER TABLE ... ALTER COLUMN ... SET NOT NULL  (without server_default)
#   - ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY  (without NOT VALID)
#   - DROP TABLE
#   - DROP INDEX (non-CONCURRENT)
#   - CREATE UNIQUE INDEX (non-CONCURRENT, on a big table)
```

If any red flag appears + table has > 10k rows, switch to the
multi-step playbook above.

## Postgres-specific safety

### Statement timeout

Set a per-migration statement timeout to fail fast if a migration
locks the table beyond expectations:

```python
def upgrade():
    op.execute("SET LOCAL statement_timeout = '30s'")
    op.add_column("users", sa.Column("region", sa.String(2), nullable=True))
```

A 30-second wait is acceptable. A 30-minute wait is downtime.

### Lock timeout (separate from statement timeout)

When you only worry about waiting for a lock (not the operation itself):

```python
op.execute("SET LOCAL lock_timeout = '5s'")
```

Fails after 5 seconds of waiting for a lock instead of hanging.

### Index creation — CONCURRENTLY

```python
def upgrade():
    # Standard create — LOCKS table writes for the duration.
    # op.create_index("ix_users_email", "users", ["email"])

    # Concurrent — does NOT lock writes. Slower but safe online.
    op.execute(
        "CREATE INDEX CONCURRENTLY ix_users_email ON users (email)"
    )
```

**Catch**: CONCURRENTLY can't run inside a transaction. In Alembic
that means setting `transaction_per_migration = True` in env.py (the
factory does this) OR using `op.execute` + ensuring the migration
file has `from alembic import op; op.run_async = False`.

## Rollback strategy

Every Alembic migration has a `downgrade()`. The factory's templates
generate them automatically.

**But**: downgrade only un-does the SCHEMA. Data inserted while the
new schema was active is your problem.

Posture:
- For GREEN migrations: rollback is trivial. Run `alembic downgrade -1`.
- For YELLOW: rollback works but you may lose data. Take a snapshot first.
- For RED multi-step: rollback the LAST step only. Don't try to
  rollback all 3 steps at once — the dual-write code is gone.

Always take a Postgres backup before any RED migration:
```bash
fly postgres backups create gtm-strategist-db
```

## When the migration fails mid-flight

```
sqlalchemy.exc.OperationalError: deadlock detected
```

or

```
canceling statement due to lock timeout
```

1. **Don't panic** — Alembic wraps each migration in a transaction.
   Failed migration = no schema change applied.
2. Check `alembic current` — should show the pre-migration revision.
3. Identify the blocker query:
   ```sql
   SELECT pid, age(clock_timestamp(), query_start), usename, query
     FROM pg_stat_activity
    WHERE state != 'idle' AND query NOT LIKE '%pg_stat_activity%'
    ORDER BY query_start asc;
   ```
4. Kill blocker if safe: `SELECT pg_cancel_backend(<pid>);`
5. Re-run migration.

If your migration uses `op.execute("SET LOCAL statement_timeout=...")`,
the failure is graceful and you see the error in the deploy log.

---

**Provenance.** Documentation source: `1ee1bc9cb6619c19f57766731e7884b37f515dc9` (`main`).

Extracted from `docs/migrations/safe-migrations.md`.

That commit is later than the release these pages describe: it carries documentation corrections made after `thefabrica-v0.1.2` went out. Nothing that changes how the product behaves landed between the two — the exporter refuses to name a product version otherwise.
