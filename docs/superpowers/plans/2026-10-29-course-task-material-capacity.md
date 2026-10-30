> 2026-10-30 实施结案补充（优先于下文历史规划状态）：Tasks1–14已按逐项审查实施，Task15本地最终验收；远程迁移、Cron安装、真实百度写入、push/merge/deploy均未执行。历史“只交付文档/未运行”描述是原批准时状态，不是当前实现结论。

# 课程任务、统一物料与课程时间预测 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有课程体系中完成任务自动生成、物料关联、执行进度及课程截止风险预测，明确每门课程是否需要占用手动标记的周末备用时间。

**Architecture:** 沿用现有任务表、课程编辑和应用层学科适配器，新增学习事件、任务池绑定、共享资产和规划快照。数据库 Cron 负责幂等生成，纯 TypeScript 规划器由客户端预览与服务端 worker 共用；所有课程竞争同一份时间容量，界面按课程批次汇总并用甘特图展示。

**Tech Stack:** pnpm/Turborepo、Next.js 15、React 19、TypeScript、Tailwind v4、Supabase Postgres/RLS/Cron/pg_net/Vault、百度网盘 OAuth/文件接口、现有 Vitest。首版不引入额外状态库或甘特图付费组件。

**Spec:** [整合设计](../specs/2026-10-29-course-task-material-capacity-design.md)。执行者先读设计，再按本计划实施。

## Global Constraints

- 时区：Asia/Shanghai。日期边界与星期不得采用执行宿主的本地时区。
- 保留现有课程编辑器、列表、详情、周循环规则和学习历史；不另建一套课程。
- 自由课程必须有上课星期和原有周循环，没有准确钟点，不进入课表时间网格。
- 任务生成与进度推进分别控制；课表课程下课触发，自由课程当日默认 00:00 后首轮触发。
- 周中和周末都要手动标记具体可用时间；周末不自动生成全天容量。
- 所有课程共享时间容量；先满足截止约束，再尽量少用周末，等价方案优先较近时段。
- 任务完成不回写原学科熟练度、周计划和做题统计，不接入 `/today`。
- tasks 包继续只依赖 core/player；学科与物料通过应用层适配器接入。
- 所有登录用户共享查看/上传物料；个人课程关联、任务和排期按用户隔离。
- 数据和配置持久化在 Supabase，使用 `createUserSessionStore`，不新增本地持久业务数据。
- 新迁移用 `supabase migration new <name>` 创建；不改写历史迁移，不使用不完整历史直接 reset。
- 当前只交付文档。安装、启动服务器、测试、lint、typecheck、build 及远程迁移遵守 `packages/tasks/AGENTS.md`，执行前取得明确指令。下面列出的命令是未来验收步骤，不代表已经执行。
- 已存在 `AD apps/web/env.local`、`AD env.local` 改动，不读取、改动或纳入本功能提交。

## Review Focus

1. **周期规则与历史交界：** 自由课程重叠星期、同日多节课、停课后恢复、修改前补偿不能重复/丢失事件；由任务 2、4 固定回归。
2. **未来任务与局部时间短缺：** 总分钟足够但 release/deadline 窗口不足、周末近而下周工作日可用时，应得到正确风险；由任务 11、12 固定回归。
3. **数学题号与空题集：** 重复显示编号、跨分组真实 ID、待选题不能错误计算完成；由任务 5、6 固定回归。
4. **共享网盘变化：** 账户切换、文件移动、扫描不完整、上传合并超时，不得串资产或破坏旧关联；由任务 7、8、9 固定回归。
5. **陈旧计划与固定块：** 多设备修改、时间经过、已完成任务仍有预占块，不能双计容量或发布过期安全结论；由任务 10、12、13 固定回归。

---

## 交付顺序与文件职责

| 阶段 | 任务 | 独立验收结果 |
| --- | --- | --- |
| A：课程与执行 | 1–6 | 现有课程可配置，后台生成正确任务，比例/题目进度可用 |
| B：统一物料 | 7–9 | 文件清单可匹配课程，任意类型可关联，登录用户可上传查看 |
| C：时间与风险 | 10–14 | 手动时段、未来预留、最少周末占用、课程提醒和甘特图贯通 |
| 上线收口 | 15 | 增量迁移、历史兼容、后台开关、端到端验收和文档完整 |

实施时先完成每个任务的可验收行为，再进入依赖它的任务。阶段 A 的实际依赖顺序为 **1 → 2 → 3 → 6 → 4 → 5**：任务 6 的持久化学科目录是任务 4 的后台内容输入。阶段 B 按 7 → 8 → 9，阶段 C 按 10 → 11 → 12 → 13 → 14。任务 7 可先用手工资产验证，任务 8、9 分别扩展扫描与上传。

主要责任分配：

- `packages/tasks/src/courseTypes.ts`、`courseProgress.ts`：学习事件、目录游标与修订，不包含 UI。
- `packages/tasks/src/taskPool.ts`、`taskProgress.ts`：规则匹配、比例与剩余分钟。
- `packages/tasks/src/planning/`：输入契约、容量、预测、求解、风险；纯函数，不依赖 React/浏览器/Supabase。
- `packages/tasks/src/components/planning/`：课程风险、甘特图、执行列表。
- `packages/materials/src/`：资产与关联界面、上传状态、用户缓存；不导入 tasks。
- `apps/web/src/components/tasks/TasksHost.tsx`、`taskCatalogAdapters.ts`：学科与物料的桥接。
- `apps/web/src/lib/task-planning-worker.ts`、`baidu-material-*.ts`：受鉴权的服务器业务。
- `supabase/migrations/`：按阶段新增迁移；数据库运行逻辑及 RLS。
- `scripts/task-material-catalog.mjs`：可重复、可续跑的物料目录盘点 CLI。

