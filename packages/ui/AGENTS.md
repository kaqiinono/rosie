# @rosie/ui

Shared **presentational** components used across modules. No data fetching, no business logic.

**Contents:** `CandyButton`/`JellyButton` (+ presets/tiles), `BrandLogo`, `SelectControl`,
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

| 适用场景 | 指定入口 | 使用约定 |
| --- | --- | --- |
| 业务弹窗 | `import { AppDialog } from '@rosie/ui'` | 列表和表单使用默认的 `standard`，媒体预览使用 `preview`。弹窗外壳、标题排版、关闭按钮和焦点行为由共享组件维护。业务侧提供标题文字、可选图标、触发元素和内容。 |
| 链接样式操作按钮 | `LinkButton` from `@rosie/ui` | 页面内操作传入 `onClick`，原生下载链接传入 `href` 和 `download`。 |

新增受控组件或扩展已登记组件的适用范围时，同步更新本清单。

## shadcn/ui 增量接入

从仓库根目录执行 `pnpm --dir packages/ui dlx shadcn@3.5.0 add input`，每次审阅一个组件。
CLI 的源码和 CSS 目标由本包 components.json 指定。审阅生成的文件、依赖和共享 lockfile，
将生成代码中的包内别名改成相对导入。原语默认私有；已有控件通过原入口迁移，保留 props、
ref、事件及外观。需要新公开入口时同步登记受控组件。客户端边界放在拥有交互的叶子文件。

registry.css 仅接收 CLI 写入。首个试点上线时，在应用 globals.css 的 Tailwind import
之后添加 `@import "../../../../packages/ui/src/shadcn/styles/theme.css";`。
现有 packages/ui/src 扫描范围已覆盖新组件。将生成类中的主题色改成 sc 语义色，
例如 bg-sc-muted；移除依赖全局重置的假设，显式设置控件边框和焦点样式。
cn 提供条件类拼接。审阅原语内部可能冲突的类，调用方通过公开变体选择外观。

每次试点手动核对旧调用、键盘、ref、静态路由和阅读器的翻页、PDF 文本及注释层。
发现回归时单独回退该控件的接入。
