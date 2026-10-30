# Rosie design context

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

Course form: use a white sticky action header, slate-50 canvas and white rounded groups for course information, schedule, colors and advanced settings. Labels remain visible above 16px values; 22px outline icons share a 48px (56px on wider screens) column. Input focus belongs to the whole row: emerald-50 tint plus a 2px inset emerald-600 ring. Buttons and picker options use the same inset focus treatment; solid emerald actions use a lighter emerald-300 ring. Focus must not change borders, dimensions or alignment. Course name does not autofocus on opening. Color swatches wrap, notes use a single-line-high textarea that preserves existing multiline content, subjects use a native dropdown, and the time picker uses TimetableDialog. Groups reserve 4px of inner space and each row has its own rounded-xl corners so focus rings remain clear of the outer clipping boundary.

## Verification boundary

User explicitly reserves all build/test/lint/typecheck/browser verification for manual execution. Source review is not evidence of rendered accessibility or visual correctness. Manual scenarios are recorded in the tasks README.

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
