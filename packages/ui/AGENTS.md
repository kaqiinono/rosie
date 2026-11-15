# @rosie/ui

Shared **presentational** components used across modules. No data fetching, no business logic.

`AppDialog presentation="bottom-drawer"` opens a full-width, 92dvh bottom sheet with rounded
top corners and reduced-motion-aware entrance. It preserves the shared close/focus contract.

**Contents:** `CandyButton`/`JellyButton` (+ presets/tiles), `StickerCard`, `PageShell`, `StatTile`, `DarkScope`, `BrandLogo`, `SelectControl`,
`PageBreadcrumb`, `ArrowIcon`,
`OrbBackground`, `LoadingOverlay`, `ModuleCard`, `AccountBar`, `AuthGuard`, `NavigationLink`,
`TopRightBar`, `ServiceWorkerRegistrar`.

`PageBreadcrumb` renders the site breadcrumb (or a 返回首页 button when the parent is home)
driven by the route map in `breadcrumb-map.ts` (subpath export `@rosie/ui/breadcrumb-map`).
**When adding a new page route, check `breadcrumb-map.ts` and add an entry** — otherwise the
page falls back to the plain 返回首页 button.

`ProblemSolutionView` and `AnalysisImage` are data-agnostic shared presentation for authoritative
math solutions. Math-kit resolves `Problem`/Supabase image data; AI passes structured block data.
The UI package must not query math tables or import a subject package.

**Depends on:** `@rosie/core` (auth/contexts/types), `@rosie/rewards` (TopRightBar shows the
stars HUD) + npm. Never a subject module.

**Notes:** interactive components need `'use client'` at the top (the barrel is pulled into
server components like `app/layout.tsx`). Barrel: `import { CandyButton } from '@rosie/ui'`
(named exports — default-exported components are re-exported as named).

## 受控组件入口清单

`StickerCard variant="soft"` is the approved borderless content surface: retain the selected
tone/radius/padding, omit both outline and elevation. `variant="quote"` is a content-width strip
with a gray fill and a left bar only; tone and elevation do not apply. The default `outlined` variant is unchanged.
Use this for dense exam questions and image choices instead of nested outlined cards.
`LetterChoiceButton` / `JudgmentIconButton appearance="quiet"` provide regular 32px borderless circles,
bold labels, gray resting fill and deep-blue selected fill with white foreground. Keyboard
focus retains an explicit outline. `demonstration` disables interaction while preserving the
selected appearance for an authored example; it must never imply an inferred answer.

`ImageZoomTarget` wraps non-interactive image content with an accessible full-area zoom action.
Use `label`, optional numeric `maxWidth` and `onOpen`; never nest it inside an answer label.
`AnswerChoiceGroup layout="images"` uses wrapping Flex rows of whole image-option cards.
Each card keeps its label and image together; its minimum readable width follows
`options[].imageMaxWidth` clamped to 224–320px, capped by the container on smaller screens.
Visibility takes priority over keeping three options in one row. The selected unit uses the
accent card tone. `onOptionPreview` separates the image action from the radio label;
`options[].imageMaxWidth` still caps the image itself. Existing list/grid defaults remain.
`AppDialog presentation="fullscreen"` fills the viewport; optional `footer` stays outside the
scrolling body for persistent actions. Media owners must retain one media element and pass
transport controls only, rather than mounting a second player in the footer.
`MatchingBoard illustration.fit="responsive"` fits its diagram within the available width,
using `displayWidth` as a cap; optional `onIllustrationPreview` opens an external preview
without covering the diagram's interactive numbered markers. Default scroll layout remains.

`RegionEditActions` from `@rosie/ui` provides a fixed 64×32px rectangular save/cancel toolbar.
Each icon button is 32×32px, with accessible labels and titles; props are `tone`, `disabled`,
`saving`, `onSave`, `onCancel`. `saving` shows pending feedback and locks both actions.
Persistence remains the caller's responsibility.
`InlineHandwritingPad fullWidth` fills its available width including the tool rail and scales
the SVG proportionally, preserving stored ink coordinates. The default compact layout is unchanged.

