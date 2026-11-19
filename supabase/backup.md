# Rosie 数据库备份

已在 [私有备份仓库](https://github.com/kaqiinono/rosie-supabase-backup) 发布工作流。
当前等候生产备份账号授权，定时运行尚未开启。

GitHub Actions 工作流 `Supabase backup to Baidu` 每天北京时间 03:17 导出 Rosie 的
Supabase 数据库，也支持手动运行。10:43 查找近 30 小时内通过上传校验的备份。
工作流失败通知使用 GitHub Actions 的仓库通知。定时工作流依赖 GitHub 调度。

百度网盘目标为 `/airosie/backup/supabase`。备份文件是未加密的
`rosie-supabase-<UTC 时间>-<随机后缀>.tar.gz`，包含儿童学习记录、账户数据和服务端授权数据。
仅将该文件夹留在有权限的百度网盘账号内。工作流不发布数据库文件为 Actions Artifact。
临时备份目录在运行结束后移除。

## 配置

在独立的私有备份仓库的 **Settings → Secrets and variables → Actions** 配置：

| 类型 | 名称 | 值 |
| --- | --- | --- |
| Variable | `SUPABASE_BACKUP_POOLER_URL` | Supavisor Session pooler 的无密码 URL，端口 5432，用户名格式为 `rosie_backup.<项目引用>` |
| Secret | `SUPABASE_BACKUP_DB_PASSWORD` | 专用数据库导出账号密码 |
| Secret | `SUPABASE_SERVICE_ROLE_KEY` | Rosie 项目的 Supabase 服务端密钥 |
| Secret | `BAIDU_APP_KEY`、`BAIDU_SECRET_KEY` | Rosie 共享百度网盘应用的服务端凭据 |

凭据配置完成后，将仓库变量 `ROSIE_BACKUPS_ENABLED` 设为 `true`，再在默认分支启用备份。备份任务通过现有共享百度授权访问目标目录，
采用与站点相同的续期锁和版本检查，因此可以独立于 Rosie 网站运行。
若百度授权失败或续期结果不确定，在 Rosie「同步管理」重新授权后再次运行。
在 GitHub 设置中为该仓库开启失败通知。

每次备份使用 PostgreSQL 17 客户端做逻辑导出，额外保存迁移历史、受管理 schema 的结构参考、
Vault 加密数据及各文件 SHA-256。备份脚本会从网盘读回归档核对 SHA-256，
通过后写入同名 `.sha256` 回执，再清理超过 30 天且符合备份命名格式的文件。
读取中断不会生成成功回执。Supabase Storage 当前没有对象，百度网盘原有媒体仍在其各自目录。

## 首次恢复验收

在工作流页面手动运行一次，确认网盘出现归档及其 SHA-256 回执。
下载后校验归档、解压，并按归档内 `manifest.json` 校验各部分。
用一个独立的 Supabase 项目演练恢复，避免任何线上回调或定时任务在演练中启动：

1. 用 `roles-reference.sql` 还原应用所需的自定义角色，再按 Supabase 官方指南恢复应用 schema、数据和迁移历史。目标项目自身的系统角色及备份导出角色由目标环境配置。
   `auth-schema-reference.sql` 和 `storage-schema-reference.sql` 用于查找需补回的
   自定义对象，目标项目先由 Supabase 创建受管理的基础结构。
2. 在演练项目配置 Auth、扩展和其他平台设置。如果 Vault 实际保存了秘密，
   按 Supabase 官方方式迁移根密钥，或用独立保存的值重新设置。
   检查网盘回调及授权，必要时在新项目重新授权。
3. 用测试端验证 Rosie 登录、学习记录与词库读写、考试记录、网盘绑定。
   只有这一轮通过后，才把自动备份视为可恢复。

官方参考：[自动备份](https://supabase.com/docs/guides/deployment/ci/backups)、
[逻辑恢复](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)。
