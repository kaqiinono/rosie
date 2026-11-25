# Rosie design context

## Theater subtitle editing

The subtitle list opens the shared editor with the selected language and cue. The editor
keeps the selection fixed while auditioning a range. Split and insert offer a playhead
and editable timestamps. The delete confirmation shows the sentence before saving.
Each subtitle row keeps the timestamp on the left and the actions on the right.
The subtitle list and current dialogue share borderless action strips with evenly spaced,
equal-width cells. Each strip stays on the same line as its timestamp or heading.
Both views highlight the same dialogue cue, including when playback pauses or buffers.
The pencil opens the editor. Split, merge and delete save directly from the row for
its primary language, with the existing editing controls still available in the editor.
Saving refreshes the timeline in place. Baidu sync stays an explicit action in the list.

## Audio alignment

The admin toolbox pairs a scrollable sentence list with the selected sentence, the original
audio and two timestamp controls. On narrow screens, the marking controls lead. The default
list shows pending sentences. Saving or marking a sentence as skipped takes effect immediately
and moves to the next pending sentence. An error keeps the selected sentence and both marks
available for correction. Keyboard and touch users share the same marking and save actions.
In 全部, the sentence list scrolls to the audio position and the editor follows saved timing
ranges. Previewing a selection or editing an unsaved range keeps the edit target pinned.

## Running bubble completion (approved 2026-11-16)

Starting a task keeps its content panel mounted and open, with the timer and completion
controls available beside the learning content. 收起，继续计时 hides the panel without ending
the task. Clicking a running bubble reopens its details; completion is available in the
panel, with the existing hold-until-full-and-release gesture retained as a shortcut. While saving,
its content gently pulses, amber dots orbit it and 正在开花… remains visible; no fabricated
percentage is shown. Repeated bubble activation is locked through saving and blooming.
Successful persistence leads to burst, seed flight and flower opening, then the actual
reward dialog. A failed finish retains the task; a failed pop after finish retries only pop.
Reduced motion uses static saving feedback and skips the animation wait.

Running task details use AppDialog's fixed footer for elapsed/remaining time, completion,
collapse and save-error feedback. The learning content scrolls independently above it;
the footer reserves its own space and respects the device bottom safe area. Both life-tree
details and homework details share these controls; parent time-entry forms stay in the body.

The 今日英语计划 preset offers 开始单词练习 in the life-tree task drawer. The practice uses
the task's original scheduled date, including after rescheduling or makeup. When two plans
assign words on that date, the later-starting plan takes priority. The timer has its own start action.

## Makeup bubbles (approved 2026-11-16)

Academic bubbles whose original scheduled date precedes today retain their subject color
and display a small amber bow at the upper right and an amber candy-shaped date badge below
(`MM/DD`, without 原定). Moving an old task to today preserves this marker. Today's original
tasks and life bubbles have no marker. Decorations do not intercept bubble interactions;
the accessible name includes the original date. Shared garden Bubbles and garden.css own
the rendering; the production scene adapter supplies the original scheduled date.

## Life-tree menu (approved 2026-11-15)

The minimize icon stays outside the status panel, beside the mobile menu trigger.
The mobile popover uses a narrow single column, one status or action per row;
the desktop status panel keeps its inline layout.
Its trigger is the shared 🌼 小口袋 button: cream paper, warm outline, rounded sticker
shape and a pressed bottom edge. A slight flower tilt signals the open state; no chevron.

## Task-entry reading drawers (approved 2026-11-15)

Life-tree bubble details, date-task lists and the homework-content preview share the same
sentence playback and reading drawer as content management. Single-sentence resources use
one playback/replay control plus loop, preferring 句子听记 then 原文单句; recitation labels remain.
Whole-passage and sentence 查看全文 opens the existing bottom drawer and stops inline audio.
Reading content has no duplicate route-navigation detail button. ResourcePlayer owns the
shared playback implementation separately from the row renderer to avoid circular imports.

Reading previews open the shared original reader in an AppDialog drawer. Sentence previews
use the same bottom drawer (92dvh, rounded top corners), with a light paper reading background.
The standalone reading route retains its existing dark background. Sentence previews
retain their compact listening controls and offer 查看全文 for the same drawer. The drawer only
hosts the reader and closes it: the original layout, navigation, floating playback/listening
controls and reading-progress behavior are preserved. The host supplies the passage key and
scroll container so scrolling targets the drawer. Opening it stops the sentence player;
closing it unmounts all reading audio while preserving the editor draft. Build and runtime
checks remain manual.

