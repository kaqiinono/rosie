# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Rosie Learning Platform
**Generated:** 2026-03-26 16:04:39
**Category:** Educational App (小学数学 + 英语单词学习，面向单一用户 Rosie)

---

> **项目特殊说明：** 本项目有两套主题，写新组件前先确认所在模块：
> - **数学模块** (`/math/*`) — 白底浅色主题，blue/indigo/amber/violet
> - **英语模块** (`/english/*`) — 深色主题，使用 `--wm-*` CSS 变量
> - **今日仪表盘** (`/today`) — 白底，math + english 混合

---

## Global Rules

### Color Palette（实际使用的 CSS 变量，来自 globals.css `@theme`）

| 用途 | Tailwind 类 / CSS 变量 | Hex |
|------|------------------------|-----|
| 数学渐变起点 | `bg-math-from` / `--color-math-from` | `#3b82f6` |
| 数学渐变终点 | `bg-math-to` / `--color-math-to` | `#6366f1` |
| 英语渐变起点 | `bg-eng-from` / `--color-eng-from` | `#10b981` |
| 英语渐变终点 | `bg-eng-to` / `--color-eng-to` | `#06b6d4` |
| 主文字色 | `text-text-primary` | `#1e293b` |
| 次要文字 | `text-text-secondary` | `#64748b` |
| 静音文字 | `text-text-muted` | `#94a3b8` |
| 边框 | `border-border-light` | `#e5e7eb` |
| 表面 | `bg-surface` | `#ffffff` |
| 表面暗 | `bg-surface-dim` | `#f8fafc` |
| 黄（数学强调） | `text-yellow-dark` | `#d97706` |
| 蓝（题型） | `bg-app-blue-light text-app-blue-dark` | `#dbeafe / #1d4ed8` |
| 绿（掌握） | `bg-app-green-light text-app-green-dark` | `#d1fae5 / #065f46` |
| 紫（归一题库） | `bg-purple-50 text-purple-800` | Tailwind purple |

**Color Notes:** 禁止在组件内写裸十六进制色值，一律用上表的 Tailwind 类或 CSS 变量

### Typography

- **中文字体栈：** `font-sans` → PingFang SC / Hiragino Sans GB / Microsoft YaHei
- **英文单词字体：** `font-nunito` → Nunito（用于单词卡片）
- **字号规范：** `text-[10px]` 标签 · `text-[11px]` 标签说明 · `text-[12px]` 辅助文字 · `text-[13px]` 正文 · `text-[15px]` 小标题 · `text-[17px]` 标题 · `text-[22px]+` 大标题
- **字重规范：** `font-medium` 导航 · `font-semibold` 正文 · `font-bold` 标题 · `font-extrabold` 强调 · `font-black` 数字

**已有动画（`globals.css @theme`）：** `animate-fly-in` · `animate-pop-in` · `animate-fade-up` · `animate-wiggle` · `animate-star-pop` · `animate-shimmer` · `animate-jelly` · `animate-confetti-fall`

### Border Radius 规范（来自 globals.css `--radius-*`）

| Token | 值 | Tailwind 等价 | 用途 |
|-------|----|---------------|------|
| `--radius-sm` | `8px` | `rounded-lg` | 小徽章、pill 标签 |
| `--radius-md` | `10px` | `rounded-[10px]` | 题目卡片、列表项 |
| `--radius-lg` | `12px` | `rounded-xl` | 问题卡片、展开面板 |
| `--radius-xl` | `16px` | `rounded-2xl` | 统计卡片、弹窗内部块 |
| `--radius-2xl` | `20px` | `rounded-[20px]` | ModuleCard 主卡片 |

### Shadow 规范

| 场景 | Tailwind arbitrary shadow |
|------|--------------------------|
| 默认卡片阴影 | `shadow-[0_4px_24px_rgba(15,23,42,.06),0_1px_3px_rgba(15,23,42,.04)]` |
| Hover 卡片阴影 | `hover:shadow-[0_20px_50px_rgba(15,23,42,.1),0_4px_12px_rgba(15,23,42,.06)]` |
| 列表项阴影 | `shadow-[0_2px_8px_rgba(0,0,0,0.06)]` |
| 渐变按钮阴影 | `shadow-[0_3px_10px_rgba(color,.3)]` |

---

## 组件规范（Tailwind 模式，参照现有组件）