## 公共契约

以下类型在任务 1/7/10 中定义；后续任务消费这些名字，不各自发明不兼容结构。

- `CourseType = 'timetabled' | 'flexible'`。
- `CourseEvent`：`id,user_id,course_id,event_key,on_date,starts_at|null,ends_at|null,release_at,lesson_snapshot,revision,assignment_state,completed_at|null`。
- `CourseCatalogSnapshot`：`version,subject,ordered_lessons,teaching_segments`；全部引用包含稳定内容 key。
- `CourseCursor`：`lesson_key,segment_key|null`；`AdvanceResult` 是 `{kind:'next',cursor}` / `{kind:'finished'}` / `{kind:'missing_segment',lesson_key}` 联合类型。
- `TaskPoolItem`：复用原模板字段，补充 `activity_key,scope,progress_mode,material_selector`。
- `CourseTaskBinding`：`id,course_id,pool_item_id,enabled,scope_override,estimated_minutes_override,material_override`。
- `TaskDemand`：`key,task_id|null,course_id|null,batch_key,origin:'actual'|'forecast',release_at,due_at,remaining_minutes,priority,certainty,source_revision`。
- `CapacityInterval`：`key,start,end,minutes,kind:'regular'|'weekend_reserve'`，时间为 UTC ISO，计算统一使用上海日期。
- `PlanningInput`：`input_revision,now,horizon_end,demands,capacity,fixed_blocks,previous_allocations,configuration_issues`。
- `TaskAllocation`：`demand_key,start,end,minutes,kind,fixed`。
- `PlanningResult`：`input_revision,computed_at,horizon_end,allocations,batch_metrics,conflict_groups,issues,complete`；`complete=false` 禁止输出无条件安全结论。
- `BatchMetrics`：`remaining_minutes,weekday_minutes,weekend_minutes,unallocated_minutes,finish_at|null,extra_capacity_minutes|null,today_required_minutes|null,status,certainty`。
- `MaterialAsset`：`id,subject,kind,source,account_id|null,fs_id|null,path|null,version,title,mime_type,size,created_by,status`。
- `CourseMaterialLink`：`id,user_id,course_id,asset_id,scope,role,sort_order`；`scope` 复用稳定内容 key，不使用页面标题作主键。

辅助接口定义在对应任务负责的类型文件中：

- Task 1：`EventIdentity` 为 `{kind:'timetabled',rule_id,on_date}` / `{kind:'flexible',course_id,on_date,extra_event_id?}`；`NormalizedCourseInput` 为 `{course:CourseInput,rules:RuleInput[]}`。
- Task 5：`ProgressTask` 包含 `status,progress_mode,completion_percent,estimated_minutes,items`；有效 items 使用稳定 key 和 done，剔除取消项。
- Task 6：`CatalogSourceInput` 包含规范化的 chinese/english/math/manual 目录数组及数学 teaching_segments；`TaskMaterialAdapter` 提供 `listForCourse(courseId,scope)`、`pickAssets(subject,selectedIds)`，返回窄 `MaterialOption`（id/title/kind/preview_ref）。
- Task 8：`ScanRequest` 为 rootId/relativePath/recursive/sessionId?/cursor?；`ScanPage` 为 files/folders/cursor/complete；`MaterialFile` 包含 account_id/fs_id/path/name/mime/size；`MatchSuggestion` 包含 asset identity、目标 scope、confidence、reasons、candidates。
- Task 10：`AvailabilityInput` 为 now/horizon_end/day_states/windows/courses/exams；`CapacityBuildResult` 为 capacity/issues；`FixedBlockResult` 为 remaining_demands/remaining_capacity/accepted_allocations/conflicts。
- Task 11：`ForecastInput` 为 now/horizon_end/courses/rules/exceptions/catalog_snapshots/cursors/bindings/pool_items；`ForecastResult` 为 demands/issues。`UserPlanningSnapshot` 为 TaskData 加 catalog_snapshots/bindings/input_revision/day_states/previous_allocations。
- Task 13：`PlanningIssue` 含 code/affected_keys/detail；`RiskSettings` 含 tight_ratio（默认 0.2）；`BatchRisk` 含 status/reasons/actionable_minutes；`WorkerReport` 含 claimed/published/stale/retried/failed 数量。

迁移约定：阶段 A 使用 `task_course_events`、`task_course_catalog_snapshots`、`task_course_pool_bindings`、`task_instance_items`、`task_progress_events`；阶段 B 使用 `material_assets`、`course_material_links`、`material_scan_sessions`、`material_upload_sessions`；阶段 C 使用 `task_availability_day_states`、`task_planning_jobs`、`task_planning_snapshots`。既有 task_courses/task_templates/task_instances/task_time_blocks/task_reminders 进行兼容扩展。

`TaskDemand.key` 在预测转正式时保持同一个逻辑来源标识。开始/截止时间未配置的任务先进入 issues，不制造合法窗口；逾期补做使用独立 recovery 截止，但原始截止仍保留。

## Task 1：领域契约、迁移底座与兼容映射

