# 独立任务管理

入口 `/tasks`。任务、教材进度、完成状态均与 `/today` 和原学科学习计划独立。
当前登录账号可维护全部配置；没有家长 PIN 门槛。

## 使用与生成时机

仅在任务管理模块内部展示课程事件、待办、截止提醒和逾期任务。
不发送系统通知，不请求设备通知权限。新版事件运行时使用数据库 Cron；部署前须确认扩展与调度状态。

- 首次打开任务管理时，调用 `task_tick` 展开课表并生成已经满足条件的任务与站内提醒。
- 页面可见时每分钟更新一次；切回页面或点击刷新也会更新。
- 部署新版迁移且启用 pg_cron 后，关闭页面也由同一私有运行时生成；页面读取仍按持久扫描游标补偿，不受五周预览限制。
- 自动分配与自动推进独立。显式完课共用事件运行时，已自动分配不会重复发放。
- 过时站内提醒取消；已启用课程的逾期预习任务仍补偿并保留原截止。移除必须逐课确认的待办。

## 启用状态

2026-10-22 已将 `20261022082751_independent_tasks.sql` 应用到当前关联项目，
任务表、RLS、事务函数及私有 task-audio bucket 已创建。

新增 workspace 包仍需维护者按需手动执行 `pnpm install` 后使用。
本次变更未运行安装、项目检查、测试或构建。

首次读取会在当前账号初始化六门示例课程和可编辑任务模板。
在周课表添加实际每周时段，在时间安排录入可用作业时间，再准备课程资料。

已应用的历史迁移保留原样，其中推送订阅表、投递表及领取函数目前不再使用，
无须重新迁移或配置这些能力。本模块已移除推送入口与派发接口。

## 领域约定

- 默认北京时间、周一展示起点。课次滚动生成未来五周，浏览课表可按规则预览更远日期；下一节课的查找不受五周窗口限制。单次例外以原规则和原日期定位，调课后仍使用原课程实例。
- 课程名称定义一条进度流：同一纳约课程多个时段共用下次课截止，另建不同课程则互不影响。
- 课表课到实际下课时、自由课到所选日期日界时，按课程开关处理显式绑定活动。
- 本次内容、下一次游标与实际完课独立保存。未到期预习按明确修订协调；已完成任务历史保留。
- 单元范围默认课文与园地，可在学习资料调整。已生成单元复习后锁定范围。补录仅更新任务模块内进度，并允许首次触发单元复习。
- 纳约题目只手动勾选，不读取练习记录。题库项保留入口，线下题号作为自定义清单项。
- 厚海目录从已有 4A/5A 词库与阅读目录组合，按单元补齐 L1/L2/L3；缺失阅读不自动虚构课文，可上传或关联已有链接。
- 模板快照固化在任务上；修改模板只影响后续实例。语文预习默认下次课前、复习当天 20:30、单元复习七天后；纳约和厚海默认下次同课程前。
- 课表暂未安排下次课时，任务保留且显示「待安排下次课后确定截止时间」。调课会重算相对截止；手动指定的截止保留。
- 可用时间按周配置，多条单日窗口整体覆盖当天周设置。课程、已占用时间及过去时间从窗口扣除；一个时间块必须完整位于可用窗口的合并范围内。
- 单日可标记「不安排作业」，覆盖当日所有周窗口；移除该标记后恢复周设置。
- 任务支持拆成多个时间块。调整课表后保留原块并提示冲突，孩子移除旧块后重新安排。
- 音频按课程、课次、资料类型匹配，缺失显示待准备资料。上传上限单文件 50MB，可多段追加/排序。单条一直循环，手动下一条才切换。
- 阅读、播放、安排时间都不自动完成任务。清单全部勾选会完成任务；无清单任务需要明确点击确认完成。
- 课程停课取消相关未发送提醒，已生成任务仍保留供孩子判断是否取消。
- 首页只增加独立模块卡片，未修改 HomeTodayPanel 或今日计划。

## 手动验收

### 2026-10-23 课表升级（迁移已应用）

新功能依赖 `supabase/migrations/20261023051528_tasks_classtable.sql`，已于 2026-10-23 应用到关联项目。
代码已增加日／周／日程／课程视图、课程统一编辑、多时段与教学周、单次调课／停课、
归档、学期课表、考试、展示设置、JSON/ICS 导入导出、课表图片与打印、配置快照。
首页显示今日课程和下一节课；时间安排使用同一套重复规则预览避免远期课程被当作空闲。

