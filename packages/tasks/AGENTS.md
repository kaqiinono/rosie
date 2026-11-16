# @rosie/tasks

The timetable lives at `/tasks/timetable`. Load courses, recurrence rules, exceptions, calendars and display preferences through the owner-scoped core session store. Course and rule edits, archives and semester copies use atomic owner-checked RPCs. Compute occurrences and in-page reminders from current schedules. Use forward migrations for schema changes.

Homework management lives at `/tasks/homework` as the 「作业」 tab beside 课程表/日程/课程 (tab list in `components/taskSections.ts`; the other three switch inside `/tasks/timetable`, which also accepts `?section=agenda|courses`). `useHomeworkData` reads/writes `task_homework` (owner RLS) through the `task_homework` session store and patches the cache after each write. Fields: name, subject (chinese/math/english/life), cycle (daily/weekly/biweekly/three_weekly/monthly/custom), times_per_week (weekly/custom, default 1), start/end weekday (weekly) or start/end date (custom), times_per_cycle (positive count for biweekly/three_weekly/monthly, default 1), estimated_minutes (1–120), notes, enabled. Biweekly and three-weekly periods span 14 and 21 days from start_date. Monthly periods use calendar months. Validation in `homework.ts` mirrors the table's check constraints.
Homework priority ranges from P0 (highest) to P4. Existing and new homework default to P2. The homework list shows higher priorities first and keeps the newest entries first within each priority.

Daily homework has an `include_weekends` switch beside its cycle selector. New definitions default
to false (Monday–Friday); migration `20261115104319_task_homework_include_weekends.sql` preserves
true for existing rows and sets the insert default to false. Missing legacy values mean true.
Only daily schedules read this flag. On garden sync, current/future unstarted weekend occurrences
are held in `weekendExcludedSteps`, with notes preserved; started/completed/history and explicitly
moved weekday occurrences remain intact. Whole split groups are handled together. Preview-only
practice reservations are released without advancement and rebind on reopening after restoration.
The migration was applied on 2026-11-15; column default and remote history were confirmed. Build/test/manual acceptance
are left to the user: verify new vs existing defaults, weekends off/on, preserved notes/history,
split tasks and an already-started weekend task.

The production life tree at /time-tree generates owner-scoped occurrences from these templates.
Life templates are daily persistent switches: while enabled, generate one current-day bubble,
including weekends, irrespective of the template's academic recurrence window or duration.
They never split, start a timer or bind practice. A pop atomically completes and grants ordinary
sun/water rewards, leaves a flower and settles a life fruit through the existing daily roll.
Unpopped life instances expire at Shanghai midnight without rewards or diary entries; they
never enter wilted work or historical buds. Disable/delete removes their unfinished instances
on sync. Completed records and their flowers/fruits/rewards remain. Academic rules are unchanged.
The homework tab and /today/calendar share the execution records via /api/time-tree.
Saving a homework template patches its list and awaits an owner-scoped refresh of the registered
`time_tree` session store, including when its view is unmounted or initially loading. A failed
derived refresh does not repeat the successful insert; its error remains on the tree store.
Normal sync updates unfinished (including running and overdue) steps' name, subject, priority,
instructions and changed practice binding. Completed/skipped/settled steps stay unchanged.
Timing, estimated minutes, stages, placement, deadlines and occurrence notes stay intact.
Changing bindings releases obsolete legacy reservations without advancing them; completed split
parts keep their original content while unfinished parts receive the new content.
Both execution views expose 重新生成作业. The default inclusive range is today through today + 6;
only today/future ranges within the next year are accepted. Preview counts replaceable step records
(including unstarted weekend holding records). Replacement operates on whole occurrences: every
split part must be inside the range, nonhistorical and untouched. Started/completed/skipped/settled
or audited work is retained. Confirmation carries the preview garden revision and count; conflicts
require a fresh preview. The server uses current enabled homework definitions, releases only removed
legacy reservations and commits through the existing garden RPC. No database migration is needed.
Unstarted replacement records lose their old per-occurrence notes and snapshots; the dialog says so.
Template dates and elapsed-time reporting use Asia/Shanghai. Never substitute preview seed data
for a failed request or generate performance timestamps from estimated minutes.

## 练习入口

