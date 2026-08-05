# Database schema & migrations

Single source of truth for the Rosie Supabase (Postgres) schema. Before this
folder existed, schema SQL was scattered across `packages/*/sql/`, a gitignored
`docs/sql/` mirror, and `scripts/`, with **no run order, no applied-log, and no
way to rebuild a fresh database**. This folder fixes that.

## Layout

```
supabase/
  schema.sql              # full-schema snapshot (pg_dump --schema-only). The
                          # "rebuild truth": one file recreates an empty DB.
  migrations/
    0001_baseline.sql     # frozen baseline == schema.sql at consolidation time
    0002_*.sql            # every change AFTER the baseline, in filename order
  README.md               # this file
```

`scripts/apply-migrations.mjs` is the forward-only runner. Applied versions are
tracked in `public.schema_migrations`.

## Golden rules

1. **Never edit an applied migration.** Add a new higher-numbered file.
2. **New schema change → new `migrations/NNNN_name.sql`** (zero-padded, next
   number). Prefer idempotent DDL (`... IF NOT EXISTS`, `ADD COLUMN IF NOT
   EXISTS`). Follow `.cursor/rules/sql-no-destructive-data-ops.mdc`: no
   `DROP`/`TRUNCATE`/`DELETE` unless the change is explicitly a cleanup.
3. **Data seeds are not migrations.** Content loads (word `*-upsert.sql`,
   `add_chinese_def.sql`, etc.) stay in their existing per-stage locations and
   are run manually — they are not applied by the runner.
4. **`DATABASE_URL` never gets committed.** It is a Postgres URI (session pooler
   or direct), not the anon/service key. Pass it inline per command.

## Historical SQL (frozen, do not move)

The old scripts under `packages/*/sql/` and the gitignored `docs/sql/` mirror are
**already applied to prod and fully captured by `0001_baseline.sql`**. They are
left in place ONLY because several admin UI hint strings reference their paths
(e.g. `MathLessonIdAuditPage.tsx`, adaptive-plan error messages). Do not move or
delete them without updating those strings. Do not use them to rebuild — use the
baseline.

## Common tasks

Get the connection URI from the Supabase dashboard → top-bar **Connect** →
Session pooler. `psql`/`pg_dump` come from `brew install libpq`
(`/opt/homebrew/opt/libpq/bin`). URL-encode special chars in the password
(`@` → `%40`).

```bash
export DATABASE_URL='postgresql://postgres.<ref>:<pw>@aws-...pooler.supabase.com:5432/postgres'

# See what is applied vs pending
node scripts/apply-migrations.mjs status

# Apply pending migrations (each in its own transaction)
node scripts/apply-migrations.mjs up

# ONE-TIME on the existing prod DB: mark all current files applied without
# running them, so `up` never re-runs the baseline.
node scripts/apply-migrations.mjs baseline
```

### Add a new migration

```bash
# create the next file, e.g.
printf -- '-- add foo column\nALTER TABLE public.calc_settings ADD COLUMN IF NOT EXISTS foo int;\n' \
  > supabase/migrations/0002_calc_settings_foo.sql
node scripts/apply-migrations.mjs up
```

### Refresh the snapshot after schema changes

Keep `schema.sql` current so a fresh rebuild stays one-shot:

```bash
/opt/homebrew/opt/libpq/bin/pg_dump --schema-only --no-owner --no-privileges \
  --schema=public "$DATABASE_URL" \
  | grep -vE '^\\(un)?restrict ' > supabase/schema.sql
```

### Rebuild an empty database from scratch

```bash
psql "$EMPTY_DB_URL" -v ON_ERROR_STOP=1 -f supabase/schema.sql
# then load the data seeds you need (per-stage upsert scripts)
```