学习工具栏的装饰图标用 `LearningIcon` from `@rosie/ui`，按动作传 `name`（calculator / wordCards / plan / learn / focus / listen / readAloud / print / pause），默认 20px。按钮提供可见文字或无障碍名称。彩色 SVG 随应用存于 `apps/web/public/icons/plump`，来自 [Streamline](https://github.com/webalys-hq/streamline-vectors) 免费 Plump 图集，每份 SVG 保留 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 署名。暂停使用实心双竖条。

| 适用场景 | 指定入口 | 使用约定 |
| --- | --- | --- |
| 单选答案及独立判题反馈 | `AnswerChoiceGroup` from `@rosie/ui` | 受控 `options={[{id,label}]}`、`value`、`onValueChange`；`id`为唯一非空的题内可读标识（A/B/C），空`value`代表未选。`label`提供组的无障碍名称，`optionLang`声明选项正文语言，`disabled`禁用选择，`readOnly`用于提交后复盘且保留可读外观。`feedback={{status,correctOptionId,message}}`仅展示外部结果；调用方在提交后同时设置`readOnly`，组件不提交、不判分、不切题、不请求数据。选项用Radix RadioGroup soft与Text标签组成整行44px触控目标，反馈区预留空间。禁止业务覆盖外观或复制选项控件。 |
| 页面级请求加载 | `LoadingOverlay` from `@rosie/ui` | 传入 `visible` 和 `placement="content"` 展示 Rosie 转圈。页面使用纵向弹性布局，加载容器占满剩余视口高度，组件在其中水平、垂直居中。 |
| 局部刷新及提交 | `Spinner`、`Button` from `@rosie/ui/themes` | 在受影响区域显示 `Spinner` 和状态文案。提交按钮使用 `loading` 属性，并在提交期间禁用重复操作。 |
| 业务弹窗 | `import { AppDialog } from '@rosie/ui'` | `size` 可选 `standard`（默认）、`form`（长表单）、`preview`（媒体预览）；`contentLayout="fill"` 让正文撑满剩余高度、由内部区块滚动，默认 `scroll` 为正文整体滚动；`chrome="none"` 时由内容自带头部，标题仅作无障碍用途；`description` 提供副标题。弹窗外壳、标题排版、关闭按钮和焦点行为由共享组件维护。业务侧提供标题文字、可选图标、触发元素和内容。 |
| 内容选区右侧编辑 | `RegionEditButton` from `@rosie/ui` | 父元素需 `relative`；`tone="text|image|question"`、`label`、`disabled`、`onClick`。按钮位于边框内部靠右，以 ResizeObserver 读取父选区实际边框盒高度，边长取该高度与 32px 的较小值，始终为正方形，不占布局空间。 |
| 悬浮入口右上角关闭 | `FloatingLauncherCloseButton` from `@rosie/ui` | 父容器提供定位，传入 `label`、可选 `title` 和 `onClose`。生命树和机器人共用。 |
| 通用按钮、Tab、表单和其他标准控件 | 从 `@rosie/ui/themes` 按名称导入，如 `Button`、`Tabs`、`TextField`、`Select` | 使用官方组件及其变体。主要操作使用实色按钮，次要操作使用 `soft`。 |
| 表单单选下拉 | `FormSelect` from `@rosie/ui` | 传 `value`、`onValueChange`、`options={[{value,label}]}`，`size` 选尺寸；`value=""` 的「全部 / 未选择」选项可直接使用（组件内部处理 Radix 的空值限制）。`className` 只写宽度等布局。需要分组或自定义项时再直接用 `Select`。 |
| 链接样式操作按钮 | `LinkButton` from `@rosie/ui` | 页面内操作传入 `onClick`，原生下载链接传入 `href` 和 `download`。 |
| 卡片、面板、统计块、列表项容器 | `StickerCard` from `@rosie/ui` | 外观只用 `tone`（white / paper / accent / success / warning / danger / info）、`size`（none / sm / md / lg）、`elevation`（flat / sm / md / lg）、`radius`（md / lg）、`interactive` 选择；`className` 只写布局（宽高、栅格、间距、定位）。语义区块用 `as`（section / article / li …）。可点击链接卡用 `asChild` 套在 `<Link>` 上。禁止手写 `rounded-* border-2 bg-white shadow-sticker*` 拼卡片，`pnpm lint:visual` 的 `hand-card` 规则会拦截。 |
| 深色沉浸区域（口算、英语单词模块、英语计划管理、题海）里的 Radix 控件 | `DarkScope` from `@rosie/ui` | 包在区域最外层，嵌套 Radix `Theme appearance="dark"`；区域内的 `Button` / `TextField` / `AppDialog` 自动取深色。不要给单个控件手写深色类名。 |
| 整页外壳：底色、粘性页头（返回 / 标题 / 右侧操作）、内容宽度 | `PageShell` from `@rosie/ui` | `title`、`icon`、`subtitle`、`backHref`（缺省显示面包屑）、`actions`、`width`（narrow / default / wide / full）、`tone`（paper / rose / mint / peach / sky）、`padded={false}` 让页面自管内容区。禁止手写 `min-h-screen` + 自己的 sticky header；沉浸式或刻意深色的页面（口算、题海、全屏做题、英语计划管理 `/setting/plans/english/**`）不适用。 |
| 数据概览小块（标签 + 大数字） | `StatTile` from `@rosie/ui` | `label`、`value`、`unit`、`hint`、`tone`、`size`；`className` 只写栅格布局。 |
| 标签、状态徽章、数量角标 | `Badge` from `@rosie/ui/themes` | `variant="soft"`、`radius="full"`，用 `color` 选 Radix 颜色；实心强调用 `variant="solid"`。禁止手写 `rounded-full px-2 py-0.5 bg-X-100 text-X-800`。 |

新增受控组件或扩展已登记组件的适用范围时，同步更新本清单。

## Radix Themes

`ImageCropper`（`@rosie/ui`）是语法与考试共用的原页裁切入口。公开属性：
`imageUrl`、`initialRegion`（0–1坐标）、`saving`、`disabled`、`error`、`confirmLabel`、
`onConfirm(blob,region)`、`onPreview(blob|null)`、`onDirtyChange`。支持放大、拖动重画与百分比微调；
只导出原图PNG，不负责业务上传。原页必须同源、具备CORS权限或是经过鉴权读取的Blob URL。
调用处负责释放Blob URL；语法用AppDialog包装，考试嵌入三栏工作台。

`@rosie/ui/themes` 转出整套 Radix Themes API。根布局统一设置浅色主题、琥珀强调色、暖沙灰与 `radius="full"`。
应用的 globals.css 在 Tailwind components 层引入一次 `@rosie/ui/themes.css`，共享样式集中定义「软糖贴纸」视觉语言：圆体字体栈、奶油底色、2px 暖色描边（`--kid-line`）、底部硬边阴影（`--kid-edge`）、弹性动效（`--kid-spring`），按压回弹，并尊重 `prefers-reduced-motion`。不使用渐变和高光。
Tailwind `slate-*` 在 globals.css 的 `@theme` 中被重映射为暖灰。业务页优先使用令牌类 `shadow-sticker-sm|sticker|sticker-lg`、`border-kid-line`、`bg-kid-paper`、`ease-spring` 与 Radix `--accent-*`。
完整规范、令牌表、控件配方和旧写法对照见 [`docs/visual-guidelines.md`](../../docs/visual-guidelines.md)；`pnpm lint:visual` 拦截新增渐变、柔和投影和毛玻璃。
`JellyButton`、`ModuleCard`、`OrbBackground` 已按该规范改为纯色、粗描边、平底边，新增预设沿用同一写法。
新增或修改共享控件时，必须优先复用 Radix Themes 带样式组件，通过官方属性选择变体、尺寸和颜色。
业务页沿用根主题和受控组件入口。共享封装和业务调用均禁止用原生标签搭配 Tailwind 类、手写 CSS 或内联样式重做控件。若现有组件无法满足需求，先说明缺口和建议方案，等用户确认后再实现。

`AppDialog` 内部使用 Themes Dialog。默认由触发器管理显隐，也可通过 `open` 和 `onOpenChange` 受控打开或关闭；
保存期间可传 `closeDisabled` 阻止关闭按钮、Escape 和点击遮罩关闭。
参考 `/admin/words` 的批量添加流程。

`PageShell` 可传 `onBack` 替代默认链接返回，用于表单离开前处理尚未保存的修改。
组件以 Themes Button 渲染返回动作；调用方使用 AppDialog 决定继续编辑或离开，不拦截共享链接事件。

### 考试页的安静加载与浮层

`LoadingOverlay` 新增 `appearance="quiet"`，保留 Rosie 转圈 sprite 与加载文字，关闭撒花、角色位移和模糊投影；`placement="content"` 的父区域应为占剩余视口的 flex 容器。默认外观兼容原调用。全局 reduced-motion 规则置于加载动画声明之后。共享 Select/Popover/Menu/Dialog 保留暖色描边与平底边，移除柔和投影及 Dialog 背景模糊；既有无模糊 inset 描边未改。

`AnswerChoiceGroup` 的题型预览扩展：`options[].content?: ReactNode` 接收无交互的题图内容，仍属于同一选项点击区域；`options[].disabled` 控制已占用词项；`layout="grid"` 用于图片或短词选项，默认 `list`；`reserveFeedbackSpace={false}` 用于多题组合，默认保留原反馈占位。调用方不得在 content 内嵌按钮、链接或输入控件。

`MatchingBoard` from `@rosie/ui` 是两次点选连线的共享入口：`items={[{id,label,position?}]}`、`options={[{id,label}]}`、`value: Record<itemId,optionId>`、`onValueChange`，`allowReuse` 默认 false，`readOnly` 锁定答案但可查看连线。可选 `illustration={src,width,height,alt}` 配合百分比 position 将编号放到题图上。只显示当前或最近一次连线，完成后跳到下一个未填项；清除释放词项。组件不判分、不保存数据。无位置关系的一题多个回应使用 Themes Checkbox 多选，不强行连线。

`HandwritingField` from `@rosie/ui` 提供独立空位的手写输入与键盘备用：`label`、`value: HandwritingAnswer | null`、`onChange`、`readOnly`、`maxWords`。答案明确区分 `{kind:'ink',strokes}` 与 `{kind:'text',text}`；只在确认时回传，取消丢弃本次编辑。指针捕获支持单指/笔书写，固定坐标画布在不同宽度保持笔迹比例；撤销按笔画、清空后确认可删除答案。只读允许放大查看。组件无识别、判分、上传或持久化，手写字数不自动推断；maxWords 只约束键盘输入。动作使用 Themes 控件和 AppDialog，SVG 仅承载自由书写。

`presentation="anchored"` 为已确认的手写 demo 提供约 280×140px 书写区域和无背景遮罩的 Themes Popover；默认 `dialog` 保持原调用行为。`inlineTarget` 为完整题目之后的空 `<div>` 引用：四周候选位置会避开可见文字行、图片、控件和视口边缘；无合适位置则将面板 portal 到该容器，撑开页面。展开后本次编辑保持行内，避免布局来回跳动；新开一个手写空会收起其他空。文章内调用必须提供题目后的容器，不能在句中插入展开面板。收起不提交，只有“写好了”回传笔迹。滚动与窗口大小变化会重新检查浮层位置，定位模式切换保留草稿。模拟页第 11、15 项保留；考试正式开放填空也复用此模式，由考试服务端能力开关决定启用。`onEditingChange` 通知父页面编辑面板是否处于可写状态，供页面阻止未确认书写时的提交和切题；不改变“写好了”才回传答案的契约。

`InlineChoiceField` from `@rosie/ui` is the shared inline blank picker: `label`,
`options` (AnswerChoiceOption, including occupied-option disabled flags), `value`,
`onValueChange`, `readOnly`. It owns the Themes Popover, selection, clear/close and
focus return. Demo and formal exams use this same component; do not add a second
copy of the options under the passage.

`SentenceHighlightText` from `@rosie/ui` takes `text`, authored UTF-16 `sentences`
(`id/start/end`), controlled `selected`, `onValueChange`, and `readOnly`. It renders
sentence-end linear Highlighter markers anchored above the text with zero inline width, undo and clear without guessing boundaries or correctness.
Contiguous exam paragraphs compose one passage and one toolbar. Persistence and
scope authorization belong to the caller; the component performs no requests.
Optional `renderLayout({ content, toolbar })` arranges the owned text and toolbar,
for example placing undo/clear beside a passage heading. Render each slot once;
do not reproduce its controls or override their states. Without this prop the
existing vertical layout remains. The illustrated-reading demo uses this slot
to keep portrait headings and annotation actions on one row.

MatchingBoard illustration accepts optional `displayWidth` (CSS pixels). Omit it to
retain the existing 520px minimum and horizontal scrolling; when provided, the image
and percentage-based numbered anchors share the responsive width cap. Caller must
validate author input; exam authoring allows 80–1200. This public prop is used by
formal exam rendering; callers must not override the board's internal image styles.

MatchingBoard supports opt-in `layout="columns"` for text-only matching: questions
on the left, vertically listed options on the right, number-before-question ordering and row-to-option curved connectors
in the column gutter. Themes Grid keeps the two columns side by side. All completed connections remain visible; the inspected/latest
one is emphasized. Omit the prop for the existing stacked layout; illustrations keep
their existing layout. Approved exam attempts, submitted review, admin previews and the retained demo opt in. Question and option boxes size to content (up to 28rem and their column width), wrap long text, and connect at their measured edges.

`InlineHandwritingPad` is shared by the approved compact demo and formal gaps. It commits original strokes on pointer release, exposes `onDrawingChange` for submit/navigation guards, and supports letter/word sizes, read-only ink, Undo2 and Eraser. It owns no persistence or grading. Limits match the exam contract: 250 strokes and 10,000 points per gap.

InlineHandwritingPad docks a three-icon vertical toolbar against the canvas right edge. `onKeyboardRequest` enables its keyboard action (disabled until ink is cleared); demos and formal gaps both provide it. StickerCard `radius="left" | "right"` supports joined panels with square adjoining edges.

### 练习抽屉

`AppDialog` 支持可选 `presentation="drawer"`：桌面右侧全高面板，窄屏占满宽度，仍复用 Radix 的焦点、Escape 和遮罩关闭。`returnFocusRef` 可供没有 Dialog.Trigger 的调用者指定关闭后焦点。默认 `dialog` 不变；抽屉动效由 `themes.css` 拥有并遵守 reduced-motion。业务层 `PracticeDrawer` 组合此入口，不自行覆写控件外观。

`JudgmentIconButton` from `@rosie/ui` renders a compact linear check/cross. Props: `answer`, `selected`, `label`, `disabled`, `onClick`. Default gray background has no border; unselected hover uses orange tokens, selected uses amber. The approved demo and formal authored classification activities opt in; no grading or persistence.

`LetterChoiceButton` shares the compact judgment-button states for authored letter categories. Props: `letter`, `selected`, `label` (letter meaning), `disabled`, `onClick`. The demo and formal authored classification activities use T/A/N, P/F, A/D and S/D.

`PageShell.fillContent` opt-in lays out the shell as a viewport-height flex column and lets its main content grow below the actual header. Page loading children should also use a growing flex column with `LoadingOverlay placement="content"`.

`AppDialog.mobileFullscreen` opts a form into phone fullscreen (<640px) while retaining desktop dialog dimensions. Header/footer remain outside the shared scrolling body; safe-area padding is owned by themes.css. Scope selection uses Themes RadioCards/CheckboxCards size=3 rather than screen-local clickable cards.

`FlowRadioCards` / `FlowCheckboxCards` wrap Radix card roots for content-width flex wrapping (default size 2). Use the corresponding Themes `.Item` children. Layout/target sizing belongs to themes.css; callers do not override card styling.

Flow choice cards accept `layout="equal"` for course lists: equal-width responsive columns, wrapping long labels, one column in narrow containers. Default `flow` retains compact intrinsic-width choices.
