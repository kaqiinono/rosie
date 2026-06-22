'use client'

import Link from 'next/link'
import { useLesson37 } from '@/components/math/lesson37/Lesson37Provider'
import { PROBLEMS, TAG_STYLE } from '@/utils/lesson37-data'
import { SOURCE_LABELS } from '@/utils/constant'
import { getMasteryLevel, MASTERY_BORDER, MASTERY_BADGE_BG, MASTERY_ICON } from '@/utils/masteryUtils'
import type { Problem } from '@/utils/type'

const ALL_PROBLEMS = new Map<string, { p: Problem; setName: string; idx: number }>()
;(Object.entries(PROBLEMS) as [string, Problem[]][]).forEach(([setName, list]) => {
  list.forEach((p, i) => ALL_PROBLEMS.set(p.id, { p, setName, idx: i }))
})

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson37()

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
        <div className="mb-2 text-xs text-[#b91c1c]">
          答错的题目会自动收录 · 答对后自动移除
        </div>
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
            href="/math/ny/37"
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
            const href = `/math/ny/37/${setName}/${idx + 1}`

            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-[12px] border-[1.5px] bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow ${
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