## Exam responsive media (approved 2026-11-14)

Authored widths cap images rather than force a fixed footprint. Image options form complete
label-and-image cards in a wrapping Flex row. Each card has a readable minimum derived from
the authored image width, clamped to 224–320px and capped by the container. Readability wins
over keeping all three options on one line: narrow screens may show one option per row.
Read-only admin previews and student activities offer a full-viewport image-and-answer view:
clicking an image opens its activity, removes image width caps and scrolls to that image.
Answer state stays shared; the existing audio engine remains mounted, with transport controls
in the dialog footer. The authoring mode keeps its independent image editor.
Repeated references to the same audio slot are consolidated beside the activity heading.
Distinct slots/segments remain separate, even if their track labels match. These presentation
changes neither approve nor publish exam content. Build and interaction verification remain
manual per the user's workflow.

## Exam question alignment (approved 2026-11-14)

Exam questions use borderless white StickerCard soft surfaces with 16px radius and 12px
padding; background contrast replaces repeated outlines. Classification uses an auto-fit grid
whose minimum column width combines the longest measured full prompt, 32px choice circles, gaps and the
authoring rail only when edit mode is active. Read-only/student layouts reserve no edit space;
column sizing uses the actual spacing tokens and padding rather than a fixed extra allowance.
Sentence prompts use the same intrinsic measurement as short words; reduce columns before
wrapping an otherwise fitting prompt-and-choice row. Use as many readable columns as fit,
without forcing three columns or leaving the fixed-width 24rem strip from the earlier design.
Short text-only prompts (up to three words/24 characters throughout the scored group) share
a measured regular 18px column. Numbers stay secondary and centered; options remain nearby.
All letter/judgment prompts and examples use row-first wrapping Flex: options share the row
whenever space permits, and wrap below only when necessary. Gray choices become deep blue with bold
white lettering when selected; keyboard focus keeps its visible outline.
Examples are full-width pale-yellow strips with a clear label. When the public authored
example explicitly identifies a choice, highlight it within the complete, non-interactive
option set; otherwise keep all options neutral and retain the example text without guessing.
Handwriting surfaces auto-fit at a 20rem minimum and retain full-width word answers.
Generic question and image-choice surfaces also omit decorative borders. Functional input
boundaries remain. Shared passages and inline answer typography remain unchanged. The admin
edit rail and colored dashed selection outlines appear only in edit mode. Validation remains
manual per project instructions.

This document records the existing light-theme foundation and the approved tasks timetable direction. It does not redesign other subject modules.

## Runtime ownership

- Global color, radius, font and animation tokens: `apps/web/src/app/globals.css`.
- Existing typeface: PingFang SC / Hiragino Sans GB / Microsoft YaHei / system sans; retain it for Chinese readability. Use tabular numerals for times and dates.
- Tasks shared form primitives: `packages/tasks/src/components/shared.tsx`.
- Tasks timetable primitives and palette: `packages/tasks/src/components/timetable/` and `packages/tasks/src/timetable.ts`.
- Course-editor and picker control styles: `packages/tasks/src/components/timetable/courseFormStyles.ts`, composed from the existing Tailwind emerald/slate palette.
- No new dependency on another subject or `@rosie/ui` from tasks.

## Tasks timetable (updated and approved 2026-10-24)

Audience: Rosie and the parent arranging school and extracurricular classes. The primary job is seeing and maintaining the actual weekly schedule, with learning tasks linked underneath.

Visual signature: a white calendar workspace with a narrow deep-green date-heading accent and a solid green circle identifying today. The page shell owns the single “任务管理” title; the calendar header leads with the displayed date range. Course blocks retain their stable colors. Keep the rest of /tasks visually compatible with the existing light surfaces.

Palette uses the existing Tailwind emerald-800/900 for primary actions, active navigation and today's date, emerald-50 for subtle emphasis, white for paper, slate-100/200 for rules, slate-800/900 for readable text and amber-50/800 for cautions. The current-time line uses rose-500. These are existing Tailwind palette utilities; shared semantic tokens remain owned by globals.css. Course colors are persisted hex values selected from 19 visible swatches or a custom picker. The selected swatch has a checkmark and the editor previews it immediately. Calendar blocks, month entries, course-card headers, details and image exports share coursePastelColor: a macaron tint derived from 22% of the saved course color and 78% white, with slate-800 text. Picker swatches retain the saved base color and contrast-aware black/white checkmarks; completion badges never replace course identity. Card metadata uses a white surface. Cards use a full-height flex column, a consistent 112px minimum header, and a bottom-aligned detail action so differing schedule lengths do not shift their headers.

