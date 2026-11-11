'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { Button } from '@rosie/ui/themes'
import { useLessonSummary } from '@rosie/math-kit/hooks/useLessonSummary'
import LessonSummaryBody from '@rosie/math-kit/components/shared/LessonSummaryBody'
import { isRichBodyEmpty } from '@rosie/math-kit/utils/sanitize-summary-html'

type Props = {
  lessonId: string
  className?: string
  /** Inside the hero title card, below the description. */
  embedded?: boolean
}

/** Collapsible lesson recap — collapsed by default on讲次 homepage. */
export default function LessonSummary({ lessonId, className, embedded = false }: Props) {
  const { summary, isLoading } = useLessonSummary(lessonId)
  const [expanded, setExpanded] = useState(false)

  if (isLoading || !summary || isRichBodyEmpty(summary.bodyHtml)) return null

  const toggle = (
    <Button
      type="button"
      size="2"
      radius="large"
      variant="soft"
      color="teal"
      onClick={() => setExpanded((v) => !v)}
      className="w-full justify-start"
      aria-expanded={expanded}
    >
      <span>📋 本讲内容总结</span>
      <span className="text-[10px] font-normal text-teal-700/80">
        {expanded ? '收起' : '点击展开'}
      </span>
      <span className="ml-auto text-[10px] text-teal-600">{expanded ? '▼' : '▶'}</span>
    </Button>
  )

  return (
    <div className={clsx(embedded ? 'mt-3 border-t border-black/10 pt-3' : 'mb-4', className)}>
      {toggle}
      {expanded && (
        <div className={clsx('mt-2', embedded && 'rounded-lg bg-white/55 p-1')}>
          <LessonSummaryBody
            bodyHtml={summary.bodyHtml}
            showHeader={false}
            className={embedded ? 'border-0 bg-transparent shadow-none' : undefined}
          />
        </div>
      )}
    </div>
  )
}
