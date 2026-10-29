# @rosie/tasks

Independent timetable, task pool activities, course confirmations, time planning and reminders.
Routes are `/tasks/**`; `/today` and all subject progress remain independent.

- Dependencies: core and player only. App-owned `TasksHost` supplies Chinese, math and
  English catalogs through `TaskCatalogAdapter`. Never import subject packages here.
- `useTaskData` owns a user session store. Route remounts reuse it; explicit refresh and
  visibility/minute refresh generate and reconcile station-only tasks. User data lives in Supabase.
- `task_confirm_course` atomically records confirmation/progress and emits tasks. The
  per-user transaction lock plus unique source keys protect retries and multiple devices.
- Generated tasks snapshot their template. Template edits apply to future tasks. Only
  course-relative deadlines/reminders follow timetable changes; fixed overrides remain fixed.
- Private audio is stored under `task-audio/<user id>/...`. Signed URLs must not enter
  shared service-worker caches. Playback repeats one clip until the learner moves on.
- New UI uses global theme utilities. Its Tailwind scan source is registered in globals.css.
- The task migration has been applied to the linked project. There is no system push,
  notification permission, push secret or Cron requirement. The authenticated page calls
  task_tick on initial load, explicit refresh and visible-page minute refresh.
  Historical push tables/functions remain unused for migration-history compatibility. See README.md.
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
