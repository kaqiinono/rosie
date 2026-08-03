'use client'

import { useMemo } from 'react'
import clsx from 'clsx'
import type { ChineseLessonRow, LessonCharGroup } from '../../types/chineseCharData'
import type { ChineseBookSlug } from '../../utils/chinese-books'
import { buildPlanRoadmapNodes } from '../../utils/chineseRoadmapPlanLogic'
import type { ChineseRoadmapPlan } from '../../utils/chineseRoadmapPlanTypes'
import type { RoadmapNode } from '../../utils/chinese-roadmap'

type Props = {
  plan: Pick<ChineseRoadmapPlan, 'completedLessonKeys' | 'currentLessonKey'>
  bookSlug: ChineseBookSlug
  lessons: ChineseLessonRow[]
  lessonGroups: LessonCharGroup[]
  /** Lesson selected for run history (optional). */
  selectedLessonKey?: string | null
  onSelectLesson?: (lessonKey: string) => void
  className?: string
}

function nodeBadge(node: RoadmapNode): string {
  if (node.state === 'completed') return '✓'
  if (node.state === 'locked') return '·'
  if (node.lessonKind === 'garden') return '园'
  return String(node.bookLessonNo ?? node.unitLessonNo ?? '·')
}

export default function ChinesePlanRoadmapPreview({
  plan,
  bookSlug,
  lessons,
  lessonGroups,
  selectedLessonKey,
  onSelectLesson,
  className,
}: Props) {
  const nodes = useMemo(
    () => buildPlanRoadmapNodes(lessons, lessonGroups, plan, bookSlug),
    [lessons, lessonGroups, plan, bookSlug],
  )

  const completedCount = nodes.filter((n) => n.state === 'completed').length

  if (nodes.length === 0) {
    return (
      <div
        className={clsx('rounded-2xl px-4 py-6 text-center text-[13px] text-amber-800/70', className)}
        style={{ background: 'rgba(255,248,240,0.65)', border: '1.5px dashed rgba(245,158,11,.35)' }}
      >
        暂无路线图关卡
      </div>
    )
  }

  return (
    <div className={clsx('rounded-2xl border border-amber-200/80 bg-white/70 px-3 py-3', className)}>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <span className="text-[12px] font-extrabold text-amber-900">计划路线图</span>
        <span className="text-[11px] font-bold text-amber-700/80">
          已完成 {completedCount} / {nodes.length} 关
        </span>
      </div>
      <div className="flex max-h-[320px] flex-col gap-1.5 overflow-y-auto pr-1">
        {nodes.map((node) => {
          const selected = selectedLessonKey === node.lessonKey
          const clickable = !!onSelectLesson
          return (
            <button
              key={node.lessonKey}
              type="button"
              disabled={!clickable}
              onClick={() => onSelectLesson?.(node.lessonKey)}
              className={clsx(
                'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition',
                clickable && 'cursor-pointer hover:bg-amber-50',
                !clickable && 'cursor-default',
                selected && 'bg-amber-50 ring-1 ring-amber-300',
                node.state === 'locked' && 'opacity-60',
              )}
            >
              <span
                className={clsx(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold',
                  node.state === 'completed' && 'bg-emerald-500 text-white',
                  node.state === 'current' && 'bg-amber-500 text-white shadow-sm',
                  node.state === 'locked' && 'bg-slate-200 text-slate-500',
                )}
              >
                {nodeBadge(node)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-extrabold text-slate-800">
                  {node.label}
                </div>
                <div className="text-[11px] font-semibold text-slate-400">
                  第{node.unit}单元
                  {node.state === 'current' ? ' · 当前关' : ''}
                  {node.state === 'completed' ? ' · 已通关' : ''}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
