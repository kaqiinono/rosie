# @rosie/tasks

Independent timetable, task pool activities, course confirmations, time planning and reminders.
Routes are `/tasks/**`; `/today` and all subject progress remain independent.

- Dependencies: core and player only. App-owned `TasksHost` supplies Chinese, math and
  English catalogs through `TaskCatalogAdapter`. Never import subject packages here.
- `useTaskData` owns a user session store. Route remounts reuse it; explicit refresh and
  visibility/minute refresh generate and reconcile station-only tasks. User data lives in Supabase.
- `task_complete_event` and `task_revise_event` share the private event runtime with
  `task_tick` and the minute worker. Assignment and actual completion are independent;
  user advisory locks, canonical source keys and expected revisions serialize mutations.
- Generated tasks snapshot their template. Template edits apply to future tasks. Only
  course-relative deadlines/reminders follow timetable changes; fixed overrides remain fixed.
- Private audio is stored under `task-audio/<user id>/...`. Signed URLs must not enter
  shared service-worker caches. Playback repeats one clip until the learner moves on.
- New UI uses global theme utilities. Its Tailwind scan source is registered in globals.css.
- Event runtime migration is LOCAL ONLY. When deployed with pg_cron installed, the private
  `tasks-background-generation` job runs every minute. `task_runtime_status()` reports
  whether scheduling actually exists; without the extension it explicitly reports disabled.
  The signed-in page's `task_tick` is same-engine catch-up, never a separate emitter.
- Follow the user's manual-control preference: do not install, start servers, build,
  lint, typecheck or run tests without an explicit instruction.

Files: `types.ts` domain interfaces, `time.ts` interval math, `defaults.ts` templates,
`components/` small page sections. Shared foundations must never import this package.

## ClassTable-aligned timetable

- `timetable.ts` is the pure recurrence/preview/overlap layer. Previewing arbitrary dates
  must not generate tasks. `task_tick` materializes a bounded window and the next actual
  lesson independently; next-class deadlines must not depend on the five-week window.
- Course edits use atomic `saveCourse` / `task_save_course`, with an effective date and
  preserved rule identities. Archive courses rather than deleting their learning history.
- `components/timetable/` owns the course dialog, calendar views, exams and settings.
  Course colors remain stable; confirmation/cancellation are separate status labels.
- `transfer.ts` validates untrusted JSON/ICS. Imports use the atomic idempotent RPC;
  snapshots are schedule-only and restore additively, never overwrite learning records.
- Calendars, preferences and snapshots persist in owned database rows, not localStorage.
- `20261023051528_tasks_classtable.sql` was applied to the linked project on
  2026-10-23 via the migration API; its filename matches hosted migration history.

## Additive course-domain foundation (local migration pending)

- `courseTypes.ts` defines course events, snapshots, bindings, pool items and the
  `CourseRule` union. Existing `TimetableRule` and `TaskData` stay source-compatible;
  `CourseDomainData` adds the new collections. The session store reads each source
  table once and projects timed rules for the legacy grid.
- `courseProgress.ts` normalizes course/rule input and derives stable event keys.
  Flexible defaults use one event per Shanghai date and course; extra events need
  an explicit identity. Timetabled events retain rule/date identities.
- `20261029031259_tasks_course_events_and_pool_bindings.sql` is local only. Apply
  together with event-aware runtime changes; old tick/save RPCs are unchanged in
  this foundation and cannot process flexible rules yet. Legacy course automation
  defaults off, and old occurrence/confirmation/template IDs remain readable.
- Disposable-database assertions: `supabase/tests/task-course-events.sql`; run
  only with an explicitly authorized local validation database and roll back.

- A rule's `kind` describes its own validity period; it is not foreign-keyed to
  the course's current `course_type`. Retired timed rules and confirmed occurrences
  must survive later type changes. Atomic course-save must validate newly active
  rule kinds against the requested course type.

- Completion is independent of assignment: `completion_state` is `pending` or
  `completed`. Legacy confirmed events are completed with unknown (`null`)
  `completed_at`; preserve `legacy_confirmation`. New completion operations set
  the actual completion timestamp, never derive it from scheduled end time.