### 主卡片（ModuleCard / CourseCard 模式）
```tsx
// 外层容器
"group relative block overflow-hidden rounded-[20px] border border-white/80 bg-white
 shadow-[0_4px_24px_rgba(15,23,42,.06),0_1px_3px_rgba(15,23,42,.04)]
 transition-all duration-300 ease-[cubic-bezier(.34,1.56,.64,1)]
 hover:-translate-y-1.5 hover:scale-[1.01]
 hover:shadow-[0_20px_50px_rgba(15,23,42,.1),0_4px_12px_rgba(15,23,42,.06)]"

// 顶部色条（accent bar）
"h-[5px] transition-all duration-300 group-hover:h-1.5 bg-gradient-to-r from-* to-*"
```

### 列表项卡片（FilterPanel ExpandedCard 模式）
```tsx
"rounded-[12px] border-[1.5px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]
 transition-shadow"
```

### 筛选按钮（Pill Button）
```tsx
// 激活态
"cursor-pointer rounded-full border-[1.5px] px-2.5 py-1 text-[11px] font-semibold
 transition-all active:scale-95 border-{color}-500 bg-{color}-500 text-white"

// 未激活
"... border-{color}-300 bg-{color}-50 text-{color}-800"
```

### 导航返回按钮（AppHeader 模式）
```tsx
// 移动端圆形 icon-only，桌面端带文字 pill
"flex shrink-0 items-center justify-center rounded-full border border-gray-200
 text-text-muted no-underline transition-colors
 hover:border-gray-300 hover:bg-gray-50 hover:text-text-secondary
 h-8 w-8 sm:h-auto sm:w-auto sm:gap-1 sm:px-3 sm:py-1.5"
// 图标：SVG chevron-left（14×14），禁止使用文本 ← 字符
```

### 底部导航（BottomNav 模式）
```tsx
"fixed bottom-0 left-0 right-0 z-20 flex border-t border-border-light bg-white
 pb-[max(0px,env(safe-area-inset-bottom))] md:hidden"
// 每个 tab
"relative flex flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5
 text-[9px] font-medium no-underline transition-colors"
// 激活色：主题强调色（数学用 text-yellow-dark，英语用主题色）
```

### 进度条
```tsx
// 容器
"relative h-[6px] flex-1 overflow-hidden rounded-full bg-{color}-200"
// 条
"absolute inset-y-0 left-0 rounded-full bg-{color}-500 transition-[width] duration-400"
```

### 章节标题（Section Header）
```tsx
<h2 className="text-[15px] font-extrabold flex items-center gap-2 text-text-primary">
  <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl text-sm
    bg-gradient-to-br from-{color1} to-{color2} shadow-[0_3px_10px_rgba(r,g,b,.3)]">
    {/* emoji 或 SVG */}
  </span>
  标题文字
</h2>
```

---

## Style Guidelines

**Style:** Claymorphism

**Keywords:** Soft 3D, chunky, playful, toy-like, bubbly, thick borders (3-4px), double shadows, rounded (16-24px)

**Best For:** Educational apps, children's apps, SaaS platforms, creative tools, fun-focused, onboarding, casual games

**Key Effects:** Inner+outer shadows (subtle, no hard lines), soft press (200ms ease-out), fluffy elements, smooth transitions

### Page Pattern

**Pattern Name:** App Store Style Landing

- **Conversion Strategy:** Show real screenshots. Include ratings (4.5+ stars). QR code for mobile. Platform-specific CTAs.
- **CTA Placement:** Download buttons prominent (App Store + Play Store) throughout
- **Section Order:** 1. Hero with device mockup, 2. Screenshots carousel, 3. Features with icons, 4. Reviews/ratings, 5. Download CTAs

---

## 禁止模式

- ❌ **裸十六进制色值** — 用 Tailwind 类或 CSS 变量替代，如 `text-[#7e22ce]` → `text-purple-800`
- ❌ **文本字符作图标** — `←` `▼` 等文字箭头用 SVG 替代
- ❌ **过度 inline style** — 纯静态颜色/字体/间距 一律用 Tailwind；只有条件渲染的 gradient/boxShadow 允许 inline
- ❌ **丢失 cursor-pointer** — `button`/`a` 默认已有，`div` 做点击时必须加
- ❌ **hover 无反馈** — 所有可点击卡片必须有 hover 视觉变化（颜色/阴影/位移之一）
- ❌ **布局偏移型 hover** — 避免 `hover:scale-*` 导致相邻元素位移，用 `-translate-y-*` 替代
- ❌ **无 transition** — 所有颜色/阴影/位移变化必须带 `transition-*`（150-300ms）
- ❌ **数学模块混用深色主题** — `/math/*` 页面不使用 `--wm-*` 变量

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