Typography: heading 24–28px, panel titles 18–20px, course names 13–15px, auxiliary text 11–12px. Never shrink long notes to fit a course block; truncate with a full detail view. Short courses remain discoverable through list/day views.

Layout: all /tasks tabs share a max-w-7xl outer container, one stable “任务管理” heading and a 56px sticky navigation row. Navigation uses an underline and horizontal overflow on narrow screens, with equal border widths for active and inactive items. Tab links preserve scroll position; loading and content regions reserve at least 24rem of height while retaining natural document scrolling. The application root reserves scrollbar space through globals.css to prevent horizontal shifts between short and long routes. Day calendars fit their columns to the container. Week view shows two consecutive weeks horizontally, with one week fitting the viewport and the next reached by scrolling right; its date range and statistics cover both weeks, while navigation advances one week. Both views scale hour rows to the remaining viewport height (32px minimum). They use natural page scrolling on short screens, with no internal vertical scroll surface; scrolling does not change the time scale. Very narrow containers allow horizontal scrolling with a 64px minimum day column and a frozen, opaque time-axis column above course blocks. Default narrow-screen view is a day, with a seven-date shortcut strip and a week option available. Date navigation and view selection form the first toolbar row; search, filter disclosure and a More toggle form the next. Settings and transfer actions appear in an expandable panel only when More is activated. The compact date header keeps its year, calendar and metrics together below the date title. Active filters remain visible when the filter panel is collapsed. Forms use a responsive modal/fullscreen narrow layout with persistent actions.

Density: date/view controls use 40–44px targets; the main date title is 18–20px and summary metrics are inline. Short time blocks prioritize the course name, adding status, location and teacher only when height permits; time text is omitted from day/week blocks and remains available in accessible labels and details; the full lesson details remain available on activation. Agenda entries are grouped under date headings. Month cells share the same emerald today marker, muted grid lines and course palette.

Month view fits seven weekday columns across the available width. Compact day cells use
one line per course and show times alongside names on wide screens. A day with more than
three courses shows the first two and a count that opens its day view. Date arrows follow
the active calendar granularity: one day, one week or one calendar month per click.

Course form: use a white sticky action header, slate-50 canvas and white rounded groups for course information, schedule, colors and advanced settings. Labels remain visible above 16px values; 22px outline icons share a 48px (56px on wider screens) column. Input focus belongs to the whole row: emerald-50 tint plus a 2px inset emerald-600 ring. Buttons and picker options use the same inset focus treatment; solid emerald actions use a lighter emerald-300 ring. Focus must not change borders, dimensions or alignment. Course name does not autofocus on opening. Color swatches wrap, notes use a single-line-high textarea that preserves existing multiline content, subjects use a native dropdown, and the time picker uses TimetableDialog. Groups reserve 4px of inner space and each row has its own rounded-xl corners so focus rings remain clear of the outer clipping boundary.

## Verification boundary

User explicitly reserves all build/test/lint/typecheck/browser verification for manual execution. Source review is not evidence of rendered accessibility or visual correctness. Manual scenarios are recorded in the tasks README.

Exam authoring readiness uses Chinese, actionable tasks rather than raw validator output.
Show the original question number, material/resource label and source page where available;
merge only duplicate diagnostics for the same location. Keep blockers and incomplete-report
warnings first, show six tasks initially, and disclose the remaining count. Raw paths, codes
and original messages belong in optional technical details. Use existing StickerCard and
Themes controls; preserve publication gates and prevent leaving with unsaved edits through
new task links. Empty task lists never imply approval to publish.

## Math question-bank filters

Keep the original lesson-themed gradient panel, stacked filter groups, capsule buttons,
emoji labels, difficulty stars, and progress bar. Practice and mastery remain button groups.
The only layout addition is an explicit filter disclosure beside the title, collapsed by default. It hides the
source, type, difficulty, practice, mastery, favorite, and solution-display controls while
preserving their state. The title, question count, progress, start-practice action, and
question-expansion action remain visible. Filter disclosure and question expansion are
independent controls.

