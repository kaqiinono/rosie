# 路由目录（必读）

新建目录：`apps/web/src/app/math/ny/{N}/`（App Router 路由必须留在 app，不进 package）。
共 12–14 个页面文件（含补充题则 +2）。

---

## `layout.tsx`

```tsx
'use client'

import { usePathname } from 'next/navigation'
import { PROBLEMS } from '@rosie/math/utils/lesson{N}-data'
import Lesson{N}Provider, { useLesson{N} } from '@rosie/math/components/lesson{N}/Lesson{N}Provider'
import AppHeader from '@rosie/math/components/lesson{N}/AppHeader'
import Sidebar from '@rosie/math/components/lesson{N}/Sidebar'
import BottomNav from '@rosie/math/components/lesson{N}/BottomNav'
import CongratsModal from '@rosie/math/components/lesson35/CongratsModal'
import Toast from '@rosie/math/components/lesson35/Toast'

const SECTION_COUNTS: Record<string, number> = {
  pretest: PROBLEMS.pretest.length,
  lesson: PROBLEMS.lesson.length,
  homework: PROBLEMS.homework.length,
  workbook: PROBLEMS.workbook.length,
  // supplement: PROBLEMS.supplement?.length ?? 0,  // 有补充题时取消注释
}

function getNextHref(pathname: string): string | undefined {
  const parts = pathname.split('/')
  const section = parts[4]
  const index = parseInt(parts[5])
  if (!section || isNaN(index)) return undefined
  const total = SECTION_COUNTS[section]
  if (!total || index >= total) return undefined
  return `/math/ny/{N}/${section}/${index + 1}`
}

function InnerLayout({ children }: { children: React.ReactNode }) {
  const { toast, setToast, showCongrats, setShowCongrats } = useLesson{N}()
  const pathname = usePathname()
  const nextHref = getNextHref(pathname)

  return (
    <div
      className="flex min-h-screen flex-col bg-[主题背景色] text-[15px] text-text-primary"
      style={{ fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif' }}
    >
      <AppHeader problems={PROBLEMS} />
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 pb-[60px] md:pb-0">
        <Sidebar problems={PROBLEMS} />
        <div className="min-w-0 flex-1 overflow-y-auto p-5 md:px-8 md:py-6">
          {children}
        </div>
      </div>
      <BottomNav />
      <CongratsModal visible={showCongrats} onClose={() => setShowCongrats(false)} nextHref={nextHref} />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

export default function Lesson{N}Layout({ children }: { children: React.ReactNode }) {
  return (
    <Lesson{N}Provider>
      <InnerLayout>{children}</InnerLayout>
    </Lesson{N}Provider>
  )
}
```

> **主题背景色** 颜色参考（与 AppHeader `titleColor` 同色系的极浅色）：
> - sky 主题 → `bg-[#f0f9ff]`；amber 主题 → `bg-[#fffbeb]`；green 主题 → `bg-[#f0fdf4]`

## `page.tsx`（讲次首页 hub）

```tsx
'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson{N}-data'
import { useLesson{N} } from '@rosie/math/components/lesson{N}/Lesson{N}Provider'
import HomePage from '@rosie/math/components/lesson{N}/HomePage'

export default function Lesson{N}Page() {
  const { solveCount } = useLesson{N}()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
```

## `lesson/page.tsx`、`homework/page.tsx`、`workbook/page.tsx`、`pretest/page.tsx`

各页面结构完全相同，只替换颜色和文案。以 `lesson/page.tsx` 为完整模板：

```tsx
'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson{N}-data'
import { useLesson{N} } from '@rosie/math/components/lesson{N}/Lesson{N}Provider'
import ProblemList from '@rosie/math/components/lesson{N}/ProblemList'

export default function LessonPage() {
  const { solveCount } = useLesson{N}()
  const list = PROBLEMS.lesson        // ✏️ homework/workbook/pretest 时改为对应字段
  const attempted = list.filter(p => (solveCount[p.id] ?? 0) >= 1).length
  const mastered = list.filter(p => (solveCount[p.id] ?? 0) >= 3).length
  const total = list.length

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-blue-200 bg-gradient-to-br from-blue-50 to-[#dbeafe] p-4">
        {/* ✏️ 各模块色系：lesson=blue, homework=green, workbook=purple, pretest=yellow */}
        <div className="mb-1 text-sm font-extrabold text-blue-900">📖 课堂讲解 · 第{N}讲</div>
        <div className="mb-2 text-xs text-blue-700">{total}道例题 · [题型描述]</div>
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-blue-100">
            <div className="absolute inset-y-0 left-0 rounded-full bg-blue-200 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((attempted / total) * 100) : 0}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((mastered / total) * 100) : 0}%` }} />
          </div>
          <div className="shrink-0 text-xs font-bold text-blue-700">
            练过 {attempted} · 🦋 {mastered}/{total}
          </div>
        </div>
      </div>
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/{N}/lesson" />
      {/* ✏️ basePath 末尾改为对应 section 名 */}
    </div>
  )
}
```

| 模块 | `PROBLEMS.xxx` | 图标+标题 | 色系 |
|------|---------------|-----------|------|
| `lesson/page.tsx` | `.lesson` | `📖 课堂讲解` | `blue` |
| `homework/page.tsx` | `.homework` | `✏️ 课后巩固` | `green` |
| `workbook/page.tsx` | `.workbook` | `📚 拓展练习` | `purple` |
| `pretest/page.tsx` | `.pretest` | `📝 课前测` | `yellow` |

## `lesson/[id]/page.tsx`、`homework/[id]/page.tsx`、`workbook/[id]/page.tsx`、`pretest/[id]/page.tsx`

所有详情页使用共享壳 **`LessonProblemRoutePage`**（自动解析 id、计算上一题/下一题链接并传给 `ProblemDetail`）。只替换 `basePath`、`section`、`problems` 与可选 `detailProps`：

```tsx
'use client'

