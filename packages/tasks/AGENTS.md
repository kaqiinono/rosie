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
