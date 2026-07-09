'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import type { ProblemSet } from '@rosie/core'
import { RICH_CONTENT_CLEARFIX_TW } from '@rosie/math/components/shared/rich-text-image'
import { useLessonNotes } from '@rosie/math/hooks/useLessonNotes'
import { useLessonSummary } from '@rosie/math/hooks/useLessonSummary'
import LessonSummaryBody from '@rosie/math/components/shared/LessonSummaryBody'
import { buildLessonNoteEntries } from '@rosie/math/utils/lesson-note-entries'
import {
  isRichBodyEmpty,
  RICH_CONTENT_IMG_TW_COMPACT,
  sanitizeRichHtml,
} from '@rosie/math/utils/sanitize-summary-html'

type Props = {
  basePath: string
  lessonId: string
  problems: ProblemSet
}

export default function LessonNotesPage({ basePath, lessonId, problems }: Props) {
  const { summary, isLoading: summaryLoading } = useLessonSummary(lessonId)
  const { notes, isLoading } = useLessonNotes(lessonId)

  const entries = useMemo(
    () => buildLessonNoteEntries(notes, lessonId, basePath, problems),
    [notes, lessonId, basePath, problems],
  )

  const showSummary = !summaryLoading && summary != null && !isRichBodyEmpty(summary.bodyHtml)

  return (
    <div>
      {showSummary && (
        <div className="mb-4">
          <LessonSummaryBody bodyHtml={summary.bodyHtml} />
        </div>
      )}

      <div className="mb-4 rounded-[14px] border border-violet-100 bg-gradient-to-br from-violet-50/80 to-white p-4">
        <div className="flex items-center gap-2 text-sm font-extrabold text-violet-900">
          📝 笔记
          {!isLoading && entries.length > 0 && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700">
              {entries.length} 条
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-violet-700/80">本讲各题的家长笔记与讲解要点</p>
      </div>

      {isLoading ? (
        <p className="text-text-muted py-12 text-center text-[13px]">加载中…</p>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="text-5xl">📭</div>
          <div className="text-text-primary text-[15px] font-bold">还没有笔记</div>
          <div className="text-text-muted text-[13px]">家长可在管理后台为题目添加笔记</div>
          <Link
            href={basePath}
            className="mt-2 rounded-full bg-violet-600 px-5 py-2 text-[13px] font-semibold text-white no-underline shadow-[0_3px_10px_rgba(91,76,204,0.25)]"
          >
            返回首页 →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {entries.map(({ note, href, sourceLabel, problemTitle }) => {
            const body = (
              <>
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  {sourceLabel && (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                      {sourceLabel}
                    </span>
                  )}
                  <span className="text-text-primary truncate text-[13px] font-bold">
                    {problemTitle}
                  </span>
                </div>
                <div
                  className={clsx(
                    'lesson-note-preview text-text-secondary text-[12px] leading-relaxed',
                    '[&_strong]:text-text-primary [&_strong]:font-bold',
                    '[&_ul]:my-0.5 [&_ul]:list-disc [&_ul]:pl-4',
                    '[&_ol]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-4',
                    '[&_p]:my-0.5 [&_p:last-child]:mb-0',
                    RICH_CONTENT_IMG_TW_COMPACT,
                    RICH_CONTENT_CLEARFIX_TW,
                  )}
                  dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(note.bodyHtml) }}
                />
              </>
            )

            const cardClass =
              'block rounded-[12px] border border-violet-100 bg-[#faf9ff] p-3.5 no-underline transition hover:border-violet-200 hover:bg-violet-50/60 hover:shadow-[0_4px_16px_rgba(91,76,204,0.08)]'

            if (href) {
              return (
                <Link key={note.id} href={href} className={cardClass}>
                  {body}
                  <div className="mt-2 text-[10px] font-semibold text-violet-600">查看题目 →</div>
                </Link>
              )
            }

            return (
              <div key={note.id} className={cardClass}>
                {body}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
