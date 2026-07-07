'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { useLessonSummary } from '@rosie/math/hooks/useLessonSummary'
import LessonSummaryBody from '@rosie/math/components/shared/LessonSummaryBody'
import { isRichBodyEmpty } from '@rosie/math/utils/sanitize-summary-html'

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
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      className={clsx(
        'flex w-full items-center gap-2 text-left transition',
        embedded
          ? 'rounded-lg bg-white/55 px-3 py-2 text-[12px] font-bold text-teal-900 backdrop-blur-sm hover:bg-white/75'
          : 'rounded-[14px] border border-teal-100 bg-white px-3 py-2.5 text-[12px] font-bold text-teal-900 shadow-[0_2px_12px_rgba(0,0,0,0.07)] hover:bg-teal-50/40',
      )}
      aria-expanded={expanded}
    >
      <span>📋 本讲内容总结</span>
      <span className="text-[10px] font-normal text-teal-700/80">
        {expanded ? '收起' : '点击展开'}
      </span>
      <span className="ml-auto text-[10px] text-teal-600">{expanded ? '▼' : '▶'}</span>
    </button>
  )

  return (
    <div
      className={clsx(
        embedded ? 'mt-3 border-t border-black/10 pt-3' : 'mb-4',
        className,
      )}
    >
      {toggle}
      {expanded && (
        <div className={clsx('mt-2', embedded && 'rounded-lg bg-white/55 p-1 backdrop-blur-sm')}>
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
