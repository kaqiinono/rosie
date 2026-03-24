# English Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/english` as the English module entry hub showing vocabulary learning stats and navigation to sub-sections.

**Architecture:** Use a Next.js route group `(hub)` under `src/app/english/` to scope a new layout+page to `/english` only, avoiding nesting over the existing `/english/words/*` dark-themed layout. The page reads `masteryMap` from `useWordMastery` and derives all stats client-side.

**Tech Stack:** Next.js 15 App Router, TypeScript (strict, no `any`), Tailwind CSS v4 (no config file — CSS vars in `globals.css`), Supabase (via existing hooks), React hooks.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/app/english/(hub)/layout.tsx` | Server Component: light header + bg scoped to `/english` only |
| Create | `src/app/english/(hub)/page.tsx` | Client Component: stats grid + nav cards |
| Modify | `src/app/page.tsx` | Change English module card href from `/english/words` to `/english` |

---

## Task 1: Create the route group layout

**Files:**
- Create: `src/app/english/(hub)/layout.tsx`

This layout must be a **Server Component** (no `'use client'`). It renders a sticky header with a back link and wraps `{children}`. It must NOT have any React hooks, state, or browser-only APIs.

- [ ] **Step 1.1: Create the layout file**

```tsx
// src/app/english/(hub)/layout.tsx
import Link from 'next/link'

export default function EnglishHubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-dim min-h-screen font-nunito">
      <header className="sticky top-0 z-10 bg-surface-dim border-b border-border-light">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center relative">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <span>←</span>
            <span>主页</span>
          </Link>
          <span className="absolute left-1/2 -translate-x-1/2 text-base font-bold text-text-primary">
            英语天地
          </span>
        </div>
      </header>
      {children}
    </div>
  )
}
```

- [ ] **Step 1.2: Run lint to catch type errors**

```bash
pnpm lint
```

Expected: no errors. If TypeScript complains about `React.ReactNode` without an import, add `import type { ReactNode } from 'react'` and use `{ children }: { children: ReactNode }`.

- [ ] **Step 1.3: Commit**

```bash
git add src/app/english/\(hub\)/layout.tsx
git commit -m "feat: add English hub route group layout"
```

---

## Task 2: Create the hub page

**Files:**
- Create: `src/app/english/(hub)/page.tsx`

This is a Client Component that calls `useAuth` and `useWordMastery`, computes stats from `masteryMap`, and renders a stats grid and nav cards.

- [ ] **Step 2.1: Create the page file**

```tsx
// src/app/english/(hub)/page.tsx
'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useWordMastery } from '@/hooks/useWordMastery'
import { isGraduated } from '@/utils/masteryUtils'
import type { WordMasteryMap } from '@/utils/type'

// ─── helpers ────────────────────────────────────────────────────────────────

function formatLastSeen(date: string | null): string {
  if (!date) return '--'
  const diffDays = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays <= 30) return `${diffDays}天前`
  return date
}

type Stats = {
  totalWords: number
  totalPractice: number
  accuracy: string
  lastSeen: string | null
  dueToday: number
  graduated: number
}

function computeStats(masteryMap: WordMasteryMap): Stats {
  const today = new Date().toISOString().slice(0, 10)
  const entries = Object.values(masteryMap)

  let totalCorrect = 0
  let totalIncorrect = 0
  let dueToday = 0
  let graduated = 0
  const validDates: string[] = []

  for (const info of entries) {
    totalCorrect += info.correct
    totalIncorrect += info.incorrect
    if (info.nextReviewDate !== undefined && info.nextReviewDate <= today) dueToday++
    if (isGraduated(info)) graduated++
    if (info.lastSeen !== '') validDates.push(info.lastSeen)
  }

  const total = totalCorrect + totalIncorrect
  const accuracy = total === 0 ? '--' : `${Math.round((totalCorrect / total) * 100)}%`
  const lastSeen = validDates.length > 0
    ? validDates.reduce((a, b) => (a > b ? a : b))
    : null

  return {
    totalWords: entries.length,
    totalPractice: total,
    accuracy,
    lastSeen,
    dueToday,
    graduated,
  }
}

// ─── sub-components ─────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: string
  label: string
  value: string | number
  highlight?: boolean
}) {
  return (
    <div
      className={[
        'rounded-2xl bg-white p-4 flex flex-col gap-1 border',
        highlight ? 'border-app-green bg-app-green-light' : 'border-border-light',
      ].join(' ')}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-2xl font-black text-text-primary leading-none">{value}</span>
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  )
}

function StatSkeleton() {
  return (
    <div className="rounded-2xl bg-white p-4 border border-border-light flex flex-col gap-1">
      <div className="w-8 h-8 rounded bg-gray-100 animate-pulse" />
      <div className="w-16 h-7 rounded bg-gray-100 animate-pulse mt-1" />
      <div className="w-20 h-3 rounded bg-gray-100 animate-pulse mt-1" />
    </div>
  )
}

