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

## 课程/任务池/共享物料与容量交付（2026-10-30）

2026-10-31：20 个任务/物料前向迁移已应用到关联 Supabase 项目，任务生成 Cron 已安装并有成功运行记录；容量规划 HTTP Cron、百度真实写入与应用部署未执行。上线、映射统计、停用和恢复清单见 `docs/task-module-rollout.md`，物料权限与传输见 `docs/baidu-materials.md`。任务不回写原学科进度或 `/today`；tasks 仅依赖 core/player，materials 仅依赖 core，应用层桥接目录/物料。旧个人材料和录音不会自动共享。

最终本地验收使用 `node scripts/tmp/task15-acceptance-validation.mjs`（24个相关迁移、全部SQL fixtures、真实MVCC快照与canonical builder/solver发布/采用/恢复）；`--intentional-failure` 清理后应退出1。该临时工具使用独立本机 PostgreSQL，不读 env。`--serve` 提供127.0.0.1:3915的合成身份测试adapter，只供本地验收，不是生产Auth/API。运行时状态须区分未配置、过期与已配置但未证实送达。严禁依据本地测试宣称托管Cron已启用。
