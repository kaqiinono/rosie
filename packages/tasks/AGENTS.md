# @rosie/tasks

The timetable lives at `/tasks/timetable`. Load courses, recurrence rules, exceptions, calendars and display preferences through the owner-scoped core session store. Course and rule edits, archives and semester copies use atomic owner-checked RPCs. Compute occurrences and in-page reminders from current schedules. Use forward migrations for schema changes.

Homework management lives at `/tasks/homework` as the 「作业」 tab beside 课程表/日程/课程 (tab list in `components/taskSections.ts`; the other three switch inside `/tasks/timetable`, which also accepts `?section=agenda|courses`). `useHomeworkData` reads/writes `task_homework` (owner RLS) through the `task_homework` session store and patches the cache after each write. Fields: name, subject (chinese/math/english/life), cycle (daily/weekly/biweekly/three_weekly/monthly/custom), times_per_week (weekly/custom, default 1), start/end weekday (weekly) or start/end date (custom), times_per_cycle (positive count for biweekly/three_weekly/monthly, default 1), estimated_minutes (1–120), notes, enabled. Biweekly and three-weekly periods span 14 and 21 days from start_date. Monthly periods use calendar months. Validation in `homework.ts` mirrors the table's check constraints.
Homework priority ranges from P0 (highest) to P4. Existing and new homework default to P2. The homework list shows higher priorities first and keeps the newest entries first within each priority.

The production life tree at /time-tree generates owner-scoped occurrences from these templates.
The homework tab and /today/calendar share the execution records via /api/time-tree.
Template dates and elapsed-time reporting use Asia/Shanghai. Never substitute preview seed data
for a failed request or generate performance timestamps from estimated minutes.

## 练习入口

`/setting/task-entries` maintains owner-scoped named relative-path templates and complete ordered parameter rows. `practiceEntries.ts` owns the pure URL/binding contract; `usePracticeEntries` uses the core session store. Homework selects an entry and a starting row only, storing an immutable `practice_binding` snapshot. Changing unrelated homework fields preserves its binding key. Explicit entry/start changes or syncing creates a new execution version. Subject catalog adapters live in web, not tasks. See `docs/task-practice-entries.md`.

Practice parameter rows may include `content` blocks and multiple `resources`. Resource URLs use stable same-origin media bindings or explicit HTTPS direct links. Auto-discovery status distinguishes errors from empty results; manual edits, deletions and ordering survive refresh. Subject-specific discovery and playback live in web.

Entry management filters its list, quick links and catalog sources by subject. The list and the homework entry menu show the most recently updated entry first. Homework entry choices are restricted to the homework subject; changing that subject clears the entire draft binding (including the starting row), without mutating existing garden snapshots.

Homework starting rows use cascading selectors from optional row `selectionPath` metadata (legacy snapshots infer groups from their existing variables). Parent changes clear descendants and the draft start ID; saving requires a concrete row. Selecting the original starting row preserves the binding key. Classification only locates the starting row: it never filters, sorts or truncates the binding's ordered rows. Catalog adapters populate labels; entry management permits manual hierarchy edits.

`PracticeStartPicker` 从 barrel 导出，可选 `purpose="content"` 用于真实内容预览的逐级定位，隐藏起点保存/递进说明；默认 `start` 行为保持不变。预览不调用 bindEntry 或写入任何绑定。

Content management now selects subject and cascading course scope, with no standalone catalog-kind control. Web generates ordered rows and resolves resources only for the selected scope. `selectionPath` plus row IDs retains the selected snapshot; `values.contentType` and optional `requiresRecite` select shared presentation. No database shape or progression transaction changed. See docs/task-practice-entries.md.
