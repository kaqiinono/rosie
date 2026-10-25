'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { Problem } from '@rosie/core'
import { getMasteryLevel, MASTERY_ICON } from '@rosie/core'
import ExpandedProblemCard, { type ProblemDetailInlineComponent } from '@rosie/math-kit/components/shared/ExpandedProblemCard'
import MasonryGrid from '@rosie/math-kit/components/shared/MasonryGrid'
import PracticeCountBadge from '@rosie/math-kit/components/shared/PracticeCountBadge'
import { useLessonAnalysisImageIds } from '@rosie/math-kit/hooks/useLessonAnalysisImageIds'
import { problemHasAnalysisImage } from '@rosie/math-kit/utils/problem-analysis-image'
import { problemCardDisplayId } from '../../utils/problem-display-id'
import { problemPracticeStyle } from '../../utils/problem-practice-style'
import ProblemCardActions from './ProblemCardActions'
import { ProblemScratchProvider } from './ScratchPad/ProblemScratchContext'

type Props = {
  problems: Problem[]
  practiceCount: Record<string, number>
  correctCount: Record<string, number>
  basePath: string
  /** Lesson number used for alltest tag filter link, e.g. '35' */
  lessonId: string
  tagStyles: Record<string, string>
  showSource?: boolean
  sourceLabel?: string
  /** When set, card click starts continuous practice instead of opening detail page. */
  onPractice?: (problemId: string) => void
  /** Lesson base path for alltest tag links (defaults to stripping last segment of basePath). */
  lessonBasePath?: string
  /** Inline expand mode — requires ProblemDetail. */
  showExpanded?: boolean
  ProblemDetail?: ProblemDetailInlineComponent
  autoExpandSolution?: boolean
}

function MetaDot() {
  return <span className="shrink-0 text-[10px] text-slate-300" aria-hidden="true">·</span>
}

export default function LessonProblemList({
  problems,
  practiceCount,
  correctCount,
  basePath,
  lessonId,
  tagStyles,
  showSource,
  sourceLabel,
  onPractice,
  lessonBasePath,
  showExpanded = false,
  ProblemDetail,
  autoExpandSolution = false,
}: Props) {
  const router = useRouter()
  const dbAnalysisIds = useLessonAnalysisImageIds(lessonId)
  const alltestBase = lessonBasePath ?? basePath.replace(/\/[^/]+$/, '')
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (showExpanded) setCollapsedIds(new Set())
  }, [showExpanded])

  const toggleCard = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const cardClass = (count: number) =>
    `group relative top-0 flex h-full min-w-0 flex-col rounded-xl border bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-[top,box-shadow] duration-200 hover:-top-0.5 hover:shadow-[0_5px_16px_rgba(59,130,246,0.09)] motion-reduce:transition-none motion-reduce:hover:top-0 ${problemPracticeStyle(count).border}`

  if (showExpanded && ProblemDetail) {
    return (
      <>
        <MasonryGrid>
          {problems.map((p, i) => (
            <ExpandedProblemCard
              key={p.id}
              problem={p}
              index={i}
              scratchContext={{ sectionProblems: problems, section: basePath.split('/').filter(Boolean).pop() ?? 'lesson', problemIndex: i, basePath }}
              practiceCount={practiceCount}
              correctCount={correctCount}
              hasAnalysis={problemHasAnalysisImage(p, dbAnalysisIds)}
              tagStyles={tagStyles}
              isOpen={!collapsedIds.has(p.id)}
              onToggle={() => toggleCard(p.id)}
              ProblemDetail={ProblemDetail}
              defaultSolutionOpen={autoExpandSolution}
              sourceLabel={showSource ? sourceLabel : undefined}
              sourceBadgeClass={showSource ? 'bg-purple-100 text-purple-700' : undefined}
              href={`${basePath}/${i + 1}`}
            />
          ))}
        </MasonryGrid>
        {problems.length === 0 && (
          <div className="py-6 text-center text-[13px] text-text-muted">
            没有符合筛选条件的题目
          </div>
        )}
      </>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {problems.map((p, i) => {
        const count = practiceCount[p.id] ?? 0
        const level = getMasteryLevel(correctCount[p.id] ?? 0)
        const hasAnalysis = problemHasAnalysisImage(p, dbAnalysisIds)
        const practiceStyle = problemPracticeStyle(count)

        const inner = (
          <>
            <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5">
              <div
                className="flex h-8 min-w-8 items-center justify-center whitespace-nowrap rounded-lg bg-app-blue-light px-2 text-xs font-semibold tabular-nums text-app-blue-dark"
              >
                {problemCardDisplayId(p)}
              </div>
              <span className={`text-sm leading-none ${level === 0 ? 'text-text-muted' : ''}`}>
                {MASTERY_ICON[level]}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1">
                <div className="min-w-0 flex-1 text-sm font-semibold leading-snug break-words text-text-primary">
                  {p.title}
                </div>
              </div>

              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] text-text-secondary">
                <span
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    router.push(`${alltestBase}/alltest?type=${p.tag}`)
                  }}
                  className={`inline-flex max-w-full cursor-pointer items-center truncate rounded px-1.5 py-0.5 font-medium ${tagStyles[p.tag] || 'bg-gray-100 text-gray-600'}`}
                  title={`查看所有${p.tagLabel}题目`}
                >
                  {p.tagLabel}
                </span>
                <MetaDot />
                <span className="shrink-0 font-medium tabular-nums">难度 {p.difficulty}/5</span>
                <MetaDot />
                <PracticeCountBadge count={count} compact />
                {showSource && sourceLabel && (
                  <>
                    <MetaDot />
                    <span className="max-w-full truncate font-medium text-text-secondary">{sourceLabel}</span>
                  </>
                )}
              </div>
            </div>

          </>
        )

        return (
          <div key={p.id} className={cardClass(count)}>
            <span aria-hidden="true" className={`pointer-events-none absolute inset-x-4 top-0 h-[3px] rounded-b-full ${practiceStyle.accent}`} />
            {onPractice ? (
              <button
                type="button"
                onClick={() => onPractice(p.id)}
                className="flex w-full min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-lg p-4 text-left focus-visible:outline-2 focus-visible:outline-app-blue"
              >
                {inner}
              </button>
            ) : (
              <Link href={`${basePath}/${i + 1}`} className="flex min-w-0 flex-1 items-start gap-3 rounded-lg p-4 text-left no-underline focus-visible:outline-2 focus-visible:outline-app-blue">
                {inner}
              </Link>
            )}
            <ProblemScratchProvider value={{ sectionProblems: problems, section: basePath.split('/').filter(Boolean).pop() ?? 'lesson', problemIndex: i, basePath }}>
              <ProblemCardActions problem={p} hasAnalysis={hasAnalysis} practiceCount={count} />
            </ProblemScratchProvider>
          </div>
        )
      })}
      {problems.length === 0 && (
        <div className="col-span-full py-6 text-center text-[13px] text-text-muted">
          没有符合筛选条件的题目
        </div>
      )}
    </div>
  )
}