**Files**

- Modify: `packages/tasks/src/types.ts`、`packages/tasks/src/index.ts`、`packages/tasks/src/useTaskData.ts`。
- Create: `packages/tasks/src/courseTypes.ts`、`packages/tasks/src/courseProgress.ts`。
- Migration: 用 CLI 生成 `tasks_course_events_and_pool_bindings` 迁移；实际时间戳由工具生成。
- Test: `apps/web/tests/tasks/course-contracts.test.ts`、`supabase/tests/task-course-events.sql`。

**Interfaces**

- Produces: 上述 CourseType/CourseEvent/CourseCatalogSnapshot/TaskPoolItem/CourseTaskBinding。
- Produces: `normalizeCourseInput(course: CourseInput, rules: RuleInput[]): NormalizedCourseInput`、`deriveCourseEventKey(input: EventIdentity): string`。

- [ ] 编写契约用例：自由规则不能要求钟点、课表规则必须有钟点、同一自由课程同一天重复规则产生同一 event_key、同日不同课表时段产生不同 key。
- [ ] 增量扩展课程字段、添加学习事件、持久化目录快照和绑定表；保留旧 occurrence/confirmation 和 template_id，先增加兼容读路径。
- [ ] 给个人数据设置 owner RLS；内部 worker/控制表取消浏览器 grants。所有新增 function 检查 EXECUTE 和 search_path。
- [ ] 为旧模板建立课程绑定映射，旧课程标为课表课程，已有完成与确认保留；未配置自动推进的旧课程保持未启用。
- [ ] 获准后运行 `pnpm --filter web exec vitest run tests/tasks/course-contracts.test.ts`；在独立验证库运行事务性 SQL 断言，确认回滚后无残留数据。

## Task 2：扩展现有课程编辑、详情与周期预览

**Files**

- Modify: `packages/tasks/src/components/timetable/CourseEditor.tsx`、`CourseDetails.tsx`、`packages/tasks/src/components/Timetable.tsx`、`timetable.ts`、`transfer.ts`。
- Modify: `apps/web/tests/task-timetable.test.ts`。
- Create/Test: `apps/web/tests/tasks/course-editor.test.tsx`。

**Interfaces**

- Consumes: Task 1 契约。
- Produces: 扩展现有 `saveCourse(course: CourseInput, rules: RuleInput[], effectiveFrom?: string): Promise<string>`，仍通过原子 `task_save_course` 保存；规则输入使用有/无时间联合类型。

- [ ] 写编辑和递归规则用例：星期必填、周循环与指定教学周保留、自由课程无时间、时间网格只包含课表课程。
- [ ] 在原编辑器加入课程类型、自动开关、当前内容/下一游标、任务池绑定入口；详情显示本次与下一次内容，不把分配当完课。
- [ ] 处理归档、规则生效日期、取消/补课和同日多课选择；课程颜色与既有字段保留。
- [ ] 升级 JSON 快照版本并兼容 v1：自由课程保留星期；ICS 只输出有准确时间的课表事件，并给出未导出自由课程数量。
- [ ] 获准后运行 `pnpm --filter web exec vitest run tests/task-timetable.test.ts tests/tasks/course-editor.test.tsx`，验收旧规则与导入行为未回归。

## Task 3：任务池、课程绑定和厚海 Lesson 活动

**Files**

- Create: `packages/tasks/src/taskPool.ts`、`components/TaskPool.tsx`、`components/CourseTaskBindings.tsx`。
- Modify: `defaults.ts`、`components/Templates.tsx`、`TasksPage.tsx`、`types.ts`（路径均在 `packages/tasks/src/`）。
- Create: `apps/web/src/app/tasks/pool/page.tsx`；Modify: `apps/web/src/app/tasks/templates/page.tsx`。
- Test: `apps/web/tests/tasks/task-pool.test.ts`。

**Interfaces**

- Produces: `matchTaskPool(event: CourseEvent, bindings: CourseTaskBinding[], items: TaskPoolItem[]): MatchedActivity[]`；`MatchedActivity` 包含稳定 activity_key、范围、时长、进度模式与物料选择器。
- Produces: `resolveActivityOverrides(matches: MatchedActivity[]): MatchedActivity[]`，相同 activity_key 专项覆盖通用。

- [ ] 写匹配用例：5A U3 L2 只能匹配本范围，通用加专项不重复，同一本书 L3 必须分别生成背诵和作文，旧 workbook 保留。
- [ ] 改名入口，保留旧路径跳转和数据 ID；支持每课程多绑定、覆盖时长/物料、逐项启停。
- [ ] 扩展语文认读/书写/组词/默写/积累活动、数学课堂与作业活动；缺物料明确标记，不漏发任务。
- [ ] 保留未绑定课程的 weekly/once 活动及 unit_completed 行为，生成去重范围包含逻辑活动和事件。
- [ ] 获准后运行 `pnpm --filter web exec vitest run tests/tasks/task-pool.test.ts`。

## Task 4：后台自动生成、手动完课与进度修订

**Files**

- Modify: `packages/tasks/src/courseProgress.ts`、`useTaskData.ts`、`components/CourseConfirm.tsx`、`components/TodayCourseSummary.tsx`。
- Create: `packages/tasks/src/courseEvents.ts`。
- Migration: `tasks_background_generation`。
- Test: `apps/web/tests/tasks/course-events.test.ts`、`supabase/tests/task-generation.sql`。