const NAV_CARDS = [
  { href: '/english/words/cards',    icon: '🃏', title: '单词卡片',  desc: '浏览和翻转单词卡' },
  { href: '/english/words/daily',    icon: '📅', title: '每日打卡',  desc: '完成今日单词计划' },
  { href: '/english/words/practice', icon: '🏋️', title: '练习模式',  desc: '拼写和词义练习' },
]

// ─── page ───────────────────────────────────────────────────────────────────

export default function EnglishHubPage() {
  const { user, loading } = useAuth()
  const { masteryMap } = useWordMastery(user)

  const stats = computeStats(masteryMap)
  const isEmpty = !loading && user !== null && Object.keys(masteryMap).length === 0

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-8">

      {/* Stats section */}
      <section>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
          学习进度
        </h2>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <StatSkeleton key={i} />)}
          </div>
        ) : !user ? (
          <p className="text-text-secondary text-sm py-4">请先登录查看学习进度。</p>
        ) : isEmpty ? (
          <p className="text-text-secondary text-sm py-4">还没有打卡记录，快去打卡吧！</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard icon="📚" label="已接触单词" value={stats.totalWords} />
            <StatCard icon="✏️" label="总打卡次数" value={stats.totalPractice} />
            <StatCard icon="🎯" label="正确率"     value={stats.accuracy} />
            <StatCard icon="🕐" label="最近打卡"   value={formatLastSeen(stats.lastSeen)} />
            <StatCard icon="🔔" label="今日待复习" value={stats.dueToday} highlight={stats.dueToday > 0} />
            <StatCard icon="🦋" label="已毕业单词" value={stats.graduated} />
          </div>
        )}
      </section>

      {/* Nav cards */}
      <section>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
          开始学习
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {NAV_CARDS.map(card => (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-2xl p-5 flex flex-col gap-2 transition-transform hover:scale-[1.02] no-underline"
              style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-eng-from) 10%, transparent) 0%, color-mix(in srgb, var(--color-eng-to) 10%, transparent) 100%)',
                border: '1.5px solid color-mix(in srgb, var(--color-eng-from) 25%, transparent)',
              }}
            >
              <span className="text-3xl">{card.icon}</span>
              <span className="text-base font-bold text-text-primary">{card.title}</span>
              <span className="text-xs text-text-secondary">{card.desc}</span>
            </Link>
          ))}
        </div>
      </section>

    </main>
  )
}
```

- [ ] **Step 2.2: Run lint**

```bash
pnpm lint
```

Expected: no errors. Common issues to watch for:
- If `isGraduated` is not exported from `masteryUtils.ts`, check `src/utils/masteryUtils.ts` — it is exported as a named export.
- If `WordMasteryMap` import fails, it's in `src/utils/type.ts`.

- [ ] **Step 2.3: Verify routes render correctly in dev**

```bash
pnpm dev
```

Open `http://localhost:3000/english` — should show the hub page with header "英语天地" and a `← 主页` back link.
Open `http://localhost:3000/english/words/cards` — should show the existing cards page with the dark `AppHeader`, NOT the new hub header.

- [ ] **Step 2.4: Commit**

```bash
git add src/app/english/\(hub\)/page.tsx
git commit -m "feat: add English hub page with stats and nav"
```

---

## Task 3: Update main home page link

**Files:**
- Modify: `src/app/page.tsx` (the `modules` array, English entry `href`)

- [ ] **Step 3.1: Update the href**

In `src/app/page.tsx`, find the `modules` array. The English module card currently has `href: '/english/words'`. Change it to `href: '/english'`:

```ts
// Before
{
  href: '/english/words',
  ...
}

// After
{
  href: '/english',
  ...
}
```

Only change the `href` value. Do not modify any other field.

- [ ] **Step 3.2: Run lint**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3.3: Verify navigation**

In the dev server (`pnpm dev`), go to `http://localhost:3000`. Click "英语天地" / "开始英语学习". Should navigate to `/english` (the new hub page), not directly to `/english/words/cards`.

- [ ] **Step 3.4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: update home page English card to link to /english hub"
```

---

## Task 4: Final verification

- [ ] **Step 4.1: Build check**

```bash
pnpm build
```

Expected: successful build with no TypeScript errors. If there are type errors, fix them before proceeding.

- [ ] **Step 4.2: Verify all routes still work**

With `pnpm dev` running, verify:
- `http://localhost:3000/english` → hub page (light header, stats, nav cards)
- `http://localhost:3000/english/words` → redirects to `/english/words/cards` (unchanged)
- `http://localhost:3000/english/words/cards` → dark-themed cards page with existing AppHeader (no hub header visible)
- `http://localhost:3000/english/words/daily` → daily practice page (no hub header)
- `http://localhost:3000` → home page, English card links to `/english`

- [ ] **Step 4.3: Final commit (if any remaining changes)**

If all checks pass and there are no outstanding changes, the feature is complete. No additional commit needed.
