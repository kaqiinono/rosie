'use client'

import { useEffect, useMemo, useState } from 'react'
import { lessonSummaryProblemId } from '@rosie/math/constants'
import { SEA_LESSONS } from '@rosie/math/utils/sea-data'
import { lessonDisplayLabel } from '@rosie/math/utils/lesson-grade'
import type { useMathProblemNotesAdmin } from '@rosie/math/hooks/useMathProblemNotesAdmin'
import MathLessonSummaryPanel from '@rosie/math/admin/MathLessonSummaryPanel'
import { isRichBodyEmpty } from '@rosie/math/utils/sanitize-summary-html'

type AdminApi = ReturnType<typeof useMathProblemNotesAdmin>

type Props = {
  lessonIds: string[]
  admin: AdminApi
  onFlash: (msg: string) => void
}

function lessonTitle(id: string): string {
  return SEA_LESSONS.find((l) => l.id === id)?.title ?? `第 ${id} 讲`
}

function lessonHasSummary(admin: AdminApi, lessonId: string): boolean {
  return admin
    .getNotes(lessonSummaryProblemId(lessonId))
    .some((n) => !isRichBodyEmpty(n.bodyHtml))
}

function defaultOpenIds(sortedIds: string[], withSummary: string[]): Set<string> {
  if (withSummary.length > 0) return new Set(withSummary.slice(0, 3))
  return new Set(sortedIds.slice(0, 1))
}

export default function MathLessonSummariesPanel({ lessonIds, admin, onFlash }: Props) {
  const sortedIds = useMemo(
    () => [...lessonIds].sort((a, b) => Number(a) - Number(b)),
    [lessonIds],
  )

  const sortedIdsKey = sortedIds.join(',')

  const withSummary = useMemo(
    () => sortedIds.filter((id) => lessonHasSummary(admin, id)),
    [sortedIds, admin.notes],
  )

  const [openIds, setOpenIds] = useState<Set<string>>(() => defaultOpenIds(sortedIds, withSummary))

  useEffect(() => {
    setOpenIds(defaultOpenIds(sortedIds, withSummary))
  }, [sortedIdsKey])

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function expandAll() {
    setOpenIds(new Set(sortedIds))
  }

  function collapseAll() {
    setOpenIds(new Set())
  }

  const allExpanded = sortedIds.length > 0 && sortedIds.every((id) => openIds.has(id))
  const allCollapsed = openIds.size === 0

  if (sortedIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="text-3xl opacity-40">📋</div>
        <div className="text-[13px] text-slate-500">请先在左侧选择讲次</div>
      </div>
    )
  }

  if (sortedIds.length === 1) {
    const id = sortedIds[0]!
    return (
      <MathLessonSummaryPanel
        lessonId={id}
        lessonTitle={lessonTitle(id)}
        admin={admin}
        onFlash={onFlash}
      />
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-violet-700">
          已选 {sortedIds.length} 讲 · 点击讲次展开编辑。支持加粗、列表、插图与粘贴图片。
        </p>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={expandAll}
            disabled={allExpanded}
            className="rounded-lg border border-violet-200 px-2.5 py-1 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-50 disabled:cursor-default disabled:opacity-40"
          >
            全部展开
          </button>
          <button
            type="button"
            onClick={collapseAll}
            disabled={allCollapsed}
            className="rounded-lg border border-violet-200 px-2.5 py-1 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-50 disabled:cursor-default disabled:opacity-40"
          >
            全部收起
          </button>
        </div>
      </div>
      <div className="max-h-[calc(100vh-11rem)] space-y-2 overflow-y-auto pr-0.5">
        {sortedIds.map((id) => {
          const open = openIds.has(id)
          const hasContent = lessonHasSummary(admin, id)
          const title = lessonTitle(id)
          return (
            <div
              key={id}
              className="overflow-hidden rounded-xl border border-violet-100 bg-violet-50/30"
            >
              <button
                type="button"
                onClick={() => toggleOpen(id)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-violet-50/80"
                aria-expanded={open}
              >
                <span className="text-[10px] text-violet-400">{open ? '▼' : '▶'}</span>
                <span className="min-w-0 flex-1">
                  <span className="text-[12px] font-bold text-violet-900">
                    {lessonDisplayLabel(id, true)}
                  </span>
                  <span className="ml-1.5 truncate text-[11px] font-normal text-violet-700">
                    {title}
                  </span>
                </span>
                {hasContent ? (
                  <span className="shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                    已有总结
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                    未填写
                  </span>
                )}
              </button>
              {open && (
                <div className="border-t border-violet-100 bg-white/90 p-3">
                  <MathLessonSummaryPanel
                    lessonId={id}
                    lessonTitle={title}
                    admin={admin}
                    onFlash={onFlash}
                    embedded
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
