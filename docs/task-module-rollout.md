# 课程任务与容量规划：交付及上线操作

2026-10-30：本分支为本地验收、待审查状态。远程数据库迁移、Cron 安装、百度实际扫描/上传、推送、合并和部署均未执行。下列远程操作必须由维护者另行授权；本文件不是执行记录。

## 兼容与映射

| 原数据 | 新表示与保留策略 |
| --- | --- |
| task_templates | 同表作为任务池，activity_key 为 legacy:UUID；原策略不重写。旧课程专用模板及原同学科匹配范围一次性回填 task_course_pool_bindings，以后只认显式绑定。weekly/once 保持个人独立任务。 |
| task_course_occurrences.confirmation | 原行保留；同 UUID 课程事件保留 rule/occurrence、日期、confirmation JSON 与课文快照。confirmed 映射 assigned/completed；历史未记录的完成时间保持 NULL。 |
| 旧任务完成/清单 | 原 ID/source_key/实例快照保留；完成映射 100%，checklist 转 items，逐项 done/href/顺序保留。后续估计和名称编辑不清空旧完成状态；内容修订另存历史。 |
| 旧课程材料、私人录音 | 不自动发布到共享库，继续 `/tasks/materials` 与原 task-audio 私有访问。共享 material_assets 与用户自己的 course_material_links 是独立模型。 |
| 无内容目录或不明课次 | 保留原数据并提示待配置，不猜教材/课文/例题。缺失目录、教学段、题目、物料均保持诊断，不能当零负荷。 |

旧 `/tasks/templates` 进入任务池；旧确认入口委托同一事件运行时，不再另建发任务路径；旧 backfill 明确报 use_explicit_course_events，使用显式课程事件修订。未来规则转换保留历史，source 与 progression_mode 分离；只有显式 completes_lesson 的教学段完结才进入下一课，缺段停住等待修复。

映射统计必须针对获授权目标保存迁移前后快照，至少报告：模板总量/可绑定数量、实际绑定数量、旧确认/新事件对照数量、旧实例及已完成数量、清单 done 数、旧材料/私人录音数量、目录缺失/待配置清单。不得把本地合成用户数量当生产统计。可在授权的只读 SQL 会话按 user_id 比较：

```sql
select user_id, count(*) templates from public.task_templates group by user_id;
select user_id, count(*) bindings from public.task_course_pool_bindings group by user_id;
select user_id, count(*) events, count(*) filter(where legacy_confirmation is not null) legacy_confirmations
from public.task_course_events group by user_id;
select user_id, count(*) tasks, count(*) filter(where status='completed') completed
from public.task_instances group by user_id;
```

对未关联课程、目录 key 失效、孤立资源逐行导出待配置清单；禁止删除或用“全部适用”掩盖缺口。

## 分阶段启用（尚未执行）

1. 备份目标数据、保存版本和映射统计。在独立目标先完整演练兼容读写；本地 recipe 见下节。不要用残缺迁移历史 reset。
2. 明确授权后在仓库运行 `node scripts/supabase-migrations.mjs list`，再 `dry-run`。检查仅有本次已审查迁移及必要已知前置，才允许另行授权 `push`。不使用 `--include-all`。本次没有运行这些远程命令。
3. 数据与兼容 RPC 就绪后启用新界面，配置课程目录、显式池绑定、自动分配/推进、课程截止、物料与人工时间窗口。检查四种自动开关组合、新用户初始化、旧确认及模板链接。
4. 生成运行时迁移会在已安装 pg_cron 的目标安装 `tasks-background-generation` 每分钟数据库作业；没有扩展时仅页面 task_tick 补偿，不能宣称关闭网站生成。任务运行状态通过 task_runtime_status 报告。
5. 容量后台另需 pg_cron、pg_net、Vault；服务端 TASK_PLANNING_CRON_SECRET 与 Vault task_planning_cron_secret 一致，task_planning_url 指向完整 HTTPS `/api/internal/task-planning/recompute`。授权后由特权运维执行 `select private.task_install_planning_cron()`；迁移不会执行此安装。不能向客户端提供密钥。
6. 观察 cron.job_run_details、HTTP 回执和 task_planning_jobs/snapshots；从关闭所有页面开始，确认新任务/新预测真正持久化，再验证重新打开后状态。仅“作业存在”不证明送达。提醒只在站内，无系统推送。