**Interfaces**

- Consumes: Tasks 1/3、Task 6 的持久化目录快照。
- Produces: `advanceCourseCursor(snapshot: CourseCatalogSnapshot, cursor: CourseCursor): AdvanceResult`；结果为 next/finished/missing_segment。
- RPC: `task_complete_event(p_event_id uuid,p_expected_revision integer)`、`task_revise_event(p_event_id uuid,p_content jsonb,p_expected_revision integer)`、`task_set_course_progress(p_course_id uuid,p_cursor jsonb,p_expected_revision integer)`。
- Internal: `private.task_process_due_user(p_user uuid,p_now timestamptz,p_limit integer)`，只允许内部角色执行；用户入口先验证本人再调用。

- [ ] 写四种开关组合、自动/手动并发、重复触发、晚到补偿、跨超过 35 天中断的用例，断言事件与任务无重复。
- [ ] 实现“先补偿旧配置到期事件，再修订”的同一事务流程；失效版本返回冲突，不覆盖已完成历史。
- [ ] 实现课表下课与自由日界触发、快照游标推进、数学缺段暂停；补齐后从当前/未来继续。
- [ ] 建立每分钟 Cron 私有入口、每用户有限批次、日志、重试与游标；页面 task_tick 作为同源补偿而非第二套生成逻辑。
- [ ] SQL 发放与 TypeScript 预测共用匹配规范和输入/期望 fixtures，分别验证相同 Lesson/活动集合；不假设数据库可以直接调用前端 TypeScript 函数。
- [ ] 移除必须逐课确认的待办，保留历史记录和显式手动完课。取消/暂停事件不生成，首次启用不追溯全部历史。
- [ ] 获准后执行 `pnpm --filter web exec vitest run tests/tasks/course-events.test.ts` 和独立验证库 SQL；验证关闭页面也能处理，提前不生成。

## Task 5：任务比例、逐题进度与剩余分钟

**Files**

- Create: `packages/tasks/src/taskProgress.ts`、`components/TaskProgressEditor.tsx`、`components/MathTaskItems.tsx`。
- Modify: `packages/tasks/src/components/TaskList.tsx`、`types.ts`、`useTaskData.ts`。
- Migration: `task_item_progress_and_revisions`。
- Test: `apps/web/tests/tasks/task-progress.test.ts`、`supabase/tests/task-progress.sql`。

**Interfaces**

- Produces: `getTaskCompletion(task: ProgressTask): number`、`getRemainingMinutes(task: ProgressTask): number`。
- RPC: `task_set_completion(p_task_id uuid,p_percent integer,p_expected_revision integer)`、`task_set_item_done(p_task_id uuid,p_item_key text,p_done boolean)`、`task_set_estimate(p_task_id uuid,p_minutes integer,p_expected_revision integer)`。

- [ ] 固定断言：60 分钟完成 25% 剩 45；20 分钟三题完成一题剩 14；零题不完成；取消不计需求；时段过去不更改比例。
- [ ] 迁移已有 checklist：有明确已完成条目的任务按条目模式保留，已 completed 为 100%；不猜测纯 pending 任务进度。
- [ ] 实现原子逐题完成、手动百分比、时长修改和历史记录；所有更改增加任务/用户规划版本。
- [ ] 新建手动任务要求科目，允许明确选择未分类；历史空科目兼容展示，不阻止访问旧任务。
- [ ] 数学默认分组、题目筛选、待选题/本次无作业、稳定 ID 与页面回放贯通。
- [ ] 内容修订保留相同数学题目进度；普通任务换实际内容保留旧修订并从 0 开始，改名不清空。
- [ ] 获准后运行 `pnpm --filter web exec vitest run tests/tasks/task-progress.test.ts`，SQL 验证两设备勾选不同题目均被保存。

## Task 6：学科目录适配、持久快照和现有物料盘点

**Files**

- Create: `apps/web/src/components/tasks/taskCatalogAdapters.ts`、`apps/web/src/lib/task-catalog-snapshot.ts`、`scripts/task-material-catalog.mjs`。
- Modify: `apps/web/src/components/tasks/TasksHost.tsx`、`packages/tasks/src/types.ts`。
- Create: `docs/task-material-inventory.md`。
- Test: `apps/web/tests/tasks/catalog-adapters.test.ts`。

**Interfaces**

- Produces: `buildCourseCatalogSnapshot(input: CatalogSourceInput): CourseCatalogSnapshot`。
- Extend: `TaskCatalogAdapter.loadMathProblems(key: string): Promise<ProblemOption[]>`，ProblemOption 新增真实 ID、group、displayId、order、tags 与可选回放引用。
- Produces: `TaskMaterialAdapter`（定义在 tasks 内的窄接口），通过应用 Host 调用材料库，tasks 不导入 materials。

- [ ] 写课程排序、跨教材同名课文、跨分组同号数学题、5A U6 有单词而缺课文的用例，断言不虚构资源。
- [ ] 先交付保存课程所需有序目录/教学段快照，供任务 4 使用；随后补充各学科内容与物料选择器。
- [ ] CLI 从权威注册目录与只读内容源生成统一 manifest 和缺口报告，支持游标、限流、重跑去重；不复制或公开私人录音。
- [ ] 在 inventory 文档记录来源、可用范围、已确认/待验证音视频、缺失字段及补录方式，不把旧统计固定为产品事实。
- [ ] 获准后运行 `pnpm --filter web exec vitest run tests/tasks/catalog-adapters.test.ts`；CLI 的远端读取另按授权执行，不在本计划阶段运行。