## Task pool and bindings

- `/tasks/pool` is the activity editor; `/tasks/templates` redirects there. Storage and existing template IDs remain `task_templates` / `template_id`.
- `taskPool.ts` matches explicit enabled course bindings only. Scope keys include book/unit/lesson or stable teaching-segment IDs. Legacy `lesson_filter` remains an extra constraint unless a binding explicitly replaces scope.
- Overrides dedupe by activity + normalized phase (`confirmed` = `after_class`) + target. Event + that logical identity forms `source_key`; never dedupe two separate events.
- `CourseTaskBindings` is a controlled draft component, including before a course has an ID. Course editor saves its selected bindings atomically alongside course/rules (integration in Task 2).
- Material selection uses typed selectors and `renderMaterialPicker`; concrete asset UI is supplied by the application adapter in Task 7. Never expose asset UUID entry. Missing auto materials retain nonzero activity estimates and a pending-material status.
- Next-target activities require `TaskPoolMatchContext.next_lesson_snapshot`; missing targets append `missing_next_lesson` to its issues and do not match current content. Unit completion requires caller-verified `completed_unit` matching the event book/unit.
- Pool editing does not itself emit tasks or touch subject progress. Event runtime integration consumes matching output in Task 4.


## Catalog preparation and inventory

- App-owned pure adapters prepare persisted snapshots; `source` and `progression_mode` are explicit row metadata.
  Manual ordered directories work for every subject, including school math, without loading built-in math banks.
- Catalog readiness is independent of arrays being empty. `prepareSnapshot` returns ready+configuration issues or
  unavailable+readiness/code. Never replace the last persisted catalog from incomplete/failed sources.
- Math picker keys remain group:id for compatibility; formal stable_key includes lesson/group/real ID.
  Groups classify materials and never silently define teaching order. Validate user-configured segment real keys.
- `TeachingSegment.completes_lesson` defaults conservatively false. Only the final same-lesson segment may set true;
  missing/unclosed future segments remain ready configuration issues, and runtime must pause rather than finish.
- Task 2 owns atomic snapshot/course/rule/cursor/binding persistence. Reuse `(user_id,subject,version)` only after
  content validation; owner/time are server-authoritative. Generic save with builder.id performs UPDATE, not INSERT.
- Reusable `scripts/task-material-catalog.mjs` imports authoritative repository exports via root jiti. Local/fixture
  defaults need no env/network. Checkpoint/resume/dedupe/gaps are documented in README and docs/task-material-inventory.md.
  Remote GET feeds require explicit opt-in and a page budget. Never catalog private task/story recordings.
- `TaskMaterialAdapter` is an injected application seam. Shared-material storage belongs to Task 7; no materials dependency here.

## Atomic course configuration (Task 2, local migration pending)

- `saveCourse(course, rules, effectiveFrom?)` remains the sole atomic course editor API.
  `CourseInput` now carries optional `catalog_snapshot` and controlled `bindings`; existing
  edits include `rules_revision`. An omitted bindings payload preserves bindings, `[]` clears them.
- Schedule `effectiveFrom` governs rule validity and type only. Learning settings change immediately.
  Current course_type is the target configuration; calendars/events must use each rule's own kind.
  Re-editing a pending conversion initializes target rules and preserves earlier timed identities.
- Snapshot insertion/reuse is inside `task_save_course`: server owner/time/id, exact source/progression/
  lesson/segment comparison on version reuse, owner+subject and current cursor validation. No generic save.
- `task_course_before_configuration_change(uuid,uuid)` is an explicit Task4 integration hook under
  the existing user transaction lock, before any course/catalog/rule/binding mutations. It currently
  runs legacy `task_tick` only. Task4 must replace it with old-configuration due-event compensation.
- Legacy tick/ensure-next only materialize timed rules. Formal event generation, event content edits,
  flexible completion/cancellation/makeup and actual completion remain Task4. The temporary legacy
  course emitter excludes configured catalog courses; Task4 must replace this bridge with auto_assign
  and explicit binding matching for ALL course types, including generic activities without catalogs.
