'use client'

import Link from 'next/link'

type LessonProblemNavBarProps = {
  prevHref: string | null
  nextHref: string | null
  positionLabel: string
}

export default function LessonProblemNavBar({
  prevHref,
  nextHref,
  positionLabel,
}: LessonProblemNavBarProps) {
  const btnBase =
    'inline-flex min-w-[96px] items-center justify-center rounded-full px-4 py-2.5 text-[13px] font-semibold no-underline transition-all active:scale-95'
  const btnOn = `${btnBase} bg-app-blue text-white shadow-[0_3px_10px_rgba(59,130,246,0.28)] hover:brightness-105`
  const btnOff = `${btnBase} cursor-not-allowed bg-gray-100 text-gray-400`

  return (
    <div className="mt-6 flex items-center justify-between gap-3 border-t border-border-light pt-4">
      {prevHref ? (
        <Link href={prevHref} className={btnOn}>
          ‹ 上一题
        </Link>
      ) : (
        <span className={btnOff}>‹ 上一题</span>
      )}
      <span className="shrink-0 text-[12px] font-medium text-text-muted">{positionLabel}</span>
      {nextHref ? (
        <Link href={nextHref} className={btnOn}>
          下一题 ›
        </Link>
      ) : (
        <span className={btnOff}>下一题 ›</span>
      )}
    </div>
  )
}
