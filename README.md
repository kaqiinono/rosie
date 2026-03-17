# Rosie 的学习乐园

数学和英语互动学习 PWA 应用，面向小学低年级学生。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 15 | App Router、SSG、文件路由 |
| React | 19 | UI 组件 |
| TypeScript | 5.8 | 类型安全 |
| Tailwind CSS | 4 | 原子化样式、响应式、主题 |
| Workbox | 7 (CDN) | Service Worker 缓存策略 |
| xlsx | 0.18 | 英语单词 Excel 导入 |

## 路由

| 路径 | 页面 |
|------|------|
| `/` | 首页 — 选择数学或英语模块 |
| `/math` | 数学中心 — 课程列表 |
| `/math/ny/34` | 乘法分配律 — 买苹果互动演示 |
| `/math/ny/35` | 归一问题 — 29 道题的完整 SPA |
| `/math/ny` | 重定向到 `/math/ny/35` |
| `/english/words` | WordMaster Pro — 单词卡 / 拼写练习 / 每日一练 |
| `/offline` | 离线回退页 |

## 项目结构

```
src/
├── app/                    # Next.js App Router 页面
│   ├── layout.tsx          # 根布局 (PWA meta、SW 注册)
│   ├── page.tsx            # 首页
│   ├── offline/page.tsx    # 离线回退
│   ├── math/
│   │   ├── page.tsx        # 数学中心
│   │   └── ny/
│   │       ├── page.tsx    # 重定向 → /math/ny/35
│   │       ├── 34/page.tsx # 乘法分配律
│   │       └── 35/page.tsx # 归一问题
│   └── english/
│       └── words/page.tsx  # WordMaster Pro
├── components/
│   ├── shared/             # 通用组件 (BackLink, LoadingOverlay, OrbBackground …)
│   ├── math/
│   │   ├── CourseCard.tsx
│   │   ├── lesson34/       # 乘法分配律组件 (AppleBag, StoryBox, ModeBar …)
│   │   └── lesson35/       # 归一问题组件 (ProblemDetail, RatioDiagram …)
│   └── english/
│       └── words/          # 英语组件 (FlashCard, QuizCard, ImmersiveMode …)
├── hooks/                  # 自定义 Hooks
│   ├── useLocalStorage.ts  # 持久化状态
│   ├── useGreeting.ts      # 时段问候语
│   ├── useNavigationLoading.ts # 导航加载状态
│   └── useServiceWorker.ts # SW 注册 + 更新检测
└── utils/
    ├── type.ts             # 全局 TypeScript 接口
    ├── constant.ts         # 全局常量
    ├── confetti.ts         # 庆祝动画
    ├── greeting.ts         # 时段问候
    ├── lesson34.ts         # Lesson 34 步骤数据
    ├── lesson35-data.ts    # Lesson 35 29 道题数据
    ├── english-data.ts     # 英语示例词库
    ├── english-helpers.ts  # 英语工具函数
    └── phonics.ts          # 音标颜色标注
```

## PWA 架构

### Service Worker (`public/sw.js`)

使用 [Workbox](https://developer.chrome.com/docs/workbox) CDN 版本，无需额外 npm 依赖：

| 资源类型 | 缓存策略 | 说明 |
|---------|---------|------|
| HTML 页面 | NetworkFirst | 优先网络，离线用缓存 |
| JS / CSS | StaleWhileRevalidate | 先用缓存，后台更新 |
| 图片 | CacheFirst | 优先缓存，30 天过期 |
| Google Fonts | StaleWhileRevalidate | 缓存 1 年 |

### 关键文件

| 文件 | 作用 |
|------|------|
| `public/manifest.json` | PWA 安装清单 (名称、图标、启动方式、快捷方式) |
| `public/sw.js` | Service Worker (Workbox 缓存策略) |
| `public/icons/icon.svg` | SVG 应用图标 |
| `src/hooks/useServiceWorker.ts` | 客户端 SW 注册 + 新版本检测 |
| `src/components/shared/ServiceWorkerRegistrar.tsx` | 在根布局中挂载 SW |
| `src/app/layout.tsx` | `<meta>` 标签: manifest、apple-web-app、viewport |

### 图标

项目中包含 SVG 格式的图标。如需完整的 PNG 图标（推荐，兼容性更好），请生成以下文件并放入 `public/icons/`：

```
icon-192.png          192×192   (any purpose)
icon-512.png          512×512   (any purpose)
icon-maskable-192.png 192×192   (maskable, 含安全区域)
icon-maskable-512.png 512×512   (maskable, 含安全区域)
```

可使用 [PWA Image Generator](https://www.pwabuilder.com/imageGenerator) 或 [maskable.app](https://maskable.app/editor) 在线生成。

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器 (Turbopack)
npm run dev

# 打开浏览器
open http://localhost:3000
```

> **注意**：Service Worker 在开发模式下也会注册，但 Workbox 的 `importScripts` 需要网络加载 CDN。若需完全离线开发，可暂时注释掉 `ServiceWorkerRegistrar`。

## 构建与预览

```bash
# 生产构建
npm run build

# 本地预览生产版本
npm start
```

构建产物为静态页面（SSG），所有路由在构建时预渲染。

## 部署到 Vercel

### 方式一：Git 集成（推荐）

1. 将代码推送到 GitHub / GitLab / Bitbucket
2. 登录 [Vercel](https://vercel.com)，点击 **New Project**
3. 导入仓库，Vercel 会自动检测 Next.js 框架
4. 点击 **Deploy** — 完成

后续每次 `git push` 都会自动触发部署。

### 方式二：Vercel CLI

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署（首次会创建项目）
vercel

# 部署到生产环境
vercel --prod
```

### 部署配置 (`vercel.json`)

项目已包含 `vercel.json`，配置了：

- **Service Worker 无缓存** — 确保用户总是获取最新 SW
- **Manifest 无缓存** — 确保 PWA 安装信息最新
- **静态资源长缓存** — `_next/static/*` 和 `icons/*` 缓存 1 年
- **路径重写** — `/math/ny` → `/math/ny/35`

### 自定义域名

部署后在 Vercel 控制台的 **Settings → Domains** 中添加自定义域名。

### 环境变量

当前项目不需要环境变量。所有数据存储在客户端 `localStorage` 中。

## 响应式设计

| 断点 | 布局 |
|------|------|
| < 640px | 移动端：单列卡片、底部导航 |
| 640–767px | 平板小屏：双列卡片 |
| 768–1023px | 平板：侧边栏导航 (Lesson 35) |
| 1024–1279px | 桌面小屏：顶部标签导航 |
| ≥ 1280px | 桌面大屏：侧边栏 + 宽内容区 |

## 数据持久化

| Key | 用途 |
|-----|------|
| `guiyi-solved` | 归一问题已解答集合 |
| `rosie-words` | 英语单词库 (导入/编辑后) |
| `rosie-daily` | 每日练习记录 |

所有数据存储在浏览器 `localStorage` 中，无需后端。

## License

Private — 仅供学习使用。