## 停用与恢复

- 停止后台：经授权特权会话 `select cron.unschedule(jobid) from cron.job where jobname in ('tasks-background-generation','tasks-planning-recompute')`。生成的 private.task_runtime_config 也应设置 cron_enabled=false/detail 为实际停用原因，避免旧配置状态误导。
- 停 Cron 不会阻止页面 task_tick；需要停止某课程自动发放/推进时用课程配置分别关闭 auto_assign/auto_advance。要彻底停服请维护入口/服务访问，不删除历史表或回退到会重复发放的旧客户端。
- 预测故障：页面显示过期/未知且禁止采用；恢复依赖后通过 `/api/tasks/planning` 的认证 POST 请求当前用户重算。中断 lease 两分钟后可回收；失败采用 20 秒起上限 2560 秒退避。不要复活旧 lease 或手写安全指标。
- 采用只认最新服务端实际任务分配；原子校验 owner/shared revision、时间、容量、重叠和截止。冲突须刷新重选，不自动接受。
- 超期任务保留原 due_at；显式 recovery_due_at 是另一目标。无显式目标建议上海当天 23:59，过窗口保持诊断。不把时间流逝当作完成；未定期欠账保持未知，固定块只约束对应已承诺部分。
- 回滚应用前先停自动执行并保存快照；优先修复向前迁移。禁止删迁移历史/历史事件，禁止生产 reset。

## 本地验证与边界

`node scripts/tmp/task15-acceptance-validation.mjs` 使用 `/private/tmp/task4-postgres/node_modules` embedded-postgres，127.0.0.1:55455，独立可销毁数据库；需本地已安装该依赖。完整安装 25 个相关迁移，执行 SQL 权限/兼容/进度/物料/窗口/租约/恢复/采用套件，真实 MVCC 快照经过应用 canonical builder/solver 并发布、读回、采用和恢复。`--intentional-failure` 应在清理连接与集群后退出 1。临时 harness 不读 env，不连接远程。

本地 builder/solver/SQL 结果可交给实际 PlanningDashboard 组件验证视图。合成身份直接设置 auth.uid，因此不证明真实登录、托管调度、真实百度权限与吞吐；小规模运行时间不代表生产负载。未定期、零容量、物料缺失、周末和过期方案必须保持同一结果贯穿风险与甘特图。历史 focused tests、最终命令和限制记录在 Task15 报告，最终上线仍需上述受控目标验收。

最终本地gate（2026-10-30）：root lint/typecheck exit0（继承warnings保留）；完整web Vitest127文件897测试；独立env排除且独立依赖副本 `pnpm build` exit0，122静态页。1472 runtime文件hash逐一一致。真实浏览器关键采纳/恢复按钮通过合成身份本地SQL adapter完成持久化；3课程15需求/12forecast/28窗口计算约1393ms（仅builder、双策略与risks，排除模块加载/SQL），不是生产规模性能证明。

Legacy迁移前合成seed统计：template1→binding1，confirmation1→event1，completed1保留100%/逐项done，private-material1保留且shared0。此数字仅测试库，不是远程用户统计。

## Final integration scope (2026-10-30)

Planning freezes a nominal release cohort of at least28 days, extended for known actual deadlines
and each course’s next homework deadline, capped at180 days. It then closes that cohort’s known
crossing deadlines (also capped at180) and admits all otherwise eligible forecast work due by the
final analysis end, including competing extension-period work. Admission does not recursively
extend for later recurring releases. `release_cohort_end` and `horizon_end` record the two bounds.
Later nonadmitted work produces visible advisory `forecast_boundary` notices; missing inputs and
admitted deadlines beyond the cap remain incomplete. Headroom and risk describe only this finite
modeled scope, never all future work.

Actual selected material IDs stay frozen. The application adapter checks their current catalog
availability; pending/missing/account-mismatched assets retain estimated work but make its certainty
incomplete. The service snapshot also reports `current_available` using the verified current
Baidu account, allowing archived-but-readable references while rejecting archived assets of an old
account. Credential changes increment the shared planning epoch; no selection/history rewrite occurs.
