# Supabase database migrations

`supabase/migrations/` follows the hosted project's
`supabase_migrations.schema_migrations` history. The files through
`20261018032420_prevent_calc_revision_retry_storm.sql` were recovered from
the SQL stored in that history. A newer file in this directory is pending until
its version appears in the hosted history.

`supabase/legacy-migrations/` preserves the repository's earlier migration
files verbatim. Those files used a separate `public.schema_migrations` table,
and some share a name with hosted migrations while having different SQL or
version numbers. **Never move them back into `supabase/migrations/` or run
them with `supabase db push`.** The old custom runner has been retired.

`supabase/schema.sql` is a historical schema snapshot, not a current export.
The hosted migration history starts after the original database baseline, so
`supabase db reset` cannot yet recreate this project from the canonical
migration files alone. A fresh database needs a separately verified baseline
or a current schema dump. Do not use production as a reset target.

## Forward migrations

Create a new timestamped SQL file with `supabase migration new <name>`.
The direct database endpoint resets connections from this environment. Use
`scripts/supabase-migrations.mjs`, which routes the CLI through the linked
IPv4 session pooler without putting the password in the connection URL.
Enter the existing database password without showing it or saving it in
shell history:

```bash
read -rs 'SUPABASE_DB_PASSWORD?Supabase database password: '; echo
export SUPABASE_DB_PASSWORD
node scripts/supabase-migrations.mjs list
node scripts/supabase-migrations.mjs dry-run
# When the dry run contains only the intended migration:
node scripts/supabase-migrations.mjs push
unset SUPABASE_DB_PASSWORD
```

The dry run should show only the intended pending migration. Never use
`--include-all` to force historical files through.

The CLI's default direct connection returns `ECONNRESET` here even with the
correct password. The passwordless `cli_login_postgres` flow has also failed.
The session pooler connection succeeds. The password is not visible in the
Dashboard after creation; resetting it can interrupt clients using the old
password. Keep credentials out of Git and command output.

If a migration is applied through Supabase's migration API, use the version
recorded by that API for the local filename, and keep its SQL in this
directory. Do not also run it through the retired custom runner.

The legacy files and snapshot are retained for audit and recovery. Existing
references to old file paths should point to `legacy-migrations/`.