## Task 7：共享物料资产、个人课程多对多关联与入口

**Files**

- Create: `packages/materials/package.json`、`tsconfig.json`、`AGENTS.md`、`README.md`、`src/{types.ts,index.ts,useMaterialData.ts,MaterialsPage.tsx}`。
- Create: `packages/materials/src/components/{MaterialPicker.tsx,CourseMaterialList.tsx,MaterialPreview.tsx}`、`apps/web/src/app/materials/page.tsx`、`apps/web/src/components/materials/MaterialsHost.tsx`。
- Modify: `apps/web/package.json`、`apps/web/next.config.ts`、`apps/web/src/app/globals.css`、`packages/ui/src/breadcrumb-map.ts`、`packages/tasks/src/components/timetable/CourseDetails.tsx`、`apps/web/src/app/tasks/materials/page.tsx`。
- Migration: `shared_material_assets_and_course_links`。
- Test: `apps/web/tests/materials/material-access.test.ts`、`supabase/tests/material-rls.sql`。

**Interfaces**

- Produces: MaterialAsset/CourseMaterialLink（字段见公共契约）。
- Produces: `useMaterialData()`，提供 `listAssets(filters)`、`linkCourseMaterials(courseId, links)`、`unlinkCourseMaterial(linkId)`；写入后 patchSessionData。
- Produces: 服务器校验后的 preview/download URL，不返回百度凭据。

- [ ] 编写共享读取/上传、创建者编辑、个人关联隔离、任意科目多个物料、资产归档保留旧引用的用例。
- [ ] 创建包并注册 transpilePackages、Tailwind @source、路由和 breadcrumb；只在获准安装时更新 lockfile。
- [ ] 实现分类/筛选/详情、文本/链接资产及多选关联；课程通用物料和当前内容物料分组展示。
- [ ] 扩展 Host 适配器供任务材料选择使用，保留旧私人录音访问方式，不自动共享。
- [ ] 在验证库确认用户 A 无法操作 B 的课程关联；获准后运行 `pnpm --filter web exec vitest run tests/materials/material-access.test.ts`。

## Task 8：百度相对目录扫描、候选匹配与确认关联

**Files**

- Create: `apps/web/src/lib/baidu-material-catalog.ts`、`packages/materials/src/matchCourseMaterials.ts`、`packages/materials/src/components/DirectoryImport.tsx`。
- Create: `apps/web/src/app/api/materials/baidu/scan/route.ts`、`apps/web/src/app/api/materials/baidu/scan/[id]/route.ts`。
- Modify: `apps/web/src/lib/baidu-media.ts`（新增独立文件清单能力，保留原数学前缀搜索语义）。
- Migration: `material_scan_sessions`。
- Test: `apps/web/tests/materials/baidu-directory.test.ts`、`material-matching.test.ts`。

**Interfaces**

- Produces: `normalizeMaterialPath(rootId: string, relativePath: string): string`。
- Produces: `scanMaterialDirectory(input: ScanRequest): Promise<ScanPage>`，ScanPage 含 files、folders、cursor、complete。
- Produces: `suggestCourseMaterialLinks(files: MaterialFile[], snapshot: CourseCatalogSnapshot): MatchSuggestion[]`，建议含 confidence/reasons/candidates，不直接写入。

- [ ] 固定用例：`../` 越界、目录分页、含子目录、同名文件、U3L1 与 U3L10、不同讲次相同题号、扫描中断后续跑。
- [ ] 列表保留目录项，按 account_id+fs_id 去重；重试不得清除完整旧目录，账户切换作废扫描游标。
- [ ] UI 选择根目录、相对路径、目标课程与科目，展示候选和未匹配列表；用户确认后批量原子关联。
- [ ] 复用任务 7 详情展示结果，解除关联只删 link；失效文件保留引用并标明状态。
- [ ] 获准后运行 `pnpm --filter web exec vitest run tests/materials/baidu-directory.test.ts tests/materials/material-matching.test.ts`。

## Task 9：百度分片上传、通用预览与下载

**Files**

- Create: `apps/web/src/lib/baidu-material-upload.ts`、`baidu-material-delivery.ts`。
- Create: `apps/web/src/app/api/materials/uploads/route.ts`、`uploads/[id]/route.ts`、`uploads/[id]/parts/[part]/route.ts`、`uploads/[id]/complete/route.ts`、`apps/web/src/app/api/materials/[id]/content/route.ts`。
- Create: `packages/materials/src/uploadClient.ts`、`workers/uploadHash.worker.ts`、`components/MaterialUpload.tsx`。
- Modify: `apps/web/src/app/api/baidu/oauth/callback/route.ts`、`apps/web/src/lib/baidu-token.ts`（稳定账户身份与缓存代际）。
- Migration: `material_upload_sessions`。
- Test: `apps/web/tests/materials/upload-protocol.test.ts`、`material-delivery.test.ts`。

**Interfaces**

- `POST /api/materials/uploads` → session id/part size/missing parts；必填 subject、文件元信息与完整有序 hash manifest。
- `PUT /api/materials/uploads/[id]/parts/[part]` → 对应分片状态，body 为 raw binary。
- `GET/DELETE /api/materials/uploads/[id]` → 查询/取消会话；`POST .../complete` → ready MaterialAsset 或可重试状态。
- `GET /api/materials/[id]/content` → 经登录验证的 Range/下载响应。