- JSON snapshots normalize to v2 and explicitly whitelist schedule fields; v1 remains readable.
  V2 preserves schedule-only effective_from for pending-transition re-edit; excludes default_deadline.
  Both JSON and ICS exclude learning state/automation. ICS reports skipped flexible course count.
- `CourseConfiguration.default_deadline?: CourseDeadlinePolicy | null` is a validated concrete policy
  persisted atomically. Omission preserves, null resets to system next_class (days=1,time=20:30).
  Task4 adds explicit pool course_default inheritance/resolution; concrete pool deadlines stay overrides.
  Do not infer inheritance from missing fields or alter legacy pool deadlines during migration.
- Pending superseded targets retire at their own start, never overlapping the extended prior schedule.
  Event current segment labels use saved owner/version/lesson identity, never the next course cursor.
- Disposable full task baseline assertions: `supabase/tests/task-atomic-course-configuration.sql`.
  Do not apply this migration remotely before the event runtime is integrated and reviewed.

## Unified event runtime (Task 4, local migration pending)

- `courseEvents.ts` owns pure candidate enumeration, snapshot projection, deadline/window
  resolution and bounded-save retry; `courseProgress.advanceCourseCursor` respects explicit
  progression mode and segment closure. Task11 must reuse these, `matchTaskPool`, and the
  shared `supabase/tests/fixtures/course-runtime.json` expectations.
- `private.task_process_due_user(user,now,limit)` is browser-inaccessible. Durable course
  `generation_date` scans unlimited historical duration in bounded daily batches; current
  date stays open for later classes. Automatic assignment never marks actual completion.
- Preview and after-class sources are distinct. Flexible preview release uses Shanghai date
  midnight minus trigger_minutes without populating class clocks. Initial activation skips
  previews whose cutoff already passed; previously active late work stays overdue. Invalid
  release/deadline windows remain explicit event issues. Overdue original deadlines never
  get moved; future relative deadlines may follow schedule revisions.
- Course config writes go through the sole owner-checked save/import/replace/archive/restore
  RPCs. Browser DML on courses/rules/events/catalog snapshots is revoked. Catalogs are immutable.
  `task_save_course` returning NULL commits bounded old-config compensation only; retry at most
  three times, never rebase expected revisions. An ordinary edit MUST omit cursor. An explicit
  cursor patch requires expected_cursor_revision; check before catch-up, then apply intentional
  override after catch-up. Re-read live cursor after the hook.
- `cursor_intent:'resume'` is request-only: validate an actually consumed paused segment and
  advance it once using the repaired snapshot; reset scan date to Shanghai today. Explicit
  selection uses 'set' (including intentional repeated study). Resume never backfills pause dates
  or fabricates an extra event for an already processed day.
- Event content revisions preserve completed task history, archive old progress, reset changed
  percentage content, and retain real problem completion by stable item_key. `task_instance_items`
  is the authoritative item seam for Task5; legacy items JSON is reconciled on content revision.
  Math homework starts `selection_state:'pending'` with no completable fake item and full estimate.
- Task7 replaces only `private.task_resolve_materials(user,course,scope,selector,content)`.
  Return `{status:'pending'|'not_required'|'selected',asset_ids:string[]}` after canonical asset
  permission checks; never return signed/private URLs. Until then non-none selectors are pending.
- SQL tests run against the complete nine-migration baseline plus Task4. Seed legacy source-key
  fixture immediately before Task4; its assertion proves old tasks keep progress and cannot reemit.
  The separate native PostgreSQL harness tests actual cross-connection advisory-lock contention.

Forecast input must include existing `CourseEvent[]` as `enumerateCourseEvents`'s sixth
argument (`stored`), plus occurrences as its seventh argument when available. Explicit
makeup events (`rule_id === null`) participate by release date with no fabricated clocks;
owner/course boundaries and cancelled states are filtered. Stable `event_key` dedupes stored
rule events and forecasts, and request UUID dedupes makeup creation. Preserve stored phase
flags so `projectCourseEvents` does not forecast already processed work again.

### Task4 pre-review corrections

