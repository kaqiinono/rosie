# @rosie/tasks

The timetable lives at `/tasks/timetable`. Load courses, recurrence rules, exceptions, calendars and display preferences through the owner-scoped core session store. Course and rule edits, archives and semester copies use atomic owner-checked RPCs. Compute occurrences and in-page reminders from current schedules. Use forward migrations for schema changes.

Homework management lives at `/tasks/homework` as the 「作业」 tab beside 课程表/日程/课程 (tab list in `components/taskSections.ts`; the other three switch inside `/tasks/timetable`, which also accepts `?section=agenda|courses`). `useHomeworkData` reads/writes `task_homework` (owner RLS) through the `task_homework` session store and patches the cache after each write. Fields: name, subject (chinese/math/english/life), cycle (daily/weekly/biweekly/three_weekly/monthly/custom), times_per_week (weekly/custom, default 1), start/end weekday (weekly) or start/end date (custom), times_per_cycle (positive count for biweekly/three_weekly/monthly, default 1), estimated_minutes (1–120), notes, enabled. Biweekly and three-weekly periods span 14 and 21 days from start_date. Monthly periods use calendar months. Validation in `homework.ts` mirrors the table's check constraints.
Homework priority ranges from P0 (highest) to P4. Existing and new homework default to P2. The homework list shows higher priorities first and keeps the newest entries first within each priority.

The production life tree at /time-tree generates owner-scoped occurrences from these templates.
The homework tab and /today/calendar share the execution records via /api/time-tree.
Template dates and elapsed-time reporting use Asia/Shanghai. Never substitute preview seed data
for a failed request or generate performance timestamps from estimated minutes.
