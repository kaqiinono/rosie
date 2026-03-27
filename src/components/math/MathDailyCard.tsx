'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useMathWeeklyPlan } from '@/hooks/useMathWeeklyPlan'
import { todayStr } from '@/utils/constant'

const LESSON_INFO: Record<string, { emoji: string; short: string }> = {
  '35': { emoji: '🐦', short: '归一问题' },
  '36': { emoji: '📅', short: '星期几问题' },
}

export default function MathDailyCard() {
  const { user } = useAuth()
  const { weeklyPlan, isLoading } = useMathWeeklyPlan(user)

  const today = todayStr()
  const todayPlan = weeklyPlan?.days.find(d => d.date === today)
  const progress = weeklyPlan?.progress[today] ?? { doneKeys: [] }
  const total = todayPlan?.problems.length ?? 0
  const done = progress.doneKeys.filter(k =>
    todayPlan?.problems.some(p => p.key === k)
  ).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const allDone = total > 0 && done >= total
  const info = LESSON_INFO[weeklyPlan?.lessonId ?? ''] ?? null

  return (
    <Link
      href="/math/ny/daily"
      className="group relative block w-full overflow-hidden rounded-[20px] no-underline transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_44px_rgba(251,146,60,.25)]"
      style={{
        background: 'linear-gradient(135deg, #fff7ed 0%, #fef3c7 50%, #fce7f3 100%)',
        border: '2px solid rgba(251,146,60,.3)',
        boxShadow: '0 4px 20px rgba(251,146,60,.12)',
      }}
    >
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-orange-300/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-4 left-8 h-16 w-16 rounded-full bg-yellow-300/25 blur-xl" />
      <div className="pointer-events-none absolute right-12 bottom-2 h-10 w-10 rounded-full bg-pink-300/20 blur-lg" />

      <div className="relative px-5 py-4">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl animate-wiggle inline-block">⭐</span>
            <span className="text-[14px] font-extrabold text-orange-800 tracking-tight">每日一练</span>
            {info && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                {info.emoji} {info.short}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[12px] font-bold text-orange-500 transition-transform group-hover:translate-x-0.5">
            {(() => {
              if (isLoading) return '…'
              if (!weeklyPlan) return '新建计划'
              return allDone ? '✅ 完成！' : '去做题'
            })()}
            <span className="text-[14px]">→</span>
          </div>
        </div>

        {isLoading ? (
          <div className="h-2 w-full animate-pulse rounded-full bg-orange-100" />
        ) : weeklyPlan && total > 0 ? (
          <>
            {/* Progress bar */}
            <div className="mb-2 flex items-center gap-2">
              <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-orange-100">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: allDone
                      ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                      : 'linear-gradient(90deg, #f97316, #fbbf24)',
                  }}
                />
                {/* Shimmer on incomplete */}
                {!allDone && pct > 5 && (
                  <div
                    className="absolute inset-y-0 left-0 rounded-full opacity-50"
                    style={{
                      width: `${pct}%`,
                      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,.6) 50%, transparent 100%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 2s linear infinite',
                    }}
                  />
                )}
              </div>
              <span className={`shrink-0 text-[12px] font-extrabold ${allDone ? 'text-green-600' : 'text-orange-600'}`}>
                {done}/{total}
              </span>
            </div>

            {/* Today's problems preview */}
            <div className="flex flex-wrap gap-1.5">
              {todayPlan!.problems.slice(0, 4).map((p, i) => {
                const isDone = progress.doneKeys.includes(p.key)
                return (
                  <span
                    key={p.key}
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-all ${
                      isDone
                        ? 'bg-green-100 text-green-700 line-through opacity-70'
                        : 'bg-white/80 text-orange-700 border border-orange-200'
                    }`}
                  >
                    {isDone ? '⭐' : `${i + 1}.`} {p.title.split('·')[0].trim()}
                  </span>
                )
              })}
              {total > 4 && (
                <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-[10px] font-bold text-orange-400 border border-orange-100">
                  +{total - 4} 题
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="text-[12px] text-orange-700/70 font-medium">
            还没有本周计划，点击创建 ✨
          </div>
        )}
      </div>
    </Link>
  )
}