import LessonProblemRoutePage from '@rosie/math/components/shared/LessonProblemRoutePage'
import { PROBLEMS } from '@rosie/math/utils/lesson{N}-data'
import ProblemDetail from '@rosie/math/components/lesson{N}/ProblemDetail'

export default function LessonProblemPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <LessonProblemRoutePage
      params={params}
      basePath="/math/ny/{N}"
      section="lesson"              // ✏️ lesson | homework | workbook | pretest | supplement
      problems={PROBLEMS.lesson}    // ✏️ 对应 PROBLEMS 字段
      Detail={ProblemDetail}
    />
  )
}
```

有 `LESSON_TIP` 的讲次（如 34–36）加 `detailProps={{ tip: LESSON_TIP }}`。

**不要**再手写 `parseInt(id)` + `notFound()` + 直接 `<ProblemDetail problem={...} />`。

## `alltest/page.tsx`

完整模板（直接复制，替换 `N` 为讲次编号、`lessonN` 为对应标识符）：

```tsx
'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PROBLEMS } from '@rosie/math/utils/lessonN-data'
import { useLessonN } from '@rosie/math/components/lessonN/LessonNProvider'
import type { ProblemDifficulty } from '@rosie/core'
import FilterPanel from '@rosie/math/components/lessonN/FilterPanel'

type MasteryFilter = 'all' | 'unstarted' | 'reinforce' | 'mastered'
type PracticeFilter = 'all' | 'unpracticed' | 'practiced'

function AlltestContent() {
  const { solveCount } = useLessonN()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')

  const [filters, setFilters] = useState(() => ({
    // source: 列出所有实际存在的 section key（pretest/lesson/homework/workbook/supplement）
    source: new Set(['pretest', 'lesson', 'homework', 'workbook']),
    // type: 列出数据文件中所有 PROBLEM_TYPES 的 tag（type1, type2, ...）
    type: typeParam ? new Set([typeParam]) : new Set(['type1', 'type2', 'type3', 'type4', 'type5', 'type6']),
    mastery: 'all' as MasteryFilter,
    practice: 'all' as PracticeFilter,
    difficulty: new Set<ProblemDifficulty>([1, 2, 3, 4, 5]),
  }))

  const toggleFilter = (axis: 'source' | 'type' | 'difficulty', value: string) => {
    if (axis === 'difficulty') {
      const level = Number(value) as ProblemDifficulty
      setFilters(f => {
        const next = new Set(f.difficulty)
        if (next.has(level)) next.delete(level)
        else next.add(level)
        return { ...f, difficulty: next }
      })
      return
    }
    setFilters(f => {
      const next = new Set(f[axis])
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...f, [axis]: next }
    })
  }

  const setMastery = (value: MasteryFilter) => {
    setFilters(f => ({ ...f, mastery: value }))
  }

  const setPractice = (value: PracticeFilter) => {
    setFilters(f => ({ ...f, practice: value }))
  }

  return (
    <FilterPanel
      problems={PROBLEMS}
      solveCount={solveCount}
      filters={filters}
      onToggleFilter={toggleFilter}
      onSetMastery={setMastery}
      onSetPractice={setPractice}
    />
  )
}

export default function AlltestPage() {
  return (
    <Suspense>
      <AlltestContent />
    </Suspense>
  )
}
```

## `mistakes/page.tsx`

完整模板（直接复制，替换 `N` 为讲次编号、`lessonN` 为对应标识符）：

```tsx
'use client'

import Link from 'next/link'
import { useLessonN } from '@rosie/math/components/lessonN/LessonNProvider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lessonN-data'
import { SOURCE_LABELS } from '@rosie/core'
import { getMasteryLevel, MASTERY_BORDER, MASTERY_BADGE_BG, MASTERY_ICON } from '@rosie/core'
import type { Problem } from '@rosie/core'

