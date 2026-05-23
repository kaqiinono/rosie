'use client'

import type { ReactNode } from 'react'

interface DoneSummaryProps {
  score: number
  total: number
  /** Full Tailwind gradient classes for the score number, e.g. "from-[#d97706] to-[#f59e0b]". */
  scoreGradientClasses: string
  /** Optional star reward line above the detail line. */
  starsEarned?: number
  detailLine: ReactNode
  masteredCount: number
  wordsCount: number
  actions: ReactNode
}

export default function DoneSummary({
  score,
  total,
  scoreGradientClasses,
  starsEarned,
  detailLine,
  masteredCount,
  wordsCount,
  actions,
}: DoneSummaryProps) {
  const pct = total ? Math.round((score / total) * 100) : 0
  const emoji = pct >= 90 ? '🏆' : pct >= 70 ? '🎉' : pct >= 50 ? '👍' : '💪'
  const msg = pct >= 90 ? '完美！' : pct >= 70 ? '太棒了！' : pct >= 50 ? '不错哦！' : '继续加油！'

  return (
    <div className="mx-auto max-w-[500px] px-5 py-10 text-center">
      <div className="mb-3.5 text-[3.5rem]">{emoji}</div>
      <div
        className={`font-fredoka mb-1.5 bg-gradient-to-br bg-clip-text text-[3rem] text-transparent ${scoreGradientClasses}`}
      >
        {score} / {total}
      </div>
      <div className="mb-2.5 text-[.9rem] font-bold text-[var(--wm-text-dim)]">{msg}</div>
      {starsEarned !== undefined && starsEarned > 0 && (
        <div className="mb-2 text-[0.875rem] font-extrabold" style={{ color: '#fbbf24' }}>
          ⭐ 获得 {starsEarned} 颗星星
        </div>
      )}
      <div className="mb-2 text-[0.875rem] leading-loose text-[var(--wm-text-dim)]">
        {detailLine}
      </div>
      <div className="mb-5 text-[1rem] font-bold text-[#4ade80]">
        本次练习：{masteredCount}/{wordsCount} 个单词已掌握 🦋
      </div>
      <div className="flex flex-wrap justify-center gap-2.5">{actions}</div>
    </div>
  )
}
