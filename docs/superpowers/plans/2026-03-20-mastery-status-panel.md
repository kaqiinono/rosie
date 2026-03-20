# Mastery Status Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible table panel at the bottom of the 每日一练 page showing each practiced word's Ebbinghaus stage, next review date, and hard/graduated status.

**Architecture:** Create a pure display component `MasteryStatusPanel` that receives `vocab` and `masteryMap` as props. Add it inside `WeeklyPractice` (which already has both) so it renders in the `week-view` and `done` phases below the existing content.

**Tech Stack:** React (Next.js), TypeScript, Tailwind CSS (via CSS variables matching existing `--wm-*` theme)

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/components/english/words/MasteryStatusPanel.tsx` | New collapsible table component |
| Modify | `src/components/english/words/WeeklyPractice.tsx` | Import and render the panel in week-view and done phases |

---

## Task 1: Create MasteryStatusPanel component

**Files:**
- Create: `src/components/english/words/MasteryStatusPanel.tsx`

- [ ] **Step 1: Create the component file**

```tsx
'use client'

import { useState } from 'react'
import type { WordEntry, WordMasteryMap } from '@/utils/type'
import { wordKey } from '@/utils/english-helpers'
import { ensureStageInit, isGraduated, MASTERY_ICON, getMasteryLevel } from '@/utils/masteryUtils'

interface MasteryStatusPanelProps {
  vocab: WordEntry[]
  masteryMap: WordMasteryMap
}

function formatDue(nextReviewDate: string | undefined, today: string): { label: string; urgent: 'today' | 'tomorrow' | 'future' | 'none' } {
  if (!nextReviewDate) return { label: '—', urgent: 'none' }
  const diff = Math.floor((Date.parse(nextReviewDate) - Date.parse(today)) / 86400000)
  if (diff <= 0) return { label: '今天', urgent: 'today' }
  if (diff === 1) return { label: '明天', urgent: 'tomorrow' }
  return { label: `${diff}天后`, urgent: 'future' }
}

