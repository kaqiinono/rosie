'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { Problem } from '@rosie/core'
import { getMasteryLevel, MASTERY_BORDER, MASTERY_BADGE_BG, MASTERY_ICON } from '@rosie/core'
import DifficultyStars from '@rosie/math/components/shared/DifficultyStars'
import ExpandedProblemCard, { type ProblemDetailInlineComponent } from '@rosie/math/components/shared/ExpandedProblemCard'
import FavoriteHeart from '@rosie/math/components/shared/FavoriteHeart'
import PracticeCountBadge from '@rosie/math/components/shared/PracticeCountBadge'
import AnalysisGuideBadge from '@rosie/math/components/shared/AnalysisGuideBadge'
import { useLessonAnalysisImageIds } from '@rosie/math/hooks/useLessonAnalysisImageIds'
import { problemHasAnalysisImage } from '@rosie/math/utils/problem-analysis-image'

type Props = {
  problems: Problem[]
  solveCount: Record<string, number>
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
  solveCount,
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

  const cardClass = (level: ReturnType<typeof getMasteryLevel>) =>
    `group relative flex w-full gap-2.5 rounded-[10px] border-[1.5px] bg-white p-3 pr-9 text-left shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] ${MASTERY_BORDER[level]} hover:border-border-light ${onPractice ? 'cursor-pointer active:scale-[0.99]' : 'no-underline'}`

  if (showExpanded && ProblemDetail) {
    return (
      <div className="flex flex-col gap-2">
        {problems.map((p, i) => (
          <ExpandedProblemCard
            key={p.id}
            problem={p}
            index={i}
            solveCount={solveCount}
            tagStyles={tagStyles}
            isOpen={!collapsedIds.has(p.id)}
            onToggle={() => toggleCard(p.id)}
            ProblemDetail={ProblemDetail}
            defaultSolutionOpen={autoExpandSolution}
            sourceLabel={showSource ? sourceLabel : undefined}
            sourceBadgeClass={showSource ? 'bg-purple-100 text-purple-700' : undefined}
          />
        ))}
        {problems.length === 0 && (
          <div className="py-6 text-center text-[13px] text-text-muted">
            没有符合筛选条件的题目
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {problems.map((p, i) => {
        const count = solveCount[p.id] ?? 0
        const level = getMasteryLevel(count)
        const hasAnalysis = problemHasAnalysisImage(p, dbAnalysisIds)

        const inner = (
          <>
            <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5">
              <div
                className={`flex h-[30px] w-[30px] items-center justify-center rounded-full text-xs font-bold ${MASTERY_BADGE_BG[level]}`}
              >
                {i + 1}
              </div>
              <span className={`text-sm leading-none ${level === 0 ? 'text-text-muted' : ''}`}>
                {MASTERY_ICON[level]}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1">
                <div className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-snug text-text-primary">
                  {p.title}
                </div>
                {hasAnalysis && <AnalysisGuideBadge hasImage compact className="opacity-70" />}
              </div>

              <div className="mt-1.5 flex min-w-0 items-center gap-1.5 overflow-hidden text-[10px]">
                <span
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    router.push(`${alltestBase}/alltest?type=${p.tag}`)
                  }}
                  className={`inline-flex max-w-[42%] shrink-0 cursor-pointer items-center truncate rounded-md px-1.5 py-0.5 font-semibold ${tagStyles[p.tag] || 'bg-gray-100 text-gray-600'}`}
                  title={`查看所有${p.tagLabel}题目`}
                >
                  {p.tagLabel}
                </span>
                <MetaDot />
                <DifficultyStars level={p.difficulty} compact />
                <MetaDot />
                <PracticeCountBadge count={count} compact />
                {showSource && sourceLabel && (
                  <>
                    <MetaDot />
                    <span className="shrink-0 truncate font-medium text-[#7e22ce]">{sourceLabel}</span>
                  </>
                )}
              </div>
            </div>

            <div className="absolute top-2.5 right-2.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <FavoriteHeart problemId={p.id} size="sm" />
            </div>
          </>
        )

        if (onPractice) {
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPractice(p.id)}
              className={cardClass(level)}
            >
              {inner}
            </button>
          )
        }

        return (
          <Link key={p.id} href={`${basePath}/${i + 1}`} className={cardClass(level)}>
            {inner}
          </Link>
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
