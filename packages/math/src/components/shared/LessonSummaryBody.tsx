'use client'

import clsx from 'clsx'
import { RICH_CONTENT_CLEARFIX_TW } from '@rosie/math/components/shared/rich-text-image'
import {
  RICH_CONTENT_IMG_TW_COMPACT,
  sanitizeRichHtml,
} from '@rosie/math/utils/sanitize-summary-html'

type Props = {
  bodyHtml: string
  /** Admin inline preview — compact max height. */
  preview?: boolean
  /** Show card title bar (homepage uses collapsible toggle instead). */
  showHeader?: boolean
  className?: string
}

/** Rich-text body for lesson recap (homepage expanded + admin preview). */
export default function LessonSummaryBody({
  bodyHtml,
  preview = false,
  showHeader = true,
  className,
}: Props) {
  const html = sanitizeRichHtml(bodyHtml)

  return (
    <div
      className={clsx(
        'overflow-hidden rounded-[14px] border border-teal-100 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.07)]',
        className,
      )}
    >
      {showHeader && (
        <div className="border-b border-teal-50 bg-teal-50/60 px-3 py-1.5 text-[12px] font-bold text-teal-900">
          📋 本讲内容总结
        </div>
      )}
      <div
        className={clsx(
          'lesson-summary-content px-3 py-2 text-[11px] leading-snug text-slate-700',
          preview && 'max-h-[168px] overflow-y-auto',
          '[&_strong]:font-bold [&_strong]:text-slate-900',
          '[&_ul]:my-0.5 [&_ul]:list-disc [&_ul]:pl-4',
          '[&_ol]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-4',
          '[&_li]:my-0 [&_p]:my-0.5 [&_p:last-child]:mb-0',
          '[&_mark]:rounded-sm [&_mark]:px-0.5',
          RICH_CONTENT_IMG_TW_COMPACT,
          RICH_CONTENT_CLEARFIX_TW,
        )}
      >
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  )
}
