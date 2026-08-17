'use client'

import { createContext, useContext } from 'react'
import type { AnswerCheckResult } from '@rosie/core'

export type ProblemWorkspaceRuntimeValue = {
  onCorrect: (answerSnapshot: unknown, result: AnswerCheckResult) => void | Promise<void>
  onWrong: (answerSnapshot: unknown, result: AnswerCheckResult) => void | Promise<void>
  onDontKnow: () => void | Promise<void>
  dontKnowUsed: boolean
  dontKnowFollowup?: React.ReactNode
  /** Replaces answer actions after a correct result so the learner can review first. */
  correctFollowup?: React.ReactNode
  defaultSolutionOpen?: boolean
  showSolutionToggle?: boolean
  onPaperArchived?: (correct: boolean) => void | Promise<void>
  /** Switches an enclosing practice session to its embedded scratch page. */
  onOpenScratch?: () => void
}

const ProblemWorkspaceRuntimeContext = createContext<ProblemWorkspaceRuntimeValue | null>(null)

export function ProblemWorkspaceRuntimeProvider({
  value,
  children,
}: {
  value: ProblemWorkspaceRuntimeValue
  children: React.ReactNode
}) {
  return (
    <ProblemWorkspaceRuntimeContext.Provider value={value}>
      {children}
    </ProblemWorkspaceRuntimeContext.Provider>
  )
}

export function useProblemWorkspaceRuntime(): ProblemWorkspaceRuntimeValue | null {
  return useContext(ProblemWorkspaceRuntimeContext)
}
