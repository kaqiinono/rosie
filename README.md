# Rosie 的学习乐园

面向小学低年级（单个孩子 Rosie）的互动学习 PWA，覆盖**数学、英语、语文、口算**，
外加**绘本阅读、音频、奖励系统**。**强制登录，Supabase 为唯一数据源**（无游客模式）。

> 架构与开发约定以 [`AGENTS.md`](AGENTS.md) 为准，各学科模块细节见对应包的 `AGENTS.md`。
> 本文件只做快速上手。

## 技术栈

| 技术 | 用途 |
|------|------|
| Next.js 15（App Router、SSG） | 唯一可部署应用，路由都在 `apps/web` |
| React 19 / TypeScript 5.8 | UI 与类型 |
| Tailwind CSS v4（无 `tailwind.config.js`） | 样式，主题走 CSS 变量（`globals.css`） |
| pnpm workspace + Turborepo | monorepo，`apps/web` + `packages/*` |
| Supabase（`@supabase/supabase-js`） | 认证 + 唯一数据存储 |
| Workbox 7（CDN） | Service Worker 缓存（HTML NetworkFirst / JS·CSS SWR / 图片 CacheFirst 30d） |
| pdfjs-dist · react-pageflip | 绘本 PDF 翻页 |
| xlsx · @breezystack/lamejs | 单词 Excel 导入 · 朗读录音编码 |

## Monorepo 结构

单一可部署应用（`apps/web`），每个学科各自成包以便独立开发/类型检查。依赖 DAG 无环，
`core/ui/rewards/player` 永不依赖学科包。详见 [`AGENTS.md`](AGENTS.md)。

```
apps/web/          Next.js 应用 —— 所有路由（Vercel Root Directory = apps/web）
packages/
  core/            @rosie/core    Supabase 客户端、AuthContext、共享类型/常量/工具、session store
  ui/ rewards/     共享展示组件 / 星星·钱包·代金券
  player/          内容无关的播放引擎 + PlayerDock
  calc/            口算          | math/     人教版数学
  english/         英语（词汇+阅读）| chinese/  语文（生字·古诗·朗读）
  flipbook/        绘本 PDF 阅读器 | audio/    音频合集/收藏
supabase/          数据库 schema 快照 + 迁移（见 supabase/README.md）
docs/              扩展指南、规则、每学科 SQL/灌库脚本
```

各模块权威文档：`packages/<pkg>/AGENTS.md`。

## 本地开发

```bash
pnpm install                       # 安装所有 workspace
pnpm dev                           # 开发服务器（Turbopack）
pnpm build                         # 生产构建（turbo）
pnpm start                         # 预览生产构建（测 SW/离线用这个，别用 dev）
pnpm lint                          # 全包 lint
pnpm typecheck                     # 全包类型检查

# 单包提速：
pnpm --filter @rosie/math typecheck
pnpm --filter web build
```

打开 http://localhost:3000 。修改 Service Worker（`apps/web/public/sw.js`）后需硬刷新，
且离线行为只在 `pnpm start` 下可靠验证。

## 环境变量

登录与云同步必需（缺失则认证失败，应用无法使用）：

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

可选能力见 [`AGENTS.md` → Environment Variables](AGENTS.md)：`AI_EMBED_*`（单词 AI 补全 + `/ai` 助手）、
`PEXELS_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY`（单词自动配图 / 找回密码）。服务端密钥严禁
加 `NEXT_PUBLIC_` 前缀。本地 env 放在 `apps/web/.env.local`。

## 数据与持久化

- **所有用户数据存 Supabase**（`word_entries`、`math_*`、`chinese_*`、`calc_*`、`*_weekly_plans` 等，
  约 47 张表）。数据 hook 走 `@rosie/core` 的 `createUserSessionStore`（per-user 缓存 + 写后 patch）。
- **`localStorage` 只存 UI 偏好 / 筛选与选择项 / 少量瞬时会话态**（侧栏折叠、英语与生字筛选、
  周计划上次选择、绘本播放偏好、拯救队列等，见 `@rosie/core` 的 `STORAGE_KEYS`），**从不存持久用户数据**。
- **数据库 schema**：`supabase/schema.sql` 是全量快照（重建真相），变更走 `supabase/migrations/`
  + `scripts/apply-migrations.mjs`。详见 [`supabase/README.md`](supabase/README.md)。

## 部署到 Vercel

单个 Vercel 项目、单个域名。因为应用在 `apps/web`：

1. **Settings → General → Root Directory 设为 `apps/web`**（不设会构建失败）。
2. 保持 **"Include files outside of the Root Directory in the Build Step"** 勾选（默认开），
   构建才能访问 `packages/*` 与根 `pnpm-workspace.yaml` / `pnpm-lock.yaml`。
3. 其余自动：Vercel 从根 lockfile + `packageManager` 识别 pnpm；`framework`/`buildCommand`/
   `installCommand` 与 SW/PWA 缓存头、重写都在 `apps/web/vercel.json`。
4. 生产环境变量存在 Vercel 中，不受 monorepo 结构影响。

## License

Private —— 仅供学习使用。