- `20261029145703_tasks_runtime_order_and_checkpoint_repairs.sql` is a forward-only follow-up.
  `generation_date=today` remains open, but empty/already processed current dates consume no
  daily work budget. `has_more` means a remaining historical checkpoint or unprocessed due event,
  not a full numeric budget, empty today, or a static preview-projection issue.
- Legacy `task_confirm_course` now catches up earlier due events under the same user lock before
  reading the current event revision and completing. Its void compatibility result cannot carry
  retry; incomplete compensation raises `catch_up_required`, requiring a separate `task_tick`.
- `task_emit_event` content/schedule revisions retain expired original due_at/due_kind. Future
  deadlines still recompute; changing event content is not permission to extend an overdue deadline.
- Focused SQL: task-generation-legacy-order.sql, task-generation-fairness.sql, and
  task-generation-overdue-preview.sql; native harness also reruns affected existing runtime/save tests.

### Task4 event lifecycle repair

- `20261030004949_tasks_event_lifecycle_repairs.sql` retains timed event clocks/release while
  explicit early completion emits the normal after-class task identity with task release now.
  Course/default deadlines retain their existing policies; scheduled-end processing cannot duplicate it.
- First assignment activation reopens only skipped, incomplete current-date flexible events.
  Their snapshots and once-only cursor flags remain intact; earlier dates stay excluded.
- Deleting a cancellation exception restores the same event and task sources during the next
  authoritative reconcile. Preserve completed tasks, partial progress, expired deadlines and
  cursor advancement, including when automation has since been disabled.
- Local native regression harness: `scripts/tmp/task4-lifecycle-validation.mjs`; setup and
  focused baseline/GREEN commands are in README. No hosted database or env file is needed.

- `20261030011147_tasks_processed_preview_projection.sql` excludes `after_processed` events
  from both worker preview projection and preview reconciliation before emission/temporary
  advancement. An early completed timed event keeps scheduled clocks but is already reflected
  in the live cursor; forecast must not count it a second time. SQL regression:
  `supabase/tests/task-generation-processed-preview.sql`.

## Execution progress (Task 5, local migration pending)

- Ordinary new activities/manual tasks default to `percentage`; explicit item activities remain `items`.
  Existing checklist/completed history is preserved. New manual tasks require a subject; `other`
  is explicit unclassified, while historical null subjects remain readable.
- `taskProgress.ts` computes remaining work with integer numerators before ceil. Empty/pending
  real-item sets retain full demand, cancelled/completed tasks retain none; elapsed time never completes work.
- Browser task writes use owner-checked `task_save_execution`, `task_set_completion`,
  `task_set_item_done`, `task_set_estimate`. Direct task/item DML is revoked. Percent/estimate/edit
  require the displayed expected revision; different-item writes are atomic under user lock seed 228.
  No-op retries add no revision/history. Mutations return the entire authoritative TaskInstance;
  cache patches and background read reconciliation retain the highest task revision.
- Append-only task_progress_events store prior snapshots and requested change under the prior revision.
  task_user_planning_revisions increments on task insert/update, including event-runtime changes;
  Task13 can consume this owner-readable dirty revision rather than inventing a client counter.
- Math selections store stable lesson:group:real-ID keys. Overlap retains completion, empty selection
  is pending with nonzero estimate, explicit no_homework cancels with an audited reason. Content
  revisions for generated ordinary tasks remain owned by task_revise_event; manual ordinary edits
  retain old snapshots and reset progress. Names/deadlines/estimates alone do not clear progress.
- TasksHost loads authenticated verified replay matches through math-kit’s existing per-lesson
  user store and injects the established ProblemVideoReplay component. Tasks imports no math module.
- Local execution SQL and actual different-item two-connection lock contention:
  `node scripts/tmp/task5-progress-validation.mjs` (same disposable dependencies as Task4).

- Task5 repair migration `20261030020435_tasks_execution_snapshot_repairs.sql` normalizes
  accepted item snapshots/order for percentage content replacements too. Metadata-only writes
  preserve legacy progress, including completed empty checklists; cancel/restore retains completion.
- Refresh reconciliation retains current-only task rows as well as the highest revision for matching
  IDs: a task created after the task SELECT must survive remaining background table reads. Tasks
  cannot be deleted through the application, so removal must never be inferred from an older fetch.