课程改期保留历史及关联任务；课表复制和快照恢复为新增／合并配置，不回滚学习记录。
ICS 仅支持导入面板列出的规则子集，不能表示的规则明确拒绝；图片和日历导出采用选定范围。
仍然只有站内提醒，没有关闭页面后的通知能力。

验收清单见 `docs/superpowers/plans/2026-10-23-tasks-manual-acceptance.md`。
新增算法测试源文件为 `apps/web/tests/task-timetable.test.ts`，尚未执行。

由维护者按需要手动运行 `pnpm lint`、`pnpm typecheck`、`pnpm build`。
新增时间算法测试位于 `apps/web/tests/task-time.test.ts`；可以单独运行：

```bash
pnpm --filter web test -- tests/task-time.test.ts
```

功能场景：

1. 同一课程添加两个每周时段；单次停课/调课不改变其余周，从某日起改周规则保留历史。
2. 课程结束前不能确认；下课后重复确认、刷新和两个设备同时确认均只生成一组任务。
3. 语文确认课文、修改预备课、补录已讲完内容；园地未完成不能触发默认单元复习，满足范围立即且只触发一次。
4. 修改已开始任务的预备课，旧任务保留并显示提示；编辑模板不改变旧任务清单、预计时长或提醒规则。
5. 纳约混合选择题库题和线下题，逐题勾选，全部完成才完成该组；原数学学习进度保持独立。
6. 厚海 L1/L2/L3 分别生成 workbook 与阅读/听记/背诵；缺失资料可后补，播放不会完成任务。
7. 同一任务拆成两个时间块；拒绝重叠、过去时间、超出窗口和跨日块；调课产生冲突提示。
8. 打开任务管理等待站内提醒，验证已读和完成任务后不再展示提醒；页面不会请求系统通知权限。
9. 用两个账号确认任务表数据和私有音频保持隔离。
10. 关闭页面后重新打开并刷新，确认补齐已到时的周期任务和课程确认待办，不重复生成、不补发过时课前提醒。

## 任务池与课程绑定（本地开发）

`/tasks/pool` 替代原任务模板入口，旧 `/tasks/templates` 跳转保留。存储表和旧 ID 不变。
池可配置完整目录/教学段范围、预计时长、进度方式、截止与提醒；课程通过独立绑定覆盖范围、时长和物料。
同活动、同触发阶段、同内容对象时专项覆盖通用；不同活动全部保留。`confirmed` 和 `after_class` 仅在去重身份上等价。
每周/一次任务继续独立，不参与课程事件匹配。缺物料不会删掉任务或清零预计时间。
建议活动包含原 workbook、L1 听读/跟读/理解、L2 听写/默写、L3 背诵和独立作文，以及语文认读/书写/组词/积累。数学作业未选题时保留“待选题”。
已有账号可用“从预设添加”逐项选择增加缺项，不改写已有条目。后续事件运行时和统一物料选择器分别由 Task 4、Task 7 接入。

课程编辑器使用公开的 `CourseTaskBindings`，传入 `items/value/onChange/lessons/segments`。
`CourseTaskBindingDraft` 不要求 course_id/user_id，可在新建课程保存前选活动；须由原子保存同时写入课程、规则和绑定。
`renderMaterialPicker` 接收 `MaterialSelector` 的 value/onChange/disabled，供应用层统一物料选择器接入。
验证：`pnpm --filter web exec vitest run tests/tasks/task-pool.test.ts tests/tasks/course-task-bindings.test.tsx`。

`matchTaskPool(event, bindings, items, context?)` 仅处理显式启用的绑定。
`context.next_lesson_snapshot` 用于 next 内容；缺失时不以当课替代，并向 `context.issues` 追加 `missing_next_lesson`。
`context.completed_unit={book,unit}` 必须由调用方根据目录边界/单元完成状态验证；未传入时不匹配单元完成活动。
显式 binding.scope_override 同时替代旧 lesson_filter，未覆盖时仍联合校验池范围与旧课次。
本地新增迁移 `20261029054202_tasks_pool_initialize.sql` 补全初始化字段与新账号默认绑定，重复调用不恢复已停用/删除的绑定。