## Math video replay

Shared owner: `packages/math-kit/src/components/shared/ProblemVideoReplay.tsx`.
Cards use a light, child-friendly question-index style: white surfaces, 1px slate borders, 12px
corners, subtle shadows, and 16px content padding. Card borders follow practice status;
growth icons retain their mastery meaning. Question numbers use compact pale-blue markers,
14px semibold titles lead, and secondary metadata shows difficulty as “难度 2/5”.
Knowledge-point labels retain each lesson's original `tagStyles` category colors in both
normal and expanded cards; these colors carry meaning and must not be neutralized.
Card top accents, borders, and footer tints use `utils/problem-practice-style.ts`:
zero practices = warm amber; one or more practices = emerald green. Difficulty uses neutral
text only. Knowledge-point labels keep their existing category colors. A footer without
practice-count data stays neutral rather than guessing the user's status.
Hover adds a slight positional lift and soft blue shadow; reduced-motion removes the lift.
Use relative positioning for this lift, not transforms that would trap fixed draft overlays.
Practice status is explicit: amber exclamation pills mark “未练”, while green check pills
show “已练 N 次” with effort-based encouragement. Practice count never implies correctness
or mastery. Keep reminders gentle and static, with no flashing or alarming red treatment.
Cards and question details share `ProblemCardActions` as a bottom action bar, separated
from content by a subtle top border and a faint practice-status tint. Analysis, electronic draft,
paper draft upload, favorite, and optional expand controls stay on the left. Replay occupies
a separate rightmost grid column even when the left group wraps. All functional icons use
`ProblemActionIcon`: 18px outline SVGs with 1.75px strokes and 30px control slots; the footer
is approximately 39px high before wrapping, with 4px vertical padding. Neutral
controls have no colored circles; only replay and an active favorite use blue emphasis.
Buttons expose accessible labels and native title hints, with a soft sky-blue hover background.
Analysis is an icon-only informational marker with a title hint and screen-reader label.
Keep actions outside the primary
card link. Question numbering and titles align above, with wrapping metadata below.
Card, detail, and replay labels prefer nonempty `displayId`; missing numbers display the
question suffix without the grade/lesson prefix (`2-10-L1` → `L1`), preserving `L1-1a` in full.
Expanded cards own a single footer below their inline content; nested details suppress
their own footer. Detail headers contain only navigation, title, and learning metadata.
Retain the existing
Chinese font and `app-blue-light`, `app-blue-dark`, `surface`, and text tokens from globals.css.
The video opens in a native modal dialog with focus containment, Escape/close dismissal,
loading and retry states; closing unmounts playback and restores focus to its trigger.

Replay visibility is based on the last manually synchronized video catalog. Only confirmed
matches show the blue replay button; missing, loading, unsynced and failed lookups show no
button, text or placeholder. The other footer actions retain their positions.

The settings/admin hubs show a “同步管理” navigation card. `/admin/sync` contains Baidu
authorization, grade/lesson selectors, manual math-video synchronization and an inline,
collapsible matching report. OAuth callbacks return here. Existing lesson snapshots are reused;
“重新同步本讲” explicitly searches again. Reuse Chinese typography and surface/text/blue tokens;
no new visual system. The report uses the shared `SelectControl`, 44px controls, readable
wrapping file paths, explicit empty/error states and 20-row pagination. Filters/search are
temporary local inspection state within this disclosure, not URL navigation state. The report
shows its snapshot time in Asia/Shanghai; filtering never calls Baidu. Copy feedback uses a
local live region alongside visible copyable paths. Report requests compare only the selected
lesson and its saved snapshot; files without that lesson's filename prefix cannot be discovered
in this report. Verification remains manual, per project policy.

Matching reports open on unmatched files first, showing actual paths, parsed question numbers
and reasons. Headline counts are per file, not per question; one video used by multiple questions
counts once. A file can open the full-lesson ID/displayId/expected-name comparison with its path
kept visible. Source checkboxes beside grade/lesson default to classroom questions and only filter
the secondary question view and its counts. File matching always uses every source in the lesson.
Source changes reuse the loaded report and never trigger synchronization.

## Task pool (approved course-domain extension, 2026-10-29)

