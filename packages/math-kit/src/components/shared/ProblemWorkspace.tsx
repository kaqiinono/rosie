'use client'

import { useCallback, useState } from 'react'
import type { Problem } from '@rosie/core'
import { useAuth } from '@rosie/core'
import QuestionLayout, {
  type QuestionLayoutProps,
} from '@rosie/math-kit/components/shared/QuestionLayout'
import { useProblemScratchContext } from '@rosie/math-kit/components/shared/ScratchPad/ProblemScratchContext'
import { findInProgressAttempt } from '@rosie/math-kit/utils/math-scratch-db'
import { submitPracticeAttempt } from '@rosie/math-kit/utils/submitPracticeAttempt'
import { useProblemWorkspaceRuntime } from '@rosie/math-kit/components/shared/ProblemWorkspaceRuntime'

type Props = Omit<
  QuestionLayoutProps,
  'problem' | 'problemId' | 'solutionAvailable' | 'defaultSolutionOpen' | 'answerActions'
> & {
  problem: Problem
  hasAttempted: boolean
  defaultSolutionOpen?: boolean
  onDontKnow?: () => void | Promise<void>
  dontKnowUsed?: boolean
  dontKnowFollowup?: React.ReactNode
}

/**
 * Shared single-problem workspace used by routed details and queue practice.
 * Navigation/progress stays in the outer shell; attempt tools stay identical here.
 */
export default function ProblemWorkspace({
  problem,
  hasAttempted,
  defaultSolutionOpen = false,
  onDontKnow,
  dontKnowUsed = false,
  dontKnowFollowup,
  ...layoutProps
}: Props) {
  const { user } = useAuth()
  const scratchCtx = useProblemScratchContext()
  const runtime = useProblemWorkspaceRuntime()
  const [localDontKnow, setLocalDontKnow] = useState(false)
  const [settling, setSettling] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const usedDontKnow = dontKnowUsed || runtime?.dontKnowUsed || localDontKnow
  const attempted = hasAttempted || usedDontKnow
  const attemptToolsEnabled = Boolean(scratchCtx?.section)

  const showFlash = useCallback((message: string) => {
    setFlash(message)
    window.setTimeout(() => setFlash(null), 2200)
  }, [])

  const handleDefaultDontKnow = useCallback(async () => {
    if (!user || !scratchCtx?.section) return
    const inProgress = await findInProgressAttempt(user.id, problem.id, null)
    await submitPracticeAttempt({
      userId: user.id,
      problem,
      section: scratchCtx.section,
      result: 'dont_know',
      objects: inProgress?.objects ?? [],
      answerSnapshot: null,
      paperId: null,
      attemptId: inProgress?.id ?? null,
    })
  }, [user, scratchCtx, problem])

  const handleDontKnow = useCallback(async () => {
    if (settling || attempted) return
    setSettling(true)
    try {
      await handleDefaultDontKnow()
      if (onDontKnow) await onDontKnow()
      else if (runtime) await runtime.onDontKnow()
      setLocalDontKnow(true)
      showFlash('已加入错题集，看看题解吧')
    } catch {
      showFlash('记录失败，请稍后重试')
    } finally {
      setSettling(false)
    }
  }, [settling, attempted, onDontKnow, runtime, handleDefaultDontKnow, showFlash])

  const answerActions = attemptToolsEnabled ? (
    <>
      {!attempted ? (
        <button
          type="button"
          disabled={settling}
          onClick={() => void handleDontKnow()}
          className="cursor-pointer rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-[13px] font-semibold text-rose-600 transition-all hover:bg-rose-100 active:scale-[0.96] disabled:cursor-wait disabled:opacity-60"
        >
          {settling ? '记录中…' : '不会'}
        </button>
      ) : usedDontKnow
        ? (dontKnowFollowup ?? runtime?.dontKnowFollowup)
        : (runtime?.correctFollowup ?? null)}
    </>
  ) : null

  return (
    <>
      <QuestionLayout
        {...layoutProps}
        problemId={problem.id}
        problem={problem}
        solutionAvailable={attempted}
        showSolutionToggle={runtime?.showSolutionToggle ?? layoutProps.showSolutionToggle}
        defaultSolutionOpen={
          defaultSolutionOpen || Boolean(runtime?.defaultSolutionOpen) || usedDontKnow
        }
        answerActions={answerActions}
      />
      {flash && (
        <div className="pointer-events-none fixed top-16 left-1/2 z-[130] -translate-x-1/2 rounded-full bg-amber-800 px-4 py-2 text-[13px] font-semibold text-white shadow-lg">
          {flash}
        </div>
      )}
    </>
  )
}
