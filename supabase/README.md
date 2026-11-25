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

## Vocabulary assessment

`20261118103008_vocabulary_assessments.sql` was applied to the hosted project on
2026-11-18. The version matches the Supabase migration API record. Both tables
have RLS enabled and are accessible through the service role. Reviewed banks
are published separately with the [assessment workflow](../packages/english/SHARED-VOCABULARY.md#词汇量测评).

Hosted migration `20261119033956_vocabulary_assessment_open_versions.sql` allows one
open attempt per user and model version. Remote read-back confirmed the partial unique
index is valid and the former user-only index has been removed.

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

`20261119121511_exam_listening_directory.sql` was applied to the hosted project on
2026-11-19 via the connected migration API. Read-back confirmed the draft directory column,
foreign keys for audio bookmarks, RLS on the private references table, and service-role
execution of `save_exam_listening_directory`.


`20261121173749_exam_live_edits.sql` was applied to `rosie-tokyo` on 2026-11-22
(Asia/Shanghai) through the Supabase migration API. Read-back confirmed the
publication guard, the private receipt table with RLS, and service-only exam
RPC access. Test 1 revision 2 remains a draft with its five existing listening
bindings. The administrator saves the bindings and publishes the paper separately.

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

## Homework migration reconciliation (2026-11-15)

Applied through the connected migration API to `yvukypevtqblhjdhkatb`:
- `20261115104319_task_homework_include_weekends.sql`: preserves existing rows as true, defaults new rows to false.
- `20261115104405_apply_task_practice_presets.sql`: installs the missing owner-scoped, security-invoker preset function.

Local filenames match remote history; both migrations notify PostgREST to reload its schema.
Read-back confirmed the non-null boolean/default and authenticated-only preset execution.
Progression mode, quantity and grouped snapshots use existing JSON fields and need no further migration.
The unrelated historical `20261018040000_fold_calc_report_into_settlement.sql` remains pending.
No application build or tests were run.

`20261119140300_task_homework_zero_minutes.sql` was applied to the hosted project on
2026-11-19 via the connected migration API. Read-back confirmed the migration version and
the validated `task_homework_estimated_minutes_check` constraint allowing 0–120 minutes.

## Course priority

`20261125035931_task_course_priority.sql` was applied to `rosie-tokyo` on 2026-11-25
via the connected migration API. Read-back confirmed the P2 default, the validated
P0–P4 constraint, authenticated access to the owner-checked priority RPC, and
priority handling in the course save and semester copy functions.

## Life-tree tomato wallet and diary

`20261120012236_time_tree_shared_reward_wheel.sql` was applied to the hosted project on
2026-11-20. The life-tree box draw uses the shared enabled reward pool and stores the
frozen wheel in the prize receipt. Read-back confirmed the migration and service-only
execution of `read_time_tree_box_wheel`, including an empty pool response.

Applied in order via the connected migration API to `yvukypevtqblhjdhkatb` on
2026-11-18 (Asia/Shanghai). Local filenames match the remote history:

- `20261117204418_time_tree_tomato_wallet.sql` charges a tomato blind-box draw in the prize-reservation transaction.
- `20261117204428_time_tree_tomato_diary.sql` records the draw in the tomato diary in that transaction.

Read-back confirmed both versions and that the updated `commit_time_tree` retains service-role-only execution.

`20261117210030_time_tree_tomato_prices.sql` is also applied. The draw reads the active
blind-box price from the garden rules in the same transaction. Read-back confirmed the
price lookup, spending record and service-role-only execution.

## Shared English vocabulary

Applied via the connected migration API on 2026-11-18 (Asia/Shanghai):

- `20261118045218_shared_english_vocabulary.sql`
- `20261118045414_shared_english_vocabulary_progress.sql`

Read-back confirmed the original 6,032 position IDs, 6,029 active positions,
4,013 canonical headwords, and all 486 legacy mastery rows. Replay examined
841 adaptive word logs and produced 477 answer receipts and 119 spelling
progress rows. The current Web release retains its existing RLS-governed
catalog insert/update grants until the Web cutover. The FCE import and
application build/runtime acceptance remain separate. See
[the migration and import guide](../packages/english/SHARED-VOCABULARY.md).

## Database backups

The scheduled backup exports the hosted database and verifies its compressed
archive in Baidu Netdisk. See [backup setup and recovery](backup.md).

## Project files

The project media cutover moves project assets and private recordings to Baidu Netdisk.
See [project file storage](../docs/project-file-storage.md) for the source
inventory, resumable copy, and production cleanup steps.

## 电影剧场

`20261124064230_english_theater.sql` 已应用到 Rosie Web 使用的 `rosie-tokyo`
项目。迁移记录、三张表的行级安全和进度保存 RPC 已核对。影片和字幕继续存于
百度网盘，Supabase 保存文件绑定和个人学习记录。

`20261124084211_theater_video_formats.sql` 已应用到 `rosie-tokyo`。绑定记录接受
MP4、MKV 和 RMVB，播放副本可记录文件 ID、名称及指纹。迁移历史与三个约束均已核对，
实际网盘转码与浏览器播放待手动验收。

`20261124091000_theater_media_directories.sql` 已应用到 `rosie-tokyo`。按共享百度
账号保存剧场媒体目录，使用授权目录 ID 和并发版本。已核对迁移记录、行级安全、
仅服务端的读写权限，以及授权目录删除后级联清理设置的外键。

`20261124095602_theater_subtitle_revisions.sql` 已应用到 `rosie-tokyo`。远端已核对迁移记录、
待同步批次唯一索引、历史索引、行级安全以及服务角色的表和同步确认函数权限。
同步完成后将字幕绑定更新和修订归档写入同一事务。

## 离线学习结算

`20261124070850_offline_learning_settlement.sql` 已应用到 `rosie-tokyo`。
数学练习和英语周计划通过账号内唯一的操作编号补传，提交与回执在同一事务保存。
远端已核对迁移记录、私有回执表的行级安全，以及两个结算 RPC 的登录角色权限。
匿名角色没有结算权限，浏览器角色不能读取回执表。

`20261124072851_theater_subtitle_jobs.sql` 已应用到 `rosie-tokyo`。迁移记录、
任务表的行级安全、仅服务端读取权限、任务领取函数和 Cron 注册已核对。
电影剧场找不到可用字幕时排入百炼原声转写，完成后把 SRT 保存至影片所在网盘目录。

已部署的服务通过 `THEATER_SUBTITLE_WORKER_ORIGIN`、`NEXT_PUBLIC_APP_URL`
或 Vercel 生产域名取得公开 HTTPS 地址，首次排队时由服务端登记后台地址。
异步转写复用百炼配置，也可用 `THEATER_ASR_BASE_URL` 和
`THEATER_ASR_API_KEY` 单独配置。实际影片转写待验收。
