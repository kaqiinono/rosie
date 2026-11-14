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

## Exam migrations

The seven exam migrations were applied on 2026-11-13 after explicit user authorization,
using the connected Supabase migration API for project `yvukypevtqblhjdhkatb`.
Local filenames now match its recorded versions (`20261113092029` through
`20261113092155`); see [environment record](../docs/exams-environment-status.md).
The initial media migration failed transactionally and was corrected before successful
application. Do not rerun the superseded local version numbers.

The private recording bucket is created. Two full papers and two Trainer training bundles
are imported as drafts with private solutions. Media remains unbound, nothing is published, and no
application build/test suite has been run. `exams_private` must remain outside the exposed
Data API schemas. Browser roles have no direct access to exam tables/RPCs; application
requests use the independently authenticated service adapters.

The image workbench subsequently applied `20261113100647_exams_image_crop_jobs.sql`
and `20261113101051_exams_image_source_storage_boundary.sql`. Fourteen temporary original
pages are uploaded to private `exam-image-sources`; no finished crop is pre-approved by
this setup. Task deletion preserves electronic questions and finished media bindings.
See [image workbench](../docs/exams-image-workbench.md) for cleanup and manual acceptance.

`20261113111944_exams_image_task_reviews.sql` is also applied. It adds service-only human
review marks for image task cards, scoped to the exact bound file and guarded against
concurrent replacement/review edits. Automated crop preparation and these visual-review
marks remain separate from formal paper review/publication.

The permission SQL files under `supabase/tests/` remain manual test definitions;
metadata reads after migration do not substitute for their full behavioral assertions.

`20261113163105_exams_sentence_annotations.sql` is applied. The original unapplied
20261113153000 file was moved to this CLI-generated forward version. The existing
migration script ran from an isolated directory containing only applied history
and this migration; dry-run and push included only this file, without `--include-all`.
Remote history and `exam_sentence_annotations_ready() = true` were confirmed by
read-only queries. Unrelated pending migration 20261018040000 was not applied.
No application build or tests were run during the annotation migration; formal handwriting status follows below.

`20261113170244_exams_handwriting_assessment.sql` is an **applied** forward
migration for approved formal handwriting. It adds private append-only assessment
history, a bounded-stroke trigger and service-only grading/readiness RPCs. The app
keeps keyboard-only input until `exam_handwriting_ready()` is available. Do not push
unrelated pending migrations together; inspect the list/dry-run before application.

The user explicitly authorized this handwriting migration. The existing script's
dry-run and push ran from an isolated directory with only applied history plus
20261113170244; no `--include-all`, seeds or roles were used. Remote history and
`exam_handwriting_ready() = true` were read back successfully. Pending migration
20261018040000 remains unapplied. Receipt: `output/exams/rendering-upgrade/handwriting-migration-receipt.json`.
The demo route is preserved. Application build/tests and browser acceptance were not run.

## Lucky wheel workshop

`20261114122234_draw_wheel_workshop.sql` was applied via the connected Supabase
migration API to project `yvukypevtqblhjdhkatb` after explicit user authorization.
The local filename matches the recorded remote version. Only this migration was
applied; unrelated pending migrations were not included. Remote history and the
service-only workshop RPC permissions were read back. No application build/tests ran.

The user also authorized automatic execution of future task-required data migrations;
see the standing migration preference in root AGENTS.md. Inspect the exact scope and
remote history, apply the task's migration, and verify it without delegating execution
back to the user.