## Shared material integration (Task7, local migration pending)

Application `TaskMaterialsBridge` injects renderMaterialPicker/renderCourseMaterials/renderTaskMaterials
and `TaskMaterialAdapter.resolve`; tasks never imports materials. Actual CourseEditor binding and pool
selectors use subject-aware pickers. Course details use immutable selected event content for matching.
Private recording tables/bucket remain unchanged. `/materials` owns shared asset management.
Pending resolution updates run under user lock228, preserve old snapshots in task_progress_events,
increment task/planning revisions, and retain selected/completed/cancelled asset history on archive/unlink.

- Task7 review repair `20261030031333_tasks_material_resolution_repairs.sql` applies material
  resolution to the same independent once/weekly emitter (course-less explicit assets/none; auto
  stays pending). Event emitters write the exact effective selector on intentional revisions even
  when template JSON is unchanged. Insertion fallback never rebases later progress/metadata edits.

## Capacity and fixed arrangements (Task10, local migration pending)

- `planning/types.ts` owns shared `TaskDemand`, `CapacityInterval`, `PlanningInput`,
  `TaskAllocation`, `PlanningResult`, `BatchMetrics`, and `PlanningIssue` contracts.
  `availability.ts` and `fixedBlocks.ts` are pure; no React, browser, DB or subject imports.
- Shanghai dates only. `day_states` distinguishes missing/unconfigured, explicit zero and
  configured. Date state/windows replace the complete recurring day. Weekends are manual
  reserve windows; holidays never create capacity. Legacy saved windows backfill states;
  initialization never creates windows. Subtract first, ceil free starts/floor free ends.
- `task_set_availability` atomically appends a window or sets a zero/unconfigured scope;
  `inherit` is date-only and removes the whole override. Preserve accepted blocks on edits.
  Session-store `setAvailability` refreshes the canonical table collections after the RPC.
- Fixed reservations consume union once, including completed/excess blocks. Only nonconflicting
  future whole minutes within capacity and task release/deadline credit remaining demand.
  Expired blocks do not imply execution. Warnings require explicit move/release by the user.
- Block insert/update revalidates current states, windows, unavailable spans, exams, timed
  occurrences/events and recurrence exceptions plus all other retained blocks under lock228.
  Moves also retain the Task5 execution mutation protocol; never write task progress here.
- Capacity/schedule mutations and deletions increment `task_user_planning_revisions` for
  Task13. Trigger locks support authenticated edits and the existing private worker runtime.
  Read the server revision for publication; do not manufacture a client revision counter.

### Fixed execution windows (Task10 review repair)

- `getTaskExecutionWindow(task, now)` is the pure TS counterpart of the SQL
  `task_effective_execution_window`. Use persisted `release_at`; only null legacy release
  falls back to `created_at`. Original nonoverdue deadline remains authoritative.
- Overdue unfinished work uses a future explicit `recovery_due_at`, otherwise a read-only
  suggested Shanghai-today23:59 target. `deadline_source` distinguishes original,
  explicit_recovery, suggested_recovery and missing. Preserve original/recovery metadata;
  after23:59 no silent jump to tomorrow (`recovery_window_elapsed`). Recompute on measured
  Shanghai midnight. Tasks13/14 own an audited editable recovery target, not generic task DML.
- Undated tasks receive no default. Explicit manual fixed blocks may still be saved with
  release/now/capacity/overlap validation; that block's end is its local commitment only.
  Schedule's fixed-only coverage projection uses accepted block endpoints and must not be
  passed as dated movable demand. Tasks11/12 retain uncovered undated work as unknown/pending.
- Fixed overlap detection validates/clips future spans before comparing; elapsed-only overlaps
  cannot suppress useful future credit. Cross-day moves retain the original ID and source
  clock defaults; all task/block ISO boundary comparisons use numeric instants.

## Forecast planning (Task11)

- `@rosie/tasks/planning` exports pure planning functions/types only; safe in browser/server.
  `projectCourseTasks` reuses canonical event enumeration, matching, cursor and deadlines.
  Always provide persisted events AND occurrences, owner ID and a fixed `now`.
