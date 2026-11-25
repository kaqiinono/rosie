# @rosie/tasks

The timetable lives at `/tasks/timetable`. Load courses, recurrence rules, exceptions, calendars and display preferences through the owner-scoped core session store. Course and rule edits, archives and semester copies use atomic owner-checked RPCs. Compute occurrences and in-page reminders from current schedules. Use forward migrations for schema changes.

The 课程 tab opens the SVAR Willow Gantt overview from the 甘特图 button. The full-screen dialog rotates its content in a portrait viewport and adapts directly to landscape. It inherits the current course filters and semester and offers day, week (default), and month scales. Without a dated semester, it opens on a 12-week window. A custom inclusive date range clips spans and hides rows without visible spans in that range. Each course occupies one row, with spans derived from its scheduled dates, rescheduling, flexible rules, and the cancelled-class filter.

Course priority ranges from P0 (highest) to P4 and defaults to P2 for new and existing courses. Course cards and Gantt rows share one stable priority sort after filtering. Single-course and semester copies inherit the source priority. Priority-only edits use the course revision check and can be saved for ended courses. Migration `20261125035931_task_course_priority.sql` is applied to `rosie-tokyo`.

Homework management lives at `/tasks/homework` as the 「作业」 tab beside 课程表/日程/课程 (tab list in `components/taskSections.ts`; the other three switch inside `/tasks/timetable`, which also accepts `?section=agenda|courses`). `useHomeworkData` reads/writes `task_homework` (owner RLS) through the `task_homework` session store and patches the cache after each write. Fields: name, subject (chinese/math/english/life), cycle (daily/weekly/biweekly/three_weekly/monthly/custom), times_per_week (weekly/custom, default 1), start/end weekday (weekly) or start/end date (custom), times_per_cycle (positive count for biweekly/three_weekly/monthly, default 1), estimated_minutes (0–120), notes, enabled. Biweekly and three-weekly periods span 14 and 21 days from start_date. Monthly periods use calendar months. Validation in `homework.ts` mirrors the table's check constraints.
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
Homework cards expose a preview through the web-provided callback. Web reuses
`HomeworkContentPanel` from the bubble detail panel, using the earliest unfinished occurrence
snapshot or a read-only template/cursor preview when no occurrence exists.
Hosted migration `20261119140300_task_homework_zero_minutes.sql` allows a zero estimate. A zero-minute academic
occurrence pops on click and completes with one flower and the base rewards. Moving between zero and
a positive estimate updates occurrences that have never started, including any split steps.
Life editing hides duration and practice-entry fields and saves a null practice binding.
Life execution normalizes the stored estimate to zero, and list/date totals exclude life durations.
Life templates are daily persistent switches: while enabled, generate one current-day bubble,
including weekends, irrespective of the template's academic recurrence window or duration.
They never split, start a timer or bind practice. A pop atomically completes and grants ordinary
sun/water rewards, leaves a flower and settles a life fruit through the existing daily roll.
Unpopped life instances expire at Shanghai midnight without rewards or diary entries; they
never enter wilted work or historical buds. Disable/delete removes their unfinished instances
on sync. Completed records and their flowers/fruits/rewards remain. Academic rules are unchanged.
The homework tab and /today/calendar share the execution records via /api/time-tree.
The protocol-2 release loads weekly/monthly history by Beijing calendar date and includes
the other steps of each matching occurrence. Edits return the changed rows and account
fields. Storage migration and coordinated rollback are documented in `tree.md`.
Completing today's final non-life, non-skipped task grants one daily rainbow reward atomically
with the garden commit. `time-tree/harvest.ts` settles today's academic flowers early and upgrades
the last academic apple (guarantees one rainbow if below the fruit threshold). `dailyRainbowDay`
and the triggering step's `dailyRainbow` flag prevent repeat rewards; settled flowers are never
counted again at midnight. Partial flower sessions do not qualify as whole-task completion.
Shared StepPanel and the life tree highlight the reward. Existing twelve-apple and blind-box
cooldown rules remain. No migration or historical backfill; see `tree.md` for manual acceptance.
Saving, disabling or deleting a homework template patches its list and requests an owner-scoped
execution sync, even if the tree has not opened. The loaded `time_tree` store then refreshes through
the read-only scene endpoint. A successful template write remains saved if execution sync fails.
Migration `20261117190930_time_tree_sync_revisions` bumps the template revision on each write so
the scheduled job can pick up pending changes. Sync records the revision sampled before reading templates.
Normal sync updates unfinished (including running and overdue) steps' name, subject, priority,
instructions and changed practice binding. Completed/skipped/settled steps stay unchanged.
Timing, estimated minutes, stages, placement, deadlines and occurrence notes follow the existing snapshots,
with duration changes for zero-minute transitions and periodic upgrades described in this guide.
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

