# English Module Homepage (`/english`) — Design Spec

Date: 2026-03-24

## Overview

Add a new `/english` route as the English module entry page. It serves as a hub showing overall vocabulary learning progress and providing navigation into the three sub-sections (Cards, Daily, Practice).

## Goals

- Show key learning progress stats at a glance: words touched, total practice count, accuracy, last practice date, words due for review today, graduated words
- Provide clear navigation into the three functional areas
- Fit visually with the main home page (light theme) as a transitional entry layer

## Out of Scope

- No new data storage or schema changes
- No changes to existing `/english/words/*` routes or `WordsContext`
- No weekly plan stats on this page (those live in `/today`)
- No modifications to `useWordMastery` hook

---

## Architecture

### Route Group Pattern

`src/app/english/layout.tsx` cannot be used directly: in App Router it would nest over all `/english/words/*` routes, causing the existing `words/layout.tsx` (with `AppHeader`, `WordsProvider`, dark `--wm-bg`) to inherit the new header — resulting in double headers and conflicting backgrounds.

**Solution: Next.js route group.**

```
src/app/english/
  (hub)/
    layout.tsx    ← scoped to /english only (route groups add no URL segment)
    page.tsx      ← renders at /english
  words/
    layout.tsx    ← existing, unchanged
    ...
```

### Files Created

| File | Purpose |
|---|---|
| `src/app/english/(hub)/layout.tsx` | Server Component layout scoped to `/english` only |
| `src/app/english/(hub)/page.tsx` | Client Component — stats + nav hub |

### Files Modified

- `src/app/page.tsx` — update English module card `href` from `/english/words` to `/english`
- `src/app/english/words/page.tsx` — **not changed** (still redirects to `/english/words/cards`)

### Data Flow

`page.tsx` (`'use client'`) uses:
- `useAuth()` → `{ user, loading }`
- `useWordMastery(user)` → `{ masteryMap }`

`useWordData` is not needed — all stats derive from `masteryMap` alone.

### Computed Stats

```ts
const today = new Date().toISOString().slice(0, 10)  // "YYYY-MM-DD"
```

| Stat | Calculation |
|---|---|
| 已接触单词 | `Object.keys(masteryMap).length` |
| 总打卡次数 | `sum(info.correct + info.incorrect)` |
| 正确率 | `sum(correct) / sum(correct+incorrect)` as `%`, or `'--'` if total is 0 |
| 最近打卡 | max of non-empty `lastSeen` strings; pass `null` to `formatLastSeen` if none found |
| 今日待复习 | entries where `info.nextReviewDate !== undefined && info.nextReviewDate <= today` |
| 已毕业单词 | entries where `isGraduated(info) === true` (import from `masteryUtils`) |

**lastSeen computation** — `WordMasteryInfo.lastSeen` is typed `string` and can be `''` (hook initializes missing DB rows as `''`). Filter before taking max:

```ts
const validDates = Object.values(masteryMap).map(i => i.lastSeen).filter(d => d !== '')
const latestDate: string | null = validDates.length > 0
  ? validDates.reduce((a, b) => (a > b ? a : b))
  : null
```

**今日待复習 note**: ISO date string comparison (`"YYYY-MM-DD" <= "YYYY-MM-DD"`) is lexicographically valid. No date parsing needed.

**已毕业单词 note**: `isGraduated` returns `false` for `stage === undefined` entries (pre-stage-system records). Known limitation — these are correctly excluded.

---

## UI Layout

### `(hub)/layout.tsx` (Server Component)

No `'use client'` directive — only `<Link>` and static markup.

- Root: `bg-surface-dim min-h-screen font-nunito`
- Sticky header: `← 主页` (`<Link href="/">`) left-aligned + "英语天地" centered
- `{children}` below

### `(hub)/page.tsx` (`'use client'`)

#### Loading / Auth / Empty States

`useWordMastery` does not expose a loading flag; `masteryMap` starts as `{}` and populates after a Supabase fetch (~200ms). The empty-state message ("还没有打卡记录") may briefly flash for users who have data, until the fetch completes. This is an accepted limitation for this single-user app.

State matrix (evaluated in order):

| Condition | UI |
|---|---|
| `loading === true` | Skeleton placeholders for stat numbers; nav cards visible |
| `loading === false && user === null` | "请先登录" prompt |
| `loading === false && user !== null && Object.keys(masteryMap).length === 0` | "还没有打卡记录，快去打卡吧！" + nav cards |
| otherwise | Stats grid + nav cards |

#### Section 1 — Stats Grid

2 columns on mobile, 3 columns on `md:`. Six cards: emoji icon + large value + label.

| # | Icon | Label | Value if no data |
|---|---|---|---|
| 1 | 📚 | 已接触单词 | `0` |
| 2 | ✏️ | 总打卡次数 | `0` |
| 3 | 🎯 | 正确率 | `--` |
| 4 | 🕐 | 最近打卡 | `--` |
| 5 | 🔔 | 今日待复习 | `0` |
| 6 | 🦋 | 已毕业单词 | `0` |

**`formatLastSeen(date: string | null): string`** — inline helper, no library:

```ts
function formatLastSeen(date: string | null): string {
  if (!date) return '--'
  const diffDays = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays <= 30) return `${diffDays}天前`
  return date
}
```

"今日待复习" card: if count > 0, apply green highlight (`border-app-green bg-app-green-light`).

#### Section 2 — Nav Cards

Stacked on mobile, 3 columns on `md:`. Each is a `<Link>` with hover scale.

| Card | Href | Icon | Desc |
|---|---|---|---|
| 单词卡片 | `/english/words/cards` | 🃏 | 浏览和翻转单词卡 |
| 每日打卡 | `/english/words/daily` | 📅 | 完成今日单词计划 |
| 练习模式 | `/english/words/practice` | 🏋️ | 拼写和词义练习 |

Background: green→cyan gradient tint via inline `background` style using `--color-eng-from` / `--color-eng-to`.

---

## Visual Style

All tokens confirmed in `src/app/globals.css @theme`:

| Tailwind class | Value |
|---|---|
| `bg-surface-dim` | `#f8fafc` |
| `border-border-light` | `#e5e7eb` |
| `text-text-primary` | `#1e293b` |
| `text-text-secondary` | `#64748b` |
| `bg-app-green-light` | `#d1fae5` |
| `border-app-green` | `#10b981` |
| `font-nunito` | Nunito font stack |

- Card radius: `rounded-2xl`, white background
- Responsive: mobile-first, `md:` breakpoints
- Gradient backgrounds via inline style