- `buildPlanningInput` combines actual remaining execution with forecast by exact source key;
  actual zero/completed/cancelled rows suppress predictions too. Preserve original deadlines
  and shared execution-window recovery source. Never mutate a real cursor while projecting.
- Coverage starts at 28 days, extends through known deadlines and each course's next homework
  deadline, and caps at 180 days. `forecast_boundary`/`outside_forecast_range`/missing metadata
  are incomplete coverage, not zero workload. SQL runtime's 256 preview limit is separate;
  the pure projection is not sliced to 256. Propagate stored runtime issues.
- Undated remaining work lives in `PlanningInput.undated_work`, never ordinary movable demand.
  `commitment_blocks` are explicit local commitments only; Task12 must validate their fixed
  capacity/release/overlap and keep uncovered remaining minutes unknown. No default due is made.
- App-owned `buildTaskPlanningInput` injects the canonical shared-material resolver using a
  readable asset catalog and owned course links. Actual tasks retain immutable material state.
  This pure adapter does not read DB revisions: Task13 owns a consistent snapshot/retry and
  publication check against the persisted planning revision. Do not deduce safety from stale reads.

## Capacity solver (Task12)

- Pure `@rosie/tasks/planning` exports `solveCapacity(input, policy)`,
  `solveCapacityPolicies(input)`, `computeBatchHeadroom`, `computeTodayRequired`.
  Policies are `regular_only` and `allow_weekend`; recommendation is the latter's
  globally minimum-reserve solution. Never greedily lock regular allocations first.
- Flow slices only at window/release/deadline/prior-prediction boundaries (today boundary
  for its counterfactual). Lexicographic vector costs avoid unsafe scalar weights.
  Optimize total, earlier deadline then higher explicit priority, reserve, retained
  prediction overlap, then earlier slice rank. Same-tier demands have equal protection.
- `complete` means no incomplete modeling or hard fixed conflict; numeric shortage alone
  does not make it false. `feasible` additionally requires zero modeled shortage.
  Additive totals and `issue_groups` are always populated by this solver, optional in the
  shared type for compatibility. The shared explicit planningIssues classifier separates historical expiry/advisory release suggestions,
  hard fixed conflicts, and incomplete modeling. Estimated demand retains its certainty.
- Apply fixed blocks exactly once; keep accepted useful allocations and occupied excess
  reservations. Expired historical blocks give no execution credit and are advisory;
  unfinished remaining demand still competes for current capacity. `regular_only` retains useful fixed weekend work and reports
  `fixed_weekend_commitment` / adjustment_required; counterfactuals are unknown.
  Completed/excess future weekend reservations remain occupied/advisory.
  total_weekend_minutes counts useful work, not full reservation occupancy; downstream
  displays derive separate reserved minutes from fixed_blocks.
  Undated commitments use `batch_key=work.key`, `fixed_only=true`, full remaining demand
  and useful fixed allocations; uncovered minutes stay incomplete, never movable. A
  matched missing_deadline issue is resolved only when all that work has valid fixed
  coverage. Other missing-material/configuration issues remain.
- Headroom is independent per batch and must not be summed. It adds work with that
  batch's shared release/deadline while keeping all other work feasible. Heterogeneous
  windows under one batch key return null. Today's true minimum is separately optimized
  globally/per batch across all feasible schedules, including fixed useful minutes.
  Public computeTodayRequired uses allow_weekend; result metrics use their own policy.
  Unknown/infeasible/conflicting bases yield null; suggested today's allocation is not
  the minimum. Today uses Asia/Shanghai even on a non-Shanghai host.
- Conflict groups are conservative connected competition components containing a
  shortage, not minimal Hall sets or claims every member must fail. Defaults use 20%
  headroom for tight status; Task13 may apply user risk settings. Fixed-only batches
  have null headroom because they have no movable deadline.
- Bounded oracle: planning-counterfactual.test enumerates 1152 three-minute inputs and
  27 ownership assignments/input, checking all objectives, today minima and headroom.
  Flow complexity O(F V E K), memory O(E K); counterfactual metrics rerun flow per batch.
  Worker/UI publication and scale benchmarking remain outside this pure module.

## Planning snapshots and worker (Task13, local migration pending)

