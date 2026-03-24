# English Module Homepage (`/english`) — Design Spec

Date: 2026-03-24

## Overview

Add a new `/english` route as the English module entry page. It serves as a hub showing overall vocabulary learning progress and providing navigation into the three sub-sections (Cards, Daily, Practice).

Currently `/english/words` is the direct entry point; this page sits one level above and adds a dashboard view before entering the dark-themed words module.

## Goals

- Show key learning progress stats at a glance: words touched, total practice count, accuracy, last practice date, words due for review today, graduated words
- Provide clear navigation into the three functional areas
- Fit visually with the main home page (light theme) as a transitional entry layer

## Out of Scope

- No new data storage or schema changes
- No changes to existing `/english/words/*` routes or `WordsContext`
- No weekly plan stats on this page (those live in `/today`)

---

## Architecture

### Files Created

| File | Purpose |
|---|---|
| `src/app/english/layout.tsx` | Minimal layout: light background + header with back button |
| `src/app/english/page.tsx` | Stats + nav hub client component |

### Files Modified

- `src/app/page.tsx` — update the `href` for the English module card from `/english/words` to `/english`

### Data Flow

`page.tsx` uses `useAuth()` to get `user`, then calls:
- `useWordMastery(user)` — provides `masteryMap: WordMasteryMap`
- `useWordData(user)` — provides `vocab: WordEntry[]`

Both hooks are already used in `WordsContext`; here they are called directly without a shared context, which is fine since this page is rendered independently and doesn't need to share state with the words sub-pages.

No new hooks or utilities are introduced.

### Computed Stats

All derived from `masteryMap` on the client:

| Stat | Calculation |
|---|---|
| 已接触单词 | `Object.keys(masteryMap).length` |
| 总打卡次数 | `sum(info.correct + info.incorrect)` for all entries |
| 正确率 | `sum(correct) / sum(correct + incorrect)`, shown as percentage |
| 最近打卡 | `max(info.lastSeen)` across all entries |
| 今日待复习 | entries where `info.nextReviewDate <= today` |
| 已毕业单词 | entries where `isGraduated(info) === true` |

---

## UI Layout

### layout.tsx

- Light background (`bg-surface-dim` / `#f8fafc`)
- Sticky header: left-aligned `← 主页` link to `/`, centered "英语天地 📖" title
- No import/export/immersive controls (those belong to `/english/words` layout)

### page.tsx

**Section 1 — Stats grid (2 columns, 3 rows on mobile; 3 columns, 2 rows on md+)**

Six stat cards, each with:
- Icon (emoji)
- Large number
- Label

Cards:
1. 📚 已接触单词 — count
2. ✏️ 总打卡次数 — count
3. 🎯 正确率 — percentage
4. 🕐 最近打卡 — relative date (e.g. "3天前" or "今天")
5. 🔔 今日待复习 — count (highlighted if > 0)
6. 🦋 已毕业单词 — count

**Section 2 — Function nav cards (vertical stack on mobile, 3 columns on md+)**

Three large tappable cards:
1. **单词卡片** → `/english/words/cards` — icon 🃏, desc "浏览和翻转单词卡"
2. **每日打卡** → `/english/words/daily` — icon 📅, desc "完成今日单词计划"
3. **练习模式** → `/english/words/practice` — icon 🏋️, desc "拼写和词义练习"

Nav cards use the English module color theme (`--color-eng-from` green → `--color-eng-to` cyan gradient tint).

### Loading State

While `masteryMap` is loading (hook fetching from Supabase), show skeleton placeholders for the stat numbers. The nav cards are always visible immediately.

### Empty State

If `Object.keys(masteryMap).length === 0`, show a friendly message: "还没有打卡记录，快去打卡吧！" above the nav cards instead of the stats grid.

---

## Visual Style

- Background: `#f8fafc` (light, matches main home)
- Stat card background: white with subtle border (`border-border-light`)
- Accent color: `--color-eng-from` (`#10b981` green) and `--color-eng-to` (`#06b6d4` cyan)
- Typography: `font-nunito` (matches app font stack)
- Rounded corners: `rounded-2xl` for cards
- Responsive: mobile-first, `md:` breakpoints for column layout changes