const ALL_PROBLEMS = new Map<string, { p: Problem; setName: string; idx: number }>()
;(Object.entries(PROBLEMS) as [string, Problem[]][]).forEach(([setName, list]) => {
  list.forEach((p, i) => ALL_PROBLEMS.set(p.id, { p, setName, idx: i }))
})

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLessonN()

  const wrongList = [...wrongIds]
    .map(id => ALL_PROBLEMS.get(id))
    .filter(Boolean) as { p: Problem; setName: string; idx: number }[]

  const masteredCount = wrongList.filter(({ p }) => (solveCount[p.id] ?? 0) >= 3).length

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-[#fecaca] bg-gradient-to-br from-[#fff5f5] to-[#fee2e2] p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-extrabold text-[#991b1b]">
          📕 错题本
          {wrongList.length > 0 && (
            <span className="rounded-full bg-[#fca5a5] px-2 py-0.5 text-[11px] font-bold text-[#7f1d1d]">
              {wrongList.length} 题
            </span>
          )}
        </div>
        <div className="mb-2 text-xs text-[#b91c1c]">答错的题目会自动收录 · 答对后自动移除</div>
        {wrongList.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative h-[5px] flex-1 overflow-hidden rounded-full bg-[#fecaca]">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[#f87171] transition-[width] duration-500"
                style={{ width: `${Math.round((masteredCount / wrongList.length) * 100)}%` }}
              />
            </div>
            <div className="shrink-0 text-[11px] font-bold text-[#991b1b]">
              已改正 {masteredCount}/{wrongList.length}
            </div>
          </div>
        )}
      </div>

      {wrongList.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="text-5xl">🎉</div>
          <div className="text-[15px] font-bold text-text-primary">错题本是空的！</div>
          <div className="text-[13px] text-text-muted">答错的题目会自动出现在这里</div>
          <Link
            href="/math/ny/N"
            className="mt-2 rounded-full bg-app-blue px-5 py-2 text-[13px] font-semibold text-white no-underline shadow-[0_3px_10px_rgba(59,130,246,0.3)]"
          >
            去做题 →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {wrongList.map(({ p, setName, idx }) => {
            const count = solveCount[p.id] ?? 0
            const level = getMasteryLevel(count)
            const isMastered = count >= 3
            const srcLabel = SOURCE_LABELS[setName] || setName
            const href = `/math/ny/N/${setName}/${idx + 1}`

            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-[12px] border-[1.5px] bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${
                  isMastered ? 'border-app-green opacity-70' : `border-[#fca5a5] ${MASTERY_BORDER[level]}`
                }`}
              >
                <div className={`flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full text-sm ${MASTERY_BADGE_BG[level]}`}>
                  {MASTERY_ICON[level]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-text-primary">{p.title}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    <span className={`rounded-full px-2 py-px text-[10px] font-semibold ${TAG_STYLE[p.tag] || 'bg-gray-100 text-gray-600'}`}>
                      {p.tagLabel}
                    </span>
                    <span className="rounded-full bg-[#f3e8ff] px-2 py-px text-[10px] font-semibold text-[#7e22ce]">
                      {srcLabel}
                    </span>
                    {count > 0 && (
                      <span className="rounded-full bg-gray-100 px-2 py-px text-[10px] text-text-muted">
                        已练 {count} 次
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Link
                    href={href}
                    className="rounded-full bg-app-blue px-3 py-1.5 text-[11px] font-semibold text-white no-underline"
                  >
                    {isMastered ? '再练' : '去练'}
                  </Link>
                  <button
                    onClick={() => removeWrong(p.id)}
                    className="rounded-full border border-[#fca5a5] px-2 py-1.5 text-[11px] text-[#dc2626] transition-colors hover:bg-[#fee2e2]"
                    title="从错题本移除"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

## supplement 路由（有补充题时新增）

### `supplement/page.tsx`

参考 `homework/page.tsx` 结构，主要区别：
- `const list = PROBLEMS.supplement ?? []`
- 页面头部用 amber 色系，强调训练主题
- basePath 为 `/math/ny/N/supplement`

```tsx
export default function SupplementPage() {
  const { solveCount } = useLessonN()
  const list = PROBLEMS.supplement ?? []
  // ...同 homework/page.tsx，替换标题文案
  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-amber-200 bg-gradient-to-br from-amber-50 to-[#fef3c7] p-4">
        <div className="mb-1 text-sm font-extrabold text-amber-900">📒 补充题 · 第N讲</div>
        <div className="mb-2 text-xs text-amber-700">N道速算训练 · [主题描述]</div>
        {/* 进度条 */}
      </div>
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/N/supplement" />
    </div>
  )
}
```

### `supplement/[id]/page.tsx`

与 `homework/[id]/page.tsx` 相同，使用 `LessonProblemRoutePage`：

```tsx
'use client'

import LessonProblemRoutePage from '@rosie/math/components/shared/LessonProblemRoutePage'
import { PROBLEMS } from '@rosie/math/utils/lesson{N}-data'
import ProblemDetail from '@rosie/math/components/lesson{N}/ProblemDetail'

export default function SupplementProblemPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <LessonProblemRoutePage
      params={params}
      basePath="/math/ny/{N}"
      section="supplement"
      problems={PROBLEMS.supplement ?? []}
      Detail={ProblemDetail}
    />
  )
}
```