export default function MasteryStatusPanel({ vocab, masteryMap }: MasteryStatusPanelProps) {
  const [open, setOpen] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  // Only words with mastery records
  const rows = vocab
    .filter(w => masteryMap[wordKey(w)] !== undefined)
    .map(w => {
      const key = wordKey(w)
      const raw = masteryMap[key]!
      const m = ensureStageInit(raw, today)
      const graduated = isGraduated(m)
      const due = graduated ? { label: '已毕业', urgent: 'none' as const } : formatDue(m.nextReviewDate, today)
      return { w, m, graduated, due }
    })
    .sort((a, b) => {
      // Graduated words go last
      if (a.graduated && !b.graduated) return 1
      if (!a.graduated && b.graduated) return -1
      // Sort by nextReviewDate ascending (overdue first)
      const da = a.m.nextReviewDate ?? '9999-12-31'
      const db = b.m.nextReviewDate ?? '9999-12-31'
      return da.localeCompare(db)
    })

  const hardCount = rows.filter(r => r.m.isHard && !r.graduated).length
  const graduatedCount = rows.filter(r => r.graduated).length

  return (
    <div className="mx-auto max-w-[560px] px-4 pb-8">
      <div className="border border-[var(--wm-border)] rounded-[14px] overflow-hidden">

        {/* Header / toggle */}
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[var(--wm-surface)] hover:bg-[var(--wm-surface2)] transition-colors text-left cursor-pointer border-0"
        >
          <div className="flex items-center gap-2">
            <span className="text-[15px]">📊</span>
            <span className="text-[var(--wm-text)] text-[13px] font-bold font-nunito">词汇学习状态</span>
            <span className="bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] text-[10px] font-bold px-2 py-0.5 rounded-full">
              {rows.length} 个词
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hardCount > 0 && (
              <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                🔥 {hardCount} 难词
              </span>
            )}
            {graduatedCount > 0 && (
              <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                ✓ {graduatedCount} 毕业
              </span>
            )}
            <svg
              className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              style={{ color: 'var(--wm-text-dim)' }}
            >
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </div>
        </button>

        {/* Table */}
        {open && (
          <div className="overflow-x-auto border-t border-[var(--wm-border)]">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-[var(--wm-surface)]">
                  <th className="px-4 py-2 text-left text-[10px] font-bold text-[var(--wm-text-dim)] tracking-wider">单词</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-[var(--wm-text-dim)] tracking-wider">课程</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-[var(--wm-text-dim)] tracking-wider">阶段</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-[var(--wm-text-dim)] tracking-wider">下次复习</th>
                  <th className="px-4 py-2 text-center text-[10px] font-bold text-[var(--wm-text-dim)] tracking-wider">状态</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ w, m, graduated, due }) => {
                  const level = getMasteryLevel(m.correct ?? 0)
                  return (
                    <tr
                      key={wordKey(w)}
                      className="border-t border-[var(--wm-border)]"
                      style={{ opacity: graduated ? 0.6 : 1 }}
                    >
                      <td className="px-4 py-2 font-bold" style={{ color: graduated ? '#4ade80' : 'var(--wm-text)' }}>
                        {w.word}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-[var(--wm-text-dim)]">
                        {w.unit.replace(/\D+(\d+)/, 'U$1')} {w.lesson.replace(/\D+(\d+)/, 'L$1')}
                      </td>
                      <td className="px-3 py-2 text-center text-[var(--wm-text-dim)]">
                        {graduated ? '🦋' : MASTERY_ICON[level]} {m.stage ?? 0}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {due.urgent === 'today' && (
                          <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{due.label}</span>
                        )}
                        {due.urgent === 'tomorrow' && (
                          <span className="bg-orange-500/20 text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{due.label}</span>
                        )}
                        {due.urgent === 'future' && (
                          <span className="text-[var(--wm-text-dim)] text-[10px] font-bold">{due.label}</span>
                        )}
                        {due.urgent === 'none' && (
                          <span className="text-green-400 text-[10px] font-bold">{due.label}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {graduated ? (
                          <span className="text-green-400 text-[10px] font-bold">✓ 毕业</span>
                        ) : m.isHard ? (
                          <span className="text-red-400 text-[10px] font-bold">🔥 难</span>
                        ) : (
                          <span className="text-[var(--wm-text-dim)]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-[var(--wm-text-dim)] text-[12px]">
                      还没有练习过的词 — 完成一次练习后这里会显示数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the file was created correctly**

Check that `src/components/english/words/MasteryStatusPanel.tsx` exists and has no TypeScript errors by looking at the IDE diagnostics or running:
```bash
cd /Users/meinuo/workspace/outer/rosie && npx tsc --noEmit 2>&1 | grep MasteryStatusPanel
```
Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
cd /Users/meinuo/workspace/outer/rosie
git add src/components/english/words/MasteryStatusPanel.tsx
git commit -m "feat: add MasteryStatusPanel component"
```

---

## Task 2: Integrate panel into WeeklyPractice

**Files:**
- Modify: `src/components/english/words/WeeklyPractice.tsx`

The component has multiple early-return phases. We add the panel in the `week-view` and `done` phases. In both places, wrap the existing returned JSX in a fragment and append `<MasteryStatusPanel>` below it.

- [ ] **Step 1: Add import at top of WeeklyPractice.tsx**

Find the existing imports block (around line 1–20) and add:

```tsx
import MasteryStatusPanel from './MasteryStatusPanel'
```

- [ ] **Step 2: Find the week-view phase return**

Search for the `phase === 'week-view'` section. It returns a `<div>` starting around the line containing `week-view`. Wrap its return in a fragment and append the panel:

```tsx
  // Find the block that looks like:
  if (phase === 'week-view') {
    return (
      <div ...>
        ...existing week-view JSX...
      </div>
    )
  }

  // Change to:
  if (phase === 'week-view') {
    return (
      <>
        <div ...>
          ...existing week-view JSX...
        </div>
        <MasteryStatusPanel vocab={vocab} masteryMap={masteryMap} />
      </>
    )
  }
```

- [ ] **Step 3: Find the done phase return**

Search for `phase === 'done'` (or the results/done screen — it contains "重新测试" button around line 706). Wrap similarly:

```tsx
  // Find the block that looks like:
  if (phase === 'done') {
    return (
      <div ...>
        ...existing done JSX...
      </div>
    )
  }

  // Change to:
  if (phase === 'done') {
    return (
      <>
        <div ...>
          ...existing done JSX...
        </div>
        <MasteryStatusPanel vocab={vocab} masteryMap={masteryMap} />
      </>
    )
  }
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/meinuo/workspace/outer/rosie && npx tsc --noEmit 2>&1 | grep -E 'error|WeeklyPractice|MasteryStatus'
```
Expected: no output

- [ ] **Step 5: Manual verification**

1. Run `pnpm dev` and open `/english/words/daily`
2. Complete or skip through to the week-view
3. Confirm the "📊 词汇学习状态" panel appears at the bottom
4. Click the header to expand — table should appear with practiced words
5. Words with `isHard=true` should show 🔥, graduated words should show ✓ and be dimmed
6. Words that haven't been practiced should not appear

- [ ] **Step 6: Commit**

```bash
cd /Users/meinuo/workspace/outer/rosie
git add src/components/english/words/WeeklyPractice.tsx
git commit -m "feat: show mastery status panel in daily practice page"
```