## 课程目录快照与本地物料盘点

应用层 `apps/web/src/components/tasks/taskCatalogAdapters.ts` 归一化目录、题目和资源证据，
`apps/web/src/lib/task-catalog-snapshot.ts` 提供无 React/浏览器依赖的 `buildCourseCatalogSnapshot`。
`prepareSnapshot` 按 `selection.book/units/lesson_keys/segment_keys` 保留来源顺序；源未 ready/失败或空范围返回 unavailable，
不得覆盖先前有效快照。学科 hook 仅增加真实 `ready/error` 字段，不改现有读取、缓存或刷新时机。
`source: builtin|manual` 和 `progression_mode: lesson|segment` 必须随快照持久化；manual 可用于任何科目，
通过 `manual_lessons` 提交明确有序目录，不强制读取内置数学题库。

数学题保留兼容 picker `key=group:id`，正式 `stable_key=encodedLesson:group:encodedRealId`。
题库分组不自动生成教学段；用户明确提交的 `teaching_segments` 逐项校验真实引用。
`completes_lesson?: boolean` 缺省 false，只能在本讲最后一段显式 true。
ready 结果的 `missing_teaching_segments` / `unclosed_teaching_segments` issues 允许后续补配置；
运行时必须区分缺段暂停和完成，不能根据 subject/空数组猜测。Task 2 保存时服务器重验 owner/时间/内容，
复用已有 `(user_id,subject,version)`，与课程、规则、cursor、bindings 同一事务保存。
不要用带 id 的 generic `save` 插入新快照，它会走 UPDATE。沿用 `useTaskData.catalog_snapshots` session store。

可重复 CLI：`node scripts/task-material-catalog.mjs --dry-run`（默认只读仓库、stdout）。
`--out file --page-size 40 --max-pages 1` 保存分页 checkpoint，`--out file --resume` 恢复；
`--fixture file` 支持本地数据验证。`--dry-run` 不写输出文件。来源变更拒绝恢复；同 key 同内容去重，冲突报错。
远端只读 feed 仅在显式 `--remote-url URL --allow-remote --max-pages N` 后使用，具备游标、限流、
Retry-After、超时及页预算；本任务未执行远端读取。`scan_complete` 是分页覆盖，`complete` 还要求无源加载错误；
资源 missing/unverified 始终在 gaps 中。CLI 不读 env、不写 DB、不包含私有录音。
来源/补录/证据范围和示例见 `docs/task-material-inventory.md`。

`TaskMaterialAdapter.listForCourse(courseId,scope)` / `pickAssets(subject,selectedIds)` 返回窄 MaterialOption；
客户端 `TasksHost` 的 `materialAdapter` seam 接入 Task 7。tasks 不导入物料/学科包，也不存另一套共享资产。
本地增量迁移 `20261029065823_task_catalog_source_and_progression.sql` 将旧数学快照保守回填 segment，
其他科目 lesson；旧 JSON 未标记 lesson 结束时继续保守等待配置。
验证：`pnpm --filter web exec vitest run tests/tasks/catalog-adapters.test.ts tests/tasks/catalog-inventory.test.ts tests/tasks/catalog-readiness.test.tsx`；
SQL 断言：`supabase/tests/task-catalog-snapshot.sql`（仅授权的 disposable/local PostgreSQL）。

### Atomic course editing and integration handoff (2026-10-29)

The existing timetable editor owns course type, subject, colors/notes/teacher/location, recurrence,
learning directory and next cursor, automation switches and controlled pool bindings. It uses the
existing `saveCourse(course: CourseInput, rules: RuleInput[], effectiveFrom?: string): Promise<string>`.
The RPC is still `task_save_course(p_course jsonb, p_rules jsonb, p_effective_from date default null)`.
New `CourseInput.catalog_snapshot` contains a prepared Task6 snapshot, and `.bindings` is the Task3
controlled draft array. Existing edits must send the loaded `rules_revision`; stale drafts fail atomically.
The existing `rpc` helper refreshes the same user session store after success. Never insert snapshots
with generic `save`: a builder ID does not identify an existing database row.