The task pool reuses the existing tasks shell, emerald actions, slate borders, white panels and responsive two-column form. No new palette or typography. `components/CourseTaskBindings.tsx` owns reusable native scope/material selectors and controlled course-binding drafts. Catalog labels retain book/unit context; unresolved materials use explicit amber text. Old template URLs redirect to the pool; historical template identifiers remain stable. The established package UX contract owns native popup geometry and save/error behavior.

## Task execution progress

Task cards retain the existing white/slate/emerald surfaces and shared Field/button utilities.
Ordinary activities show a numeric percentage editor and remaining minutes; item activities show
real checkboxes. Pending math selections keep their estimate visible; explicit no-homework is a
separate action. Math filters use native labeled lesson/group/tag selects, matching the existing
course picker. Verified replay uses the application-owned shared math replay component. Validation
stays visible next to progress controls; mutation errors remain in the shared task-page alert.
Native select popups and date/datetime fields in execution forms remain browser/OS-owned, including
calendar locale and popup geometry. Execution forms own validation (`noValidate`); multi-line
content uses a fixed minimum height and resize-none to keep adjacent controls stable.

## Shared materials

Shared material screens reuse the tasks white/slate/emerald panels, Chinese typography and controls.
Course detail, pool and binding selectors receive the same application-owned material picker. Subject
is a default filter; explicit cross-subject selection is supported. Native select popups remain OS-owned.
Catalog search/filter/page limits are transient inspection state. Lists expose loading/error/empty/count
states and explicit load more. Text/link preview authenticates access; archiving uses inline confirmation
explaining retained references. Metadata edits preserve content; replacement is a new asset.

Directory import extends shared materials with a folder-first, explicit-review flow. Server roots and
relative paths stay visible; partial results show completion state and a resumable scan number.
Each candidate uses a native range selector and defaults to no association, including exact matches.
Bulk confirmation uses the existing atomic link API; stale account/session failures preserve selections
and existing links. Course detail shows original folder paths and a transient association filter.

Directory review pages retain selections across result batches and expose “恢复最新进度” while a
scan is active. Starting a scan creates its checkpoint then reads the first provider page. Review
paging is independent of scan continuation; a summary lists the cross-page choices before confirmation.

Material upload uses the shared white/slate/emerald form and native labeled subject/file/course/range
controls. Subject starts unselected. Progress names hashing/uploading/verifying; durable session number
stays visible after errors. Recovery requires the original file, and uncertain results offer explicit
verification or cancel/restart. Cancel explains retained provider files. Successful verification exposes
an explicit course/scope association through the existing atomic link API. Passive media previews use
native controls; other files offer authenticated download. No automatic association or animation.

## Manual task availability and fixed arrangements

Schedule retains shared white/slate/emerald panels and native OS-owned date/time/select fields.
Seven day chips distinguish 待配置 / 明确不可用 / 已配置时段; weekend chips say 备用.
A date override replaces the full recurring day. Fixed arrangement warnings use explicit amber
text and manual 移动安排 / 释放时间 actions. Completed/excess retained reservations stay visible.
Both Schedule forms own validation via noValidate/checkValidity, accessible inline errors and
first-invalid focus. Native popup geometry remains intentionally browser-owned. Approved local
verification authorization supersedes the historical manual-only verification note for this task.

## Course risk and Gantt

The tasks homepage leads with risk-ranked course batches, reusing white/slate panels, emerald controls, Chinese typography and amber caution text. The existing daily incomplete/backlog task flow follows it. Risk cards and timeline consume the same persisted solver output. Natural date columns use weekend tint only as orientation; capacity is always manually marked. Compressed available-slot columns explicitly say non-natural time scale. Formal, forecast and fixed work use text plus solid/dashed/double borders. Mobile uses daily disclosures and the same course/task text detail list. Native platform controls, task-page feedback and package UX ownership remain canonical. Verification for this approved task includes authorized local tests, isolated env-free production build and simulated-persistence browser fixtures.

## Exam image authoring (approved 2026-11-13)

Use the grammar editor's source/preview relationship in a three-column admin workspace:
task list, original page with normalized crop, electronic question preview. On narrow screens
stack these in the same order. Maintain PageShell, StickerCard, Radix controls, warm paper/amber
palette and Chinese system typography. The crop rectangle and highlighted image position
identify the active task. Shared owner: `packages/ui/src/ImageCropper.tsx`.
Grammar's modal wraps it in AppDialog. Original images use authenticated Blob URLs, revoked
on task/account change. Dirty navigation uses AppDialog; unknown saves keep the original
request for retry. Completion comes from saved bindings. Delete authoring tasks and unused
originals only, preserving finished question images and their links. Runtime verification
remains manual per the user; no screenshot or browser acceptance is claimed.

