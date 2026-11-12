# @rosie/ui

Shared **presentational** components used across modules. No data fetching, no business logic.

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

学习工具栏的装饰图标用 `LearningIcon` from `@rosie/ui`，按动作传 `name`（calculator / wordCards / plan / learn / focus / listen / readAloud / print / pause），默认 20px。按钮提供可见文字或无障碍名称。彩色 SVG 随应用存于 `apps/web/public/icons/plump`，来自 [Streamline](https://github.com/webalys-hq/streamline-vectors) 免费 Plump 图集，每份 SVG 保留 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 署名。暂停使用实心双竖条。

| 适用场景 | 指定入口 | 使用约定 |
| --- | --- | --- |
| 页面级请求加载 | `LoadingOverlay` from `@rosie/ui` | 传入 `visible` 和 `placement="content"` 展示 Rosie 转圈。页面使用纵向弹性布局，加载容器占满剩余视口高度，组件在其中水平、垂直居中。 |
| 局部刷新及提交 | `Spinner`、`Button` from `@rosie/ui/themes` | 在受影响区域显示 `Spinner` 和状态文案。提交按钮使用 `loading` 属性，并在提交期间禁用重复操作。 |
| 业务弹窗 | `import { AppDialog } from '@rosie/ui'` | `size` 可选 `standard`（默认）、`form`（长表单）、`preview`（媒体预览）；`chrome="none"` 时由内容自带头部，标题仅作无障碍用途；`description` 提供副标题。弹窗外壳、标题排版、关闭按钮和焦点行为由共享组件维护。业务侧提供标题文字、可选图标、触发元素和内容。 |
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