`CourseLearningSettings` prepares a directory through injected `catalog.prepareSnapshot`. Manual
ordered directories work for every subject; builtin directories require an explicit book/stage and
selected lesson keys. Builtin math requires explicit teaching segments using selected real stable
problem keys, defaulting the picker to classroom questions. No group defines teaching order. Mark
“本讲最后一段” only for an actual final segment. Future missing/unclosed segments warn; current
cursor must be valid before either automation switch is enabled. Failed preparation keeps the prior
snapshot; “放弃未准备的目录修改” restores its local preparation fields. Only Save persists any of it.
`CourseConfiguration.default_deadline?: CourseDeadlinePolicy | null` stores a concrete course policy:
`{ kind: 'next_class' | 'same_day' | 'days_after' | 'fixed', time: 'HH:mm', days: integer 0..365,
at: timezone-qualified ISO timestamp | null }`. `at` must be present and null except for `fixed`,
which requires a valid timestamp. The atomic RPC preserves an omitted field; explicit null resets
to the system policy. `task_courses.default_deadline` is nullable JSON with a database check, so
invalid direct writes also fail. The editor validates the same required fields and integer bounds.
It displays/edits fixed times in Asia/Shanghai, including previously stored UTC timestamps.
Task4 owns the explicit pool `kind: 'course_default'` option and runtime precedence:
concrete pool deadline (existing explicit override) → course policy when inheritance is selected →
system default when course policy is null. System default is next_class, days=1, time=20:30.
For next_class, timed events use the next event's actual start; date-only events use the next event
calendar date minus days at time. New course-triggered drafts/presets may inherit; weekly/once
activities cannot. Preserve every existing concrete pool deadline. Task4 must add matching SQL/TS
precedence fixtures; Task11 reuses this contract. This migration does not change generation/runtime.
Material selectors/overrides retain the Task3 controlled contract; Task7
supplies a concrete `renderMaterialPicker` and application material adapter. No raw asset IDs are UI inputs.

`effectiveFrom` applies to schedule rules only. Learning settings change immediately. The UI labels
both semantics. Pending timed→flexible or flexible→timed changes retain the old rules' own clock and
validity until the named day. Re-edit defaults to the pending target rule set; changing the effective
date does not reset unsaved weekday/content choices. When postponing a never-effective revision,
its superseded target rows are disabled by their original valid_from (an empty effective interval),
while only the previous schedule extends to the new boundary. No historical rule is deleted.
JSON v2 includes schedule-only `effective_from`, so import→edit loads the target rules and retains
old timed validity; it excludes default_deadline along with learning settings. It accepts
v1; imported automation flags/cursors/snapshots/events/bindings are discarded. ICS never manufactures
all-day entries and exposes `X-ROSIE-OMITTED-FLEXIBLE`; the export panel shows the count.

Task4 must replace `task_course_before_configuration_change(p_user uuid,p_course uuid) returns void`.
It is SECURITY INVOKER, search_path empty, authenticated/service_role EXECUTE only (PUBLIC/anon
revoked), calls `task_user_lock` (which authenticates owner), and currently calls legacy `task_tick`.
`task_save_course` calls it after locking/ownership/stale-revision checks and before snapshot insertion
or any course/rule/cursor/binding mutation. A new course passes null course ID. Replace the body with
old-config due-event catch-up under the same lock; any error must roll back the entire save.
Do not move compensation to a client request. The post-save legacy tick is a compatibility reconciliation
step, not formal learning generation. The temporary legacy emitter guard (`auto_assign` plus absent
catalog snapshot) must be removed/replaced when Task4 owns all explicit binding/event generation.
The legacy next-class deadline engine still refers to timed occurrences; Task4 owns date-only event deadlines.

