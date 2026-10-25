'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { Problem } from '@rosie/core'
import AnalysisGuideBadge from './AnalysisGuideBadge'
import AnalysisGuideBadgeForProblem from './AnalysisGuideBadgeForProblem'
import FavoriteHeart from './FavoriteHeart'
import ProblemDraftActions from './ProblemDraftActions'
import ProblemVideoReplay from './ProblemVideoReplay'
import ProblemActionIcon, { PROBLEM_ACTION_BUTTON_CLASS } from './ProblemActionIcon'
import { problemPracticeStyle } from '../../utils/problem-practice-style'

const ExternalActionsContext = createContext(false)

/** An expanded card owns its footer, including actions for its inline detail. */
export function ExternalProblemActions({ children }: { children: ReactNode }) {
  return <ExternalActionsContext.Provider value>{children}</ExternalActionsContext.Provider>
}

export function useExternalProblemActions(): boolean {
  return useContext(ExternalActionsContext)
}

type Props = {
  problem: Problem
  hasAnalysis?: boolean
  isOpen?: boolean
  onToggle?: () => void
  /** Omit when the current surface does not have practice history; never infer it from mastery. */
  practiceCount?: number
}

export default function ProblemCardActions({ problem, hasAnalysis, isOpen, onToggle, practiceCount }: Props) {
  const surface = practiceCount === undefined ? 'bg-slate-50/70' : problemPracticeStyle(practiceCount).surface
  return (
    <div className={`relative mt-auto grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-b-xl border-t border-slate-100 px-2.5 py-1 ${surface}`} role="group" aria-label="题目操作">
      <div className="relative flex min-w-0 flex-wrap items-center gap-0.5">
        {hasAnalysis === undefined
          ? <AnalysisGuideBadgeForProblem problem={problem} variant="toolbar" />
          : <AnalysisGuideBadge hasImage={hasAnalysis} variant="toolbar" />}
        <ProblemDraftActions problem={problem} variant="toolbar" />
        <FavoriteHeart problemId={problem.id} variant="toolbar" />
        {onToggle && (
          <button
            type="button" onClick={onToggle}
            aria-label={isOpen ? '收起题解' : '展开题解'} aria-expanded={isOpen}
            title={isOpen ? '收起题解' : '展开题解'}
            className={`${PROBLEM_ACTION_BUTTON_CLASS} text-text-secondary`}
          >
            <ProblemActionIcon name="chevron" className={`transition-transform motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      <div className="relative justify-self-end"><ProblemVideoReplay problem={problem} /></div>
    </div>
  )
}