Prepared reference crops upload in the resumable authoring CLI. Bound images open in review
mode with the actual saved result; only explicit correction opens the cropper. The left task
cards distinguish prepared files from human review: pending, flagged, approved. Default to
pending plus flagged, mark approvals visibly, and persist review state against the saved file
so replacements require another review. No-problem review does not re-upload the image.

## 考一考题型模拟页

`/dev-preview/exams` 为 14 种题面提供内存交互，目录与当前题面分栏，小屏改为上下排列。材料使用纸色 StickerCard；题图直接属于 AnswerChoiceGroup 选项；篇章空位显示题号和已选词；开放空位使用 Themes TextField。控制颜色、焦点和禁用状态由共享组件拥有。原题节选与自拟样例明确标记，无题库写入；用户确认前不批量改题。题型覆盖与手动验收见 docs/exams-question-rendering.md。

长文选择模拟页按「文章 → 全部题目」排列，不显示题号切换栏、悬浮题干或依据卡片。每句句尾图标直接切换整句暖黄高亮，标记归属整篇文章，标题旁提供撤销和清除。标记不暗示正确性，不强制先标记再作答。

阅读句尾标记按钮使用系统自带的 🖍️ emoji（14px），不依赖图标包或远程资源，无需额外缓存；emoji 外观由设备字体决定，选中状态由按钮的琥珀色背景表示。学习工具栏继续使用 LearningIcon。

手写 demo 使用紧凑锚点面板：约 280×140px 的横向书写区，原空位按钮作为锚点，无背景遮罩。仅在四周有不覆盖文字、题图、控件的空间时浮出；否则在完整题目下方插入面板，推开后续内容。撤销、清空、取消、写好了沿用共享控件，原始笔迹仍需确认回填。第 11、15 项保留这一模式；正式开放填空经用户确认后复用，由服务端手写能力控制启用，默认弹窗保持原行为；运行验收由用户手动进行。

确认后的交互由正式答题、提交复盘和管理预览共用：结构化活动控制材料分组；逐空选项在空位弹出；配对沿用两次点选连线；阅读标记不新增题号切换或依据卡。原卷开放输入保留输入，不生成候选答案。第 15 项手写批阅流程只在模拟页保留原始笔迹并演示待批阅、家长评价和复盘，用户已确认后，正式版复用相同交互并增加家长 PIN、原始笔迹保存、待批阅与追加批阅记录；新增数据库迁移应用后启用。正式阅读标记在数据库能力缺失时明确提示仅本页保留。

## 作业内容预览（2026-11-14）

`/dev-preview/homework-content` 采用纵向「科目 → 已保存内容 → 具体项目 → 内容面板」布局。选择后立即展示，不再使用自拟示例或要求打开抽屉。与生命树共用 HomeworkContentPanel，正文、媒体与详情入口完全同源；面板沿用纸色 StickerCard 和 Radix 控件。内容缺失如实显示，不用模拟数据填补。原泡泡操作及正式详情页行为保持不变，验证由用户手动进行。

## 作业范围分步选择（2026-11-14）

新增/编辑作业内容使用一步一选的大卡片向导，替代三列横向级联。RadioCards/CheckboxCards 使用 size=3，完整标题换行、单列布局；每页只有当前层级，底栏提供上一步/下一步或确认加入。英语最后一级课程可多选，整单元与语文整册提供显式加入入口。点击选项只改变本地草稿，确认加入后才读取该组资源；已有条目去重保留，并按课程序合并。已选课程摘要支持移除，具体题目与高级字段默认折叠。

AppDialog.mobileFullscreen 是手机表单的共享开关：小于640px全屏，页头/底栏固定在同一滚动体之外并保留安全区；桌面维持常规弹窗。原生命树内容面板、泡泡操作与课程递进事务保持不变。按用户要求不自动运行构建、测试或浏览器验收。

作业范围卡片改用 FlowRadioCards/FlowCheckboxCards：自适应内容宽度，Flex 换行，保留48px最小点击高度，长标题换行；不铺满每一行。课程流程隐藏手填链接，确认加入后自动生成并显示内容/资源预览，空清单不展示空的高级编辑区。