Details already read `CourseDomainData.events`, show assigned vs completed independently, select
same-day events by ID and retain separate next-cursor display. Current book/unit/title comes from
the event lesson snapshot. Segment titles resolve using the event owner/version and exact saved
lesson identity against immutable snapshots (not the course's mutable subject/catalog/cursor).
Missing or ambiguous legacy catalogs show “教学段历史详情不可用”; never substitute next content.
Task4 wires actual event revision,
completion, flexible cancellation/makeup and manual generation through these existing details.
This task keeps existing timed exception, archive/restore and confirmation controls intact.

Local assertions: install the entire task migration chain in a disposable DB (including the historical
alias fix and Task6 metadata migration), then run `supabase/tests/task-atomic-course-configuration.sql`.
The test uses authenticated RLS, actual tick/ensure-next, ownership, exact-version conflicts, rollback,
stale revisions, unchanged IDs, future conversion re-edit/history, and schedule-only import. It rolls
back its fixtures. No hosted migration or generation has been verified by this local test.


## Task4 event-runtime handoff (authoritative for the local pending rollout)

This section supersedes the staged legacy-runtime statements in earlier Task2 handoff notes.
The generated migration is `20261029095159_tasks_background_generation.sql`; do not deploy it
independently from this application revision. No hosted migration or live Cron job was applied.

`task_runtime_status()` returns `cron_enabled/detail`; an absent pg_cron extension is explicitly
reported as disabled, while `task_tick(auth.uid())` remains same-engine page catch-up. The private
minute entry `private.task_run_due(now(),20,100)` processes bounded users/days, records errors and
retry times, and rotates by last run. Task13 may add planning invalidation around this engine;
it must not reintroduce a second formal course emitter.

Public mutations: `task_complete_event(event_id,expected_revision)` and
`task_revise_event(event_id,content,expected_revision)` return the event, or `{status:'retry'}`
when an old-config catch-up batch committed without the requested action. Content is `{cursor}`
for a persisted catalog or `{lesson}` for a manual description. Stale versions fail before catch-up.
`task_set_course_progress(course_id,cursor,expected_revision)` uses cursor_revision and returns
`{status:'updated',cursor_revision}` or `{status:'retry'}`. `task_cancel_event` preserves completed
history. `task_makeup_event(course_id,request_id,on_date)` is idempotent by request UUID and returns
an event UUID, or NULL for bounded catch-up; reuse the request ID on retries.

`task_archive_course_runtime(course_id)` returns updated/retry. The legacy void archive delegates
and raises catch_up_required on a bounded retry (old clients should refresh/tick). Restore uses
`task_restore_course`, preserves history and resumes from the current Shanghai date/activation.

Course saves retain their UUID result; NULL means only compensation committed. The client retries
at most three times and preserves its draft. Ordinary edits omit cursor. Explicit cursor/catalog
selection includes the original expected_cursor_revision. `cursor_intent:'resume'` means resume an
actually consumed missing-segment pause; 'set' means an intentional selection/repeated segment.
A resumed existing same-day event is still deduped, and pause dates are not emitted retroactively.

Pure Task11 APIs: `enumerateCourseEvents`, `projectCourseEvents`, `resolveEventContent`,
`resolveCourseDeadline`, `resolveActivityWindow`, `advanceCourseCursor`, and `matchTaskPool`.
Projection does not mutate actual state. Preserve event+activity+normalized-phase+target source
keys exactly, including JavaScript encodeURIComponent UTF-8 encoding. Resolve materials through
the Task7 seam documented in AGENTS; missing material/selection retains the estimated minutes.

Task5 uses `selection_state`, `content_snapshot`, `progress_mode`, `completion_percent`,
`task_instance_items.item_key`, `task_instances.revision`, and append-only `task_progress_events`.
Event revision owns content reconciliation; execution-progress RPCs must share the same user
transaction lock (hashtextextended(user UUID,228)), check expected revision, and preserve completed
history. Homework with pending selection has zero fake items and cannot be completed by the current UI.

Validation fixtures: `supabase/tests/task-generation.sql`, legacy seed/assert SQL, and shared
`supabase/tests/fixtures/course-runtime.json`. The disposable validation harness must apply all nine
related task migrations before Task4; inject legacy seed immediately before Task4. These are local
PostgreSQL assertions, not evidence of hosted RLS/PostgREST/Cron deployment. Final broad build and
rollout verification remain Task15.

Forecast input must include existing `CourseEvent[]` as `enumerateCourseEvents`'s sixth
argument (`stored`), plus occurrences as its seventh argument when available. Explicit
makeup events (`rule_id === null`) participate by release date with no fabricated clocks;
owner/course boundaries and cancelled states are filtered. Stable `event_key` dedupes stored
rule events and forecasts, and request UUID dedupes makeup creation. Preserve stored phase
flags so `projectCourseEvents` does not forecast already processed work again.