作业课程选择旁提供「自动推进」（默认开）、按日/按周/随作业推进，以及按周的推进星期（默认周一）。
随作业推进保存 `progression.mode = 'homework'` 与 `progression.schedule` 排期快照，日期和星期跟随作业，无单独的推进星期。
`homeworkSchedule.ts` 的周期窗口同时用于 web 生成和课程定位：每个 occurrence 使用下一组，
按 occurrence 中的周期起点/序号定位，避免分次收花、拆分、补做、改期或重新生成重复推进。
保存当日所在有效窗口作为首组；若当日不在排期中，下一有效窗口作为首组。改排期生成新 binding key 并重设锚点。
该模式的数学题同样保留份次快照，不因其他作业完成而重排后续组。
「推进数量」与推进方式同一行，默认 1，须为正整数；每份作业包含该数量的连续项，每周期切换下一组（数量 3：1–3、4–6），末组保留剩余项。快照 `items` 保存整组内容及逐项链接，列表和详情完整展示；旧单项快照继续读取 `row`/`href`，不改写。
旧配置缺少 `progression.amount` 时按 1 处理；修改数量同样生成新版本并重设锚点。
保存课程设置时将 `progression` 写入既有 `practice_binding` JSON，无需新增数据库列。
新版本以保存日为锚点；改变起点、规则、周末排期或显式同步会生成新 key 并重设锚点。
按日计算日期差；每日作业关闭周末时仅统计工作日，周末保存时首个工作日仍使用起始项。
按周从锚点之后第一次指定星期起递进；关闭自动推进固定起始项。耗尽不循环。
新规则在生成 occurrence 时保存 `calendarBased` 内容快照，拆分步骤共用同一项，
补做、改期、完成不会改变课程或再次推进，也不受旧 occurrence 占用限制。
普通数学题作业在结算后，按已做的参数行 ID 跳过已完成题目，为未开始且未编辑的后续作业重新分配剩余题目。分次收花和关闭自动推进的配置沿用各自规则。详见 `tree.md`。
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

每周学科作业在设定的周窗口内只有一份；预计耗时是整周目标，每 10 分钟一朵，向上取整。
随作业推进时，每周计划组数决定同一周卡的连续课程组数；收工次数由用户决定。
首次同步合并当前／未来周的未完成任务，保留已有收工和奖励记录。
每两周或每三周的学科作业继续按各份分次收花，自动推进独立选择新份次的课程。
新份次从自己的周期窗口起点出现。普通同步将尚未开始、未完成、未编辑题目或手动改期的
当前/未来旧份次补为分次收花；同份旧拆分步骤合并，保留总计划时长、已有课程快照和各步备注。
当前周期的旧排期提前到今天，未来周期使用窗口起点；已有收花、计时、奖励或历史记录的份次保留。
花位按预计耗时每 10 分钟一朵向上取整。题目进度从本份练习中的具体题目 ID 和答对记录派生；
有具体题目时显示完成数/总数，无具体题目时隐藏。
累计实际用时每满 10 分钟自动选中一朵花，保存进度时服务器按同一规则结算。
每次收工保留相同 occurrence、练习快照和独立的每日记录；完成整份才推进练习游标。
作业内嵌数学题按实际答对的 problemId 对本份去重。