- [ ] 实施前核验官方上传接口、应用写权限、授权根目录、Vercel 限制；失败给出具体配置原因，不伪装上传成功。
- [ ] 写 4 MiB、末片、断点续传、重复 part、错误 MD5/大小、合并超时后核验、账户切换和越权会话测试。
- [ ] 实现默认 2 片并发、退避、2 GiB 可配置限额、服务端生成唯一目标路径；前端不得得到 token。
- [ ] 上传指定科目，完成后可立即关联课程/目录项；任意文件可登记，未知 MIME 下载处理，HTML 等主动内容不得同源执行。
- [ ] 预览保留 Range、响应类型与 no-store；服务 Worker 不缓存私有代理。大文件下载/视频链路需按实际平台响应限制验证，不能只验证上传体积。
- [ ] 获准后运行 `pnpm --filter web exec vitest run tests/materials/upload-protocol.test.ts tests/materials/material-delivery.test.ts`；用授权的测试文件端到端验证，清理仅限本次测试资产。

## Task 10：手动可用时间、周末备用与固定安排核算

**Files**

- Create: `packages/tasks/src/planning/types.ts`、`availability.ts`、`fixedBlocks.ts`。
- Modify: `packages/tasks/src/time.ts`、`types.ts`、`components/Schedule.tsx`、`useTaskData.ts`。
- Migration: `task_availability_configuration`。
- Test: `apps/web/tests/tasks/availability-capacity.test.ts`、`fixed-blocks.test.ts`；保留 `apps/web/tests/task-time.test.ts`。

**Interfaces**

- Produces: CapacityInterval/PlanningInput/TaskAllocation/PlanningResult/BatchMetrics（公共契约）。
- Produces: `buildCapacityIntervals(input: AvailabilityInput): CapacityBuildResult`；输入包含周期/日期状态、窗口、课程、考试和 now；输出 capacity 与 issues。
- Produces: `applyFixedBlocks(demands: TaskDemand[], capacity: CapacityInterval[], blocks: TaskTimeBlock[], now: string): FixedBlockResult`，同时返回占用后容量、剩余需求与冲突。

- [ ] 写未配置≠全天、明确零容量、周末只取手动时段、多段并集、整日覆盖、考试扣除、取消课程不扣、自由课程不扣的用例。
- [ ] 增加周期日期配置状态；沿用原多时段编辑，周六日标为备用，允许指定日期覆盖，显示未配置日。
- [ ] 固定块仅抵扣其任务的未完成分钟；多余/已完成任务的保留块提示释放，不能仍以完整任务需求重复排入。
- [ ] 处理 now 落在块中、块已过期、输入重叠和秒级边界；移动固定块必须重新验证，不静默改用户安排。
- [ ] 获准后运行 `pnpm --filter web exec vitest run tests/task-time.test.ts tests/tasks/availability-capacity.test.ts tests/tasks/fixed-blocks.test.ts`。

## Task 11：未来任务推演与正式任务去重

**Files**

- Create: `packages/tasks/src/planning/forecast.ts`、`planningInput.ts`。
- Create: `apps/web/src/lib/task-planning-input.ts`。
- Modify: `packages/tasks/package.json`，新增只导出纯函数的规划子路径。
- Test: `apps/web/tests/tasks/task-forecast.test.ts`。

**Interfaces**

- Produces: `projectCourseTasks(input: ForecastInput): ForecastResult`，消费目录快照、事件规则、池绑定和固定 now；不产生数据库副作用。
- Produces: `mergeActualAndForecast(actual: TaskDemand[], forecast: TaskDemand[]): TaskDemand[]`。
- Produces: `buildPlanningInput(snapshot: UserPlanningSnapshot, now: string): PlanningInput`，统一实例化用户本人数据。

- [ ] 固定用例：周五课后任务在周五之前无可用边；下次课程跨周；规则变化；正式生成替换预测只计一次；待选题保留估计。
- [ ] 用任务 3 匹配与任务 4 相同游标语义推演，不复制另一套 Lesson 匹配规则。
- [ ] 创建实际/预测的稳定 key，记录不确定性；待设截止、缺目录、范围外任务进入 issues，不判零需求。
- [ ] 按设计计算滚动范围，标记覆盖日和边界不完整；后台与浏览器使用相同输入、now、版本得到相同结果。
- [ ] 获准后运行 `pnpm --filter web exec vitest run tests/tasks/task-forecast.test.ts`。

## Task 12：统一容量求解、周末最少占用与课程余量

**Files**

- Create: `packages/tasks/src/planning/flowNetwork.ts`、`solveCapacity.ts`、`batchMetrics.ts`、`index.ts`。
- Test: `apps/web/tests/tasks/planning-solver.test.ts`、`planning-counterfactual.test.ts`、`fixtures/planning.ts`。

**Interfaces**

- Produces: `solveCapacity(input: PlanningInput, policy: 'regular_only' | 'allow_weekend'): PlanningResult`。
- Produces: `computeBatchHeadroom(input: PlanningInput, batchKey: string, policy: 'regular_only' | 'allow_weekend'): number | null`。
- Produces: `computeTodayRequired(input: PlanningInput, batchKey: string | null): number | null`；null 表示全局，传批次表示保持其他需求可行后最小化该批次当日分配；不可行/未知返回 null。

