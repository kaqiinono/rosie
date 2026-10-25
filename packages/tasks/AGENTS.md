# @rosie/tasks

Independent timetable, task templates, course confirmations, time planning and reminders.
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