- `task_planning_input` is a service-only STABLE SQL aggregate: every dependent owned
  table, shared asset catalog, owner revision and shared epoch come from one MVCC view.
  Client list reads are not planning snapshots. Worker uses the exact app input adapter
  and pure two-policy solver. Shared assets increment a global epoch; all snapshots
  compare that epoch as well as owner revision, without locking all owners on asset edits.
- Lock order for publication/adoption is owner advisory228 → shared epoch SHARE → job
  row (publication only). Claim uses only job SKIP LOCKED and never awaits an owner lock.
  Leases last two minutes; renewal cannot revive an expired lease. Interrupted jobs are
  reclaimable, failures back off (20s through capped 2560s). A slower-than-lease solver
  loses publication; no production-scale performance guarantee is made.
- Snapshots expire in at most one minute, earlier at capacity/release/deadline boundaries.
  `task_planning_status` compares both revisions and server time. UI must also evaluate
  `isPlanningStale(status, now)` and render stale/unknown rather than retain a green result.
  `useTaskData` shares planning status/settings/alerts in its existing session store;
  `refreshPlanning/requestPlanning/setPlanningSettings/readPlanningAlert/acceptPlan`
  are the Task14 integration APIs. Reading an alert never resolves it.
- Adoption accepts only server-published movable allocations for actual owner tasks;
  forecast-only entries explicitly fail `forecast_only_allocation`. One transaction
  checks revisions, expiry and current time, then the existing fixed-block triggers
  validate capacity, task windows and overlap. No fabricated task IDs or partial adoption.
- `setRecoveryDue(taskId,due|null,expectedRevision)` calls `task_save_execution`.
  Future recovery targets are valid only for open overdue tasks; original due/progress
  remain untouched and the existing history/revision/dirty protocol applies.
- Background Cron is not installed by the migration. `private.task_install_planning_cron`
  is a later authorized installation seam; it requires pg_cron/pg_net/Vault. Vault names
  are `task_planning_url` (full HTTPS internal endpoint) and `task_planning_cron_secret`,
  matching server-only `TASK_PLANNING_CRON_SECRET`. No secret is returned or logged.
  Status distinguishes missing capability/configuration from configured-but-unverified
  delivery. Actual HTTP execution and production deployment remain unverified.
- Reproduce local SQL/real two-connection tests with
  `node scripts/tmp/task13-planning-validation.mjs`; it initializes a disposable native
  PG instance using the Task4 embedded-postgres dependencies, applies all24 migrations,
  and cleans up with nonzero exit on failure. No env/remote database is used.

## Planning views

`components/planning/PlanningDashboard` integrates the existing planning session snapshot into task home and Schedule. Cards and Gantt share a selected stored policy result; no UI scheduling algorithm. Live `isPlanningStale` expiry removes safe status and disables adoption. Explicit selected movable actual allocations alone use `acceptPlan`; forecast tasks remain unadoptable. RecoveryTargetEditor uses expected-revision `setRecoveryDue`, preserving original overdue metadata. Native popup ownership and mobile/readable-list behavior are documented in UX-CONTRACT.md.

## 课程/任务池/共享物料与容量交付（2026-10-30）

本分支本地实现，远程迁移、Cron、百度真实写入与部署尚未执行。上线、映射统计、停用和恢复清单见 `docs/task-module-rollout.md`，物料权限与传输见 `docs/baidu-materials.md`。任务不回写原学科进度或 `/today`；tasks 仅依赖 core/player，materials 仅依赖 core，应用层桥接目录/物料。旧个人材料和录音不会自动共享。

最终本地验收使用 `node scripts/tmp/task15-acceptance-validation.mjs`（25个相关迁移、全部SQL fixtures、真实MVCC快照与canonical builder/solver发布/采用/恢复）；`--intentional-failure` 清理后应退出1。该临时工具使用独立本机 PostgreSQL，不读 env。`--serve` 提供127.0.0.1:3915的合成身份测试adapter，只供本地验收，不是生产Auth/API。运行时状态须区分未配置、过期与已配置但未证实送达。严禁依据本地测试宣称托管Cron已启用。

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