- [ ] 写窗口与共享容量测试：每分钟至多一个任务，分配不早于 release、不晚于 deadline；已固定需求仅抵扣一次。
- [ ] 写示例断言：数学 100/语文 70/厚海 100，给定 10/29–11/3 的合法窗口，周中 180/备用 120 → 周末 90；周四增加 60 → 周末 30；取消周末 → 总缺口 90。
- [ ] 写反例：相同总容量但在 release 前或 deadline 后不可用；更近的周六与可按时的下周一并存时优先周一；未来任务受限时能重新分配旧任务。
- [ ] 实现区间容量网络与分层目标，不按一分钟创建节点；时间切片仅在 release/deadline/窗口边界处分割，结果再重建连续片段。
- [ ] 先求最大可完成分钟，再按截止/用户优先级分配短缺；在等价可完成程度下最小化周末分钟，再稳定旧预测和较近时间。权重由输入上界推导或分阶段求解，禁止固定“大数”溢出或破坏优先级。
- [ ] 实现常规/含备用两次结果、冲突课程组、预计完成与独立余量；余量不可跨课程相加，基础不可行时不输出虚假余量。
- [ ] 验证可互换课程各自今日最低为 0、但全局最低大于 0 的情形；提醒显示全局必需分钟和建议分配，不把建议量冒充必需量。
- [ ] 获准后运行 `pnpm --filter web exec vitest run tests/tasks/planning-solver.test.ts tests/tasks/planning-counterfactual.test.ts`；增加小规模穷举对照，验证最少备用与今日必需量，不只测试贪心样例。

## Task 13：规划版本、后台重算与风险提醒

**Files**

- Create: `packages/tasks/src/planning/risk.ts`、`apps/web/src/lib/task-planning-worker.ts`。
- Create: `apps/web/src/app/api/tasks/planning/route.ts`、`apps/web/src/app/api/internal/task-planning/recompute/route.ts`。
- Migration: `task_planning_jobs_snapshots_and_alerts`。
- Modify: `packages/tasks/src/useTaskData.ts`。
- Test: `apps/web/tests/tasks/planning-worker.test.ts`、`risk-reminders.test.ts`；SQL `supabase/tests/task-planning-jobs.sql`。

**Interfaces**

- Produces: `classifyBatchRisk(metrics: BatchMetrics, issues: PlanningIssue[], settings: RiskSettings): BatchRisk`。
- Produces: `recomputeClaimedPlanningJobs(limit: number): Promise<WorkerReport>`。
- RPC: `task_accept_plan(p_input_revision bigint,p_allocations jsonb)`，原子校验并生成固定块。

- [ ] 固定用例：首次需周末通知、仅重算不重复通知、备用增加/缺口变大更新、解除标解决、旧 revision 不能覆盖新版本。
- [ ] 所有影响输入的 mutation 增加 revision、置 dirty；读取快照显示 computed_at/horizon/过期状态。
- [ ] 配置有租约的领取/续期/失败退避，Cron 经 pg_net 调用内部路由；新增 `TASK_PLANNING_CRON_SECRET` 与 Vault 值，不记录密钥、不接受任意请求用户 ID。
- [ ] 用户路由只允许重算/读取本人；无登录和内部密钥错误拒绝。没有 pg_net/Vault 时报告未配置，不能宣称后台工作正常。
- [ ] 实现风险状态、冲突组与站内提醒去重；支持今日至少需做分钟，具体来源使用任务 12 反事实结果。
- [ ] 获准后运行 `pnpm --filter web exec vitest run tests/tasks/planning-worker.test.ts tests/tasks/risk-reminders.test.ts` 并验证关闭页面、worker 中断恢复、双 worker 抢占和 stale 结果丢弃。

## Task 14：课程风险首页与可读甘特图

**Files**

- Create: `packages/tasks/src/components/planning/{CourseRiskList.tsx,CourseGantt.tsx,GanttAxis.tsx,AllocationDetails.tsx}`。
- Modify: `packages/tasks/src/TasksPage.tsx`、`components/TaskList.tsx`、`components/Schedule.tsx`、`components/timetable/CourseDetails.tsx`。
- Modify: `packages/ui/src/breadcrumb-map.ts`。
- Test: `apps/web/tests/tasks/course-risk-view.test.tsx`、`course-gantt.test.tsx`。

**Interfaces**

- `CourseRiskList({ result, onSelectBatch })`、`CourseGantt({ result, demands, capacity, view, onSelectAllocation })`；props 显式使用 PlanningResult 等类型。
- 两视图只消费同一个 PlanningResult，不各自重算金额/分钟。

- [ ] 写视图用例：未来任务标预计、未配置不绿色、周末人工时段及占用分钟可见、缺口不被隐藏、选择课程能定位任务。
- [ ] 首页按风险与截止展示课程批次，保留每日未完成和全部积压；区分实际完成进度与安排覆盖率。
- [ ] 甘特图提供自然日期/可用时段展开、课程展开、常规/备用方案比较、固定块与截止点；短片段可聚焦查看起止时间。
- [ ] 移动端使用每日聚合加明细，键盘与文字列表可操作；颜色同时配文字/线型。显示时区、计算时间、覆盖范围。
- [ ] 采纳预测才调用 task_accept_plan；输入过期提示刷新，不在后台自动写固定安排。
- [ ] 获准后运行 `pnpm --filter web exec vitest run tests/tasks/course-risk-view.test.tsx tests/tasks/course-gantt.test.tsx`；在授权的浏览器环境检查手机/桌面、真实多课程和周末零容量情形。

