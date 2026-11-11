'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@rosie/ui/themes'

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

  function go(href: string) {
    startTransition(() => {
      router.push(href)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  return (
    <div className="border-border-light relative z-30 mt-6 flex items-center justify-between gap-3 border-t pt-4 pb-2 md:pb-0">
      {prevHref ? (
        <Button
          type="button"
          size="3"
          radius="full"
          variant="solid"
          className="min-w-24"
          disabled={isPending}
          onClick={() => go(prevHref)}
        >
          ‹ 上一题
        </Button>
      ) : (
        <Button
          type="button"
          size="3"
          radius="full"
          variant="soft"
          color="gray"
          className="min-w-24"
          disabled
        >
          ‹ 上一题
        </Button>
      )}
      <span className="text-text-muted shrink-0 text-[12px] font-medium">{positionLabel}</span>
      {nextHref ? (
        <Button
          type="button"
          size="3"
          radius="full"
          variant="solid"
          className="min-w-24"
          disabled={isPending}
          onClick={() => go(nextHref)}
        >
          下一题 ›
        </Button>
      ) : (
        <Button
          type="button"
          size="3"
          radius="full"
          variant="soft"
          color="gray"
          className="min-w-24"
          disabled
        >
          下一题 ›
        </Button>
      )}
    </div>
  )
}
