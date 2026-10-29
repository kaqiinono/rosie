# Tasks timetable interaction contract

- Language: simplified Chinese; date-only values are YYYY-MM-DD; scheduling timezone Asia/Shanghai. Dates include both endpoints. Week interval uses a stable anchor week.
- Data owner: useTaskData user session store. Persistent preferences, courses, calendars, exams and snapshots live in Supabase. Local state is only an unsaved draft or active view.
- Select/date/time controls: platform-owned native controls are accepted for reliable keyboard and touch operation; authored surrounding fields remain Chinese and explicitly labelled. Do not promise popup styling owned by the OS.
- Modal owner: timetable shared Dialog primitive. Use native dialog modal behavior where possible (focus containment, Escape, restoration); explain destructive actions in product-owned confirmation screens. No window.alert/confirm/prompt.
- Course subjects use a native select, including “不选择科目” (`other`) and previously stored subjects. The time picker uses TimetableDialog. Escape closes only the active picker and returns focus to its trigger. Time changes update the draft immediately; “完成” closes the picker. The course form disables editable controls while saving. Name/notes/date/period fields highlight their containing row; focus indicators use shared courseFormStyles and do not resize controls.
- Forms: stable Save/Cancel actions; field validation and inline error; disabled/busy submit; preserve data on network errors; warn before discarding changed drafts. New course save includes all slots atomically.
- Navigation: clicking a lesson always opens detail, including confirmed lessons. Editing lesson data and editing one occurrence are distinct actions. Cancelling returns to the same view/date.
- Recurrence editing: preserve confirmed history; edit only this occurrence or from a named effective date. Restoring an exception restores the rule, not another duplicate occurrence.
- Lifecycle: archive/restore by default; do not expose a direct hard-delete path for a course. Imports and snapshot restores preview scope and preserve learning records.
- Feedback: existing TasksPage alert/status message with accessible live text; modal failures must also be visible in the modal.
- Colors: use visible swatches with a selected checkmark, a custom color picker and live preview. Calendar blocks, course-card headers, details and image exports share a pastel presentation derived from the persisted color via coursePastelColor, with slate-800 text. Picker swatches retain the original base color. Course identity is stable; confirmation/cancellation/conflict is text plus an icon/badge. Cancelled lessons do not occupy busy lanes.
- Notifications: station-only. No permission prompt, service-worker push, background scheduler or notification guarantee while closed.
- Transfer: only timetable configuration, exams and exceptions; never upload private audio or export learning/task records as a share. Reject malformed/unimplemented ICS rules instead of silently changing schedules.
- Accessibility: keyboard-accessible buttons/links, explicit labels, focus return, reduced motion; any drag enhancement has a form alternative.

## Task pool

- Reuse `shared.tsx` fields/panels/buttons and the TasksPage feedback owner. Scope and material controls are shared by pool activities and course bindings in `CourseTaskBindings.tsx`; native selects keep OS-owned popup behavior.
- New course bindings are local controlled drafts, with no pre-save network mutation. Save atomically with the course. Individual bindings may be paused while preserving their overrides.
- Scope selection shows catalog titles and full book/unit context; identity is the stable catalog key. Existing unseen scope values survive editing.
- Material overrides support follow-course/none and an application picker slot; no raw UUID fields. Missing materials are a visible pending condition, never an instruction to omit work.
- `/tasks/templates` redirects to `/tasks/pool`; legacy row IDs and generated task history are unchanged.
- Task 3 execution authorization supersedes the historical manual-only local-check restriction for this session.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Select/Listbox | shared.tsx and CourseTaskBindings.tsx native selects | Existing native-control policy above | native | course-task-bindings.test.tsx; manual OS popup |
| Date | Existing native date/time fields; TimetableDialog time picker | Existing native-control policy above | native | manual Asia/Shanghai/date keyboard |
| Form | shared.tsx Field and TasksPage run | Existing form/feedback contract above | create/edit | focused bindings tests; manual network error |
| Scrollbar | apps/web/src/app/globals.css | DESIGN.md runtime ownership | global | manual narrow viewport |
| Toast | TasksPage alert/status | Existing feedback contract above | inline error | manual error/retry |
| CRUD | useTaskData session store | Package AGENTS.md and existing lifecycle rules | persistent owned rows / controlled draft | task-pool-initialize.sql; bindings interactions |