作业课程选择旁提供「自动推进」（默认开）、按日/按周，以及按周的推进星期（默认周一）。
「推进数量」与推进方式同一行，默认 1，须为正整数；每份作业包含该数量的连续项，每周期切换下一组（数量 3：1–3、4–6），末组保留剩余项。快照 `items` 保存整组内容及逐项链接，列表和详情完整展示；旧单项快照继续读取 `row`/`href`，不改写。
旧配置缺少 `progression.amount` 时按 1 处理；修改数量同样生成新版本并重设锚点。
保存课程设置时将 `progression` 写入既有 `practice_binding` JSON，无需新增数据库列。
新版本以保存日为锚点；改变起点、规则、周末排期或显式同步会生成新 key 并重设锚点。
按日计算日期差；每日作业关闭周末时仅统计工作日，周末保存时首个工作日仍使用起始项。
按周从锚点之后第一次指定星期起递进；关闭自动推进固定起始项。耗尽不循环。
新规则在生成 occurrence 时保存 `calendarBased` 内容快照，拆分步骤共用同一项，
补做、改期、完成不会改变课程或再次推进，也不受旧 occurrence 占用限制。
已完成快照保留；编辑保存后未完成步骤同步新 binding，旧 binding 未改时仍按原完成游标运行。
周末暂存保留日期课程快照，只有旧游标的预览占用会释放。只读列表和生成/开始共用日期解析。
手动验收：周五到周一不跳课、周末新建的首个工作日、指定星期切换、未完成仍按日期推进、
关闭固定课程、同周重复课程、拆分与补做、耗尽、编辑后仅未完成快照更新；本次未运行检查或测试。

`/setting/task-entries` maintains owner-scoped named relative-path templates and complete ordered parameter rows. `practiceEntries.ts` owns the pure URL/binding contract; `usePracticeEntries` uses the core session store. Homework selects an entry and a starting row only, storing an immutable `practice_binding` snapshot. Changing unrelated homework fields preserves its binding key. Explicit entry/start changes or syncing creates a new execution version. Subject catalog adapters live in web, not tasks. See `docs/task-practice-entries.md`.

Practice parameter rows may include `content` blocks and multiple `resources`. Resource URLs use stable same-origin media bindings or explicit HTTPS direct links. Auto-discovery status distinguishes errors from empty results; manual edits, deletions and ordering survive refresh. Subject-specific discovery and playback live in web.

Entry management filters its list, quick links and catalog sources by subject. The list and the homework entry menu show the most recently updated entry first. Homework entry choices are restricted to the homework subject; changing that subject clears the entire draft binding (including the starting row), without mutating existing garden snapshots.

Homework starting rows use cascading selectors from optional row `selectionPath` metadata (legacy snapshots infer groups from their existing variables). Parent changes clear descendants and the draft start ID; saving requires a concrete row. Selecting the original starting row preserves the binding key. Classification only locates the starting row: it never filters, sorts or truncates the binding's ordered rows. Catalog adapters populate labels; entry management permits manual hierarchy edits.

`PracticeStartPicker` 从 barrel 导出，可选 `purpose="content"` 用于真实内容预览的逐级定位，隐藏起点保存/递进说明；默认 `start` 行为保持不变。预览不调用 bindEntry 或写入任何绑定。

`useHomeworkData` 从 barrel 导出，生命树日期任务列表复用其账户会话缓存读取作业配置。
列表的未绑定内容预览由 web 根据配置与 garden 游标只读派生，不调用绑定或递进操作。

Content management now selects subject and cascading course scope, with no standalone catalog-kind control. Web generates ordered rows and resolves resources only for the selected scope. `selectionPath` plus row IDs retains the selected snapshot; `values.contentType` and optional `requiresRecite` select shared presentation. No database shape or progression transaction changed. See docs/task-practice-entries.md.

First-use presets and course additions share web's `buildCatalog` metadata and
`generateCatalogRows` ordering/resource resolution. New English rows use numeric stage/unit/lesson/
paragraph/sentence order; other subjects retain authoritative curriculum order. Adding courses
retains existing row objects and their manual relative order, appending new ordered rows. Opening
entry management loads the saved list and does not read the setup receipt. Clicking 内容预设
creates the current presets when no receipt exists; later clicks update same-subject, same-name
preset rows and insert presets that are missing. Homework bindings are not auto-synchronized.