## Task 15：迁移、阶段验收、文档与上线开关

**Files**

- Modify: `AGENTS.md`、`packages/tasks/AGENTS.md`、`README.md`、`UX-CONTRACT.md`（后三者位于 packages/tasks）、`packages/materials/AGENTS.md`、`README.md`（materials）、`supabase/README.md`。
- Create: `docs/task-module-rollout.md`、`docs/baidu-materials.md`。
- Temporary verification scripts only: `scripts/tmp/`；永久 catalog CLI 已在任务 6 定义。

**Interfaces**

- Produces: 可逐项执行的迁移/启用/停用清单、映射统计、回滚开关与验收记录。

- [ ] 记录旧模板→池绑定、旧确认→事件、旧完成进度、旧材料/私人录音映射；无法自动映射项列明待配置，不丢弃。
- [ ] 在独立验证目标演练兼容读写 → 新表/worker → 新界面 → 停用旧确认发任务，确认旧路径可进入新界面。
- [ ] 在最终授权检查中运行 `pnpm lint`、`pnpm typecheck`、`pnpm build` 及本计划相关测试；已通过的检查不无理由反复运行。
- [ ] 获准后用 `node scripts/supabase-migrations.mjs list`、`dry-run` 确认只包含本次迁移，再按授权 push；不使用 `--include-all`、不 reset 生产。
- [ ] 按设计第 12 节验收：关闭网站生成、手动修订、5A Lesson、逐题完成、上传与关联、跨周预测、周末手动窗口、缺口/甘特图/提醒一致。
- [ ] 文档更新实际 API、环境变量、Cron/lease 行为、权限及恢复操作；UI 文案不写入服务端实现细节。
- [ ] 每阶段检查 diff，仅提交本阶段文件；不把预存 env.local 改动混入。完成后提供已验证/未验证项及上线状态，不把“写完代码”表述为已部署。
- [ ] 仓库当前 `.gitignore` 忽略 `/docs/`；若实施提交需要包含本次文档，仅显式纳入这些文件，不取消整个 docs 的忽略规则。本次规划交付不暂存或提交文件。

## 检查记录与执行边界

- 已完成：复核现有课程/任务类型、时间区间算法、应用层目录适配、百度文件能力、迁移约定，并把本轮决定整理为设计和计划。
- 尚未执行：业务代码、安装、测试、lint、typecheck、build、数据库变更、Cron 配置、网盘写入或部署。
- 当前示例图验证的是表达方式和示例输入，不能替代任务 12 的正式求解器验收。
- 后续建议按 A/B/C 三阶段实施和验收。实施方式在执行前由用户确定；本次“重新生成计划”不自动启动实现。

## 最终实现契约与验收边界（Task15）

实施次序按依赖：1→2→3→4→5→6→7→8→9→10→11→12→13→14→15，最终以逐项报告与controller rulings为准。source 和 progression_mode 分别描述内容来源与推进规则；显式 completes_lesson 只在课程教学段真正收尾时推进，缺段暂停而非猜测。灵活课程日期释放与课表时间结束共用事件运行时；自动分配/推进独立，手动改下一进度不等于完课。before_class阶段不推进游标，显式事件修订保留旧任务版本与已完成历史。

task_planning_input 单一MVCC聚合读取owner revision与shared epoch；应用canonical builder/solver计算双策略后以lease+双版本原子发布。采用仅允许最新实际任务可移动分配，服务端再次验证当前时间/截止/容量/重叠；过期不保绿。逾期保持原截止另设恢复目标，未定期欠账不伪造截止。周末只有人工窗口；fixed useful 与 retained occupancy分开，时间经过不等于完成。每批headroom与today minima为反事实指标不能求和。

旧模板一次性映射显式绑定，旧确认映射事件，完成与清单保留；私人录音不进入共享库，无法映射项列待配置。完整操作说明见 `docs/task-module-rollout.md` 与 `docs/baidu-materials.md`。本地完整24迁移与SQL套件、真实snapshot→builder/solver→publish→采用/恢复持久化和双连接竞态验证；完整web Vitest 127文件897测试通过，root类型与lint通过（有继承warnings）。精确源码隔离生产build及最终browser结果见Task15报告，不能以旧任务build替代最终源码证据。合成身份/本地worker不证明托管Cron、真实Auth或provider权限，远程部署验收仍待授权。

### 最终本地阶段勾选（不代表上线）

- [x] 实现与逐项本地验证 Tasks1–14；Task15完整24迁移/23SQL文件和legacy seed映射演练。
- [x] 全web Vitest：127文件897测试；root lint/typecheck；冻结源码独立生产pnpm build：122静态页，exit0。
- [x] 1472 runtime文件对照build副本无hash差异；production CSS7文件与browser fixture一致。
- [x] 实际PlanningDashboard采纳与RecoveryTargetEditor按钮通过本地合成身份SQL adapter持久化；原截止保持。3课程15需求（12forecast）真实builder/solver同结果进入桌面/390px视图；零/缺物料/无截止/过期场景不假安全。
- [ ] 远程list/dry-run/push、真实登录/provider、关闭网站托管Cron送达、生产规模性能与部署后验收：未授权未执行。
