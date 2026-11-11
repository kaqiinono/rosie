'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import type { Problem } from '@rosie/core'
import { getMasteryLevel, MASTERY_ICON } from '@rosie/core'
import ExpandedProblemCard, {
  type ProblemDetailInlineComponent,
} from '@rosie/math-kit/components/shared/ExpandedProblemCard'
import MasonryGrid from '@rosie/math-kit/components/shared/MasonryGrid'
import PracticeCountBadge from '@rosie/math-kit/components/shared/PracticeCountBadge'
import { useLessonAnalysisImageIds } from '@rosie/math-kit/hooks/useLessonAnalysisImageIds'
import { problemHasAnalysisImage } from '@rosie/math-kit/utils/problem-analysis-image'
import { problemCardDisplayId } from '../../utils/problem-display-id'
import { problemPracticeStyle } from '../../utils/problem-practice-style'
import ProblemCardActions from './ProblemCardActions'
import { ProblemScratchProvider } from './ScratchPad/ProblemScratchContext'
import { Button } from '@rosie/ui/themes'

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
  return (
    <span className="shrink-0 text-[10px] text-slate-300" aria-hidden="true">
      ·
    </span>
  )
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

  const [previousExpanded, setPreviousExpanded] = useState(showExpanded)
  if (previousExpanded !== showExpanded) {
    setPreviousExpanded(showExpanded)
    if (showExpanded) setCollapsedIds(new Set())
  }

  const toggleCard = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const cardClass = (count: number) =>
    `group relative top-0 flex h-full min-w-0 flex-col rounded-xl border bg-white text-left shadow-sticker-sm transition-[top,box-shadow] duration-200 hover:-top-0.5 hover:shadow-sticker-sm motion-reduce:transition-none motion-reduce:hover:top-0 ${problemPracticeStyle(count).border}`

  if (showExpanded && ProblemDetail) {
    return (
      <>
        <MasonryGrid>
          {problems.map((p, i) => (
            <ExpandedProblemCard
              key={p.id}
              problem={p}
              index={i}
              scratchContext={{
                sectionProblems: problems,
                section: basePath.split('/').filter(Boolean).pop() ?? 'lesson',
                problemIndex: i,
                basePath,
              }}
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
          <div className="text-text-muted py-6 text-center text-[13px]">没有符合筛选条件的题目</div>
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
              <div className="bg-app-blue-light text-app-blue-dark flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold whitespace-nowrap tabular-nums">
                {problemCardDisplayId(p)}
              </div>
              <span className={`text-sm leading-none ${level === 0 ? 'text-text-muted' : ''}`}>
                {MASTERY_ICON[level]}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1">
                <div className="text-text-primary min-w-0 flex-1 text-sm leading-snug font-semibold break-words">
                  {p.title}
                </div>
              </div>

              <div className="text-text-secondary mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px]">
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
                    <span className="text-text-secondary max-w-full truncate font-medium">
                      {sourceLabel}
                    </span>
                  </>
                )}
              </div>
            </div>
          </>
        )

        return (
          <div key={p.id} className={cardClass(count)}>
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-4 top-0 h-[3px] rounded-b-full ${practiceStyle.accent}`}
            />
            {onPractice ? (
              <Button
                type="button"
                onClick={() => onPractice(p.id)}
                variant="ghost"
                color="gray"
                size="2"
                className="w-full min-w-0 flex-1"
              >
                {inner}
              </Button>
            ) : (
              <Link
                href={`${basePath}/${i + 1}`}
                className="focus-visible:outline-app-blue flex min-w-0 flex-1 items-start gap-3 rounded-lg p-4 text-left no-underline focus-visible:outline-2"
              >
                {inner}
              </Link>
            )}
            <ProblemScratchProvider
              value={{
                sectionProblems: problems,
                section: basePath.split('/').filter(Boolean).pop() ?? 'lesson',
                problemIndex: i,
                basePath,
              }}
            >
              <ProblemCardActions problem={p} hasAnalysis={hasAnalysis} practiceCount={count} />
            </ProblemScratchProvider>
          </div>
        )
      })}
      {problems.length === 0 && (
        <div className="text-text-muted col-span-full py-6 text-center text-[13px]">
          没有符合筛选条件的题目
        </div>
      )}
    </div>
  )
}
