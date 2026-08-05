'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const btnBase =
    'inline-flex min-w-[96px] items-center justify-center rounded-full px-4 py-2.5 text-[13px] font-semibold no-underline transition-all active:scale-95'
  const btnOn = `${btnBase} bg-app-blue text-white shadow-[0_3px_10px_rgba(59,130,246,0.28)] hover:brightness-105`
  const btnOff = `${btnBase} cursor-not-allowed bg-gray-100 text-gray-400`
  const btnBusy = `${btnOn} pointer-events-none opacity-70`

  function go(href: string) {
    startTransition(() => {
      router.push(href)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  return (
    <div className="relative z-30 mt-6 flex items-center justify-between gap-3 border-t border-border-light pt-4 pb-2 md:pb-0">
      {prevHref ? (
        <button type="button" disabled={isPending} onClick={() => go(prevHref)} className={isPending ? btnBusy : btnOn}>
          ‹ 上一题
        </button>
      ) : (
        <span className={btnOff}>‹ 上一题</span>
      )}
      <span className="shrink-0 text-[12px] font-medium text-text-muted">{positionLabel}</span>
      {nextHref ? (
        <button type="button" disabled={isPending} onClick={() => go(nextHref)} className={isPending ? btnBusy : btnOn}>
          下一题 ›
        </button>
      ) : (
        <span className={btnOff}>下一题 ›</span>
      )}
    </div>
  )
}
