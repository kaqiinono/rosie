'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { AnswerCheckResult, Problem } from '@rosie/core'
import { useAuth } from '@rosie/core'
import {
  checkProblemAnswer,
  isEmptyAnswerInput,
  type CheckProblemAnswerOptions,
} from '@rosie/math-kit/utils/check-problem-answer'
import { useProblemScratchContext } from '@rosie/math-kit/components/shared/ScratchPad/ProblemScratchContext'
import { findInProgressAttempt } from '@rosie/math-kit/utils/math-scratch-db'
import { submitPracticeAttempt } from '@rosie/math-kit/utils/submitPracticeAttempt'
import { useProblemWorkspaceRuntime } from '@rosie/math-kit/components/shared/ProblemWorkspaceRuntime'

export interface ProblemAnswerContext {
  handleSolve: (id: string) => void
  addWrong: (id: string) => void
}

export function useProblemAnswer(
  problem: Problem,
  ctx: ProblemAnswerContext,
  options?: CheckProblemAnswerOptions,
) {
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<AnswerCheckResult | null>(null)
  /** Sticks after first real check/submit so 查看题解 stays available while editing. */
  const [hasAttempted, setHasAttempted] = useState(false)
  const { user } = useAuth()
  const scratchCtx = useProblemScratchContext()
  const runtime = useProblemWorkspaceRuntime()
  /** The settle below is async; without this a double-tap files two attempts. */
  const submittingRef = useRef(false)

  useEffect(() => {
    setAnswer('')
    setFeedback(null)
    setHasAttempted(false)
    submittingRef.current = false
  }, [problem.id])

  const persistAttempt = useCallback(
    async (correct: boolean, answerSnapshot: unknown) => {
      if (!user) return
      const inProgress = await findInProgressAttempt(user.id, problem.id, null)
      await submitPracticeAttempt({
        userId: user.id,
        problem,
        section: scratchCtx?.section ?? 'lesson',
        result: correct ? 'correct' : 'wrong',
        objects: inProgress?.objects ?? [],
        answerSnapshot,
        paperId: null,
        attemptId: inProgress?.id ?? null,
      })
    },
    [user, scratchCtx, problem],
  )

  const submit = useCallback(
    (input: unknown) => {
      if (!problem.checkAnswer && isEmptyAnswerInput(input)) {
        return { ok: false, message: '' } satisfies AnswerCheckResult
      }

      const result = checkProblemAnswer(problem, input, options)
      if (!result.message && !result.ok) {
        return result
      }

      setHasAttempted(true)
      if (submittingRef.current) return result
      submittingRef.current = true

      void (async () => {
        try {
          await persistAttempt(result.ok, input)
        } catch {
          setFeedback({ ok: false, message: '记录失败，请稍后重试' })
          setHasAttempted(false)
          submittingRef.current = false
          return
        }

        try {
          setFeedback(result)
          if (result.ok) {
            await ctx.handleSolve(problem.id)
            options?.onCorrect?.(result)
          }
          if (runtime) {
            if (result.ok) await runtime.onCorrect(input, result)
            else await runtime.onWrong(input, result)
          }
        } catch {
          // The attempt is already committed; never present this as a record failure.
          setFeedback(result)
        }
        // A correct answer advances the queue; the problem.id effect re-arms it there.
        if (!result.ok) submittingRef.current = false
      })()

      return result
    },
    [problem, ctx, options, persistAttempt, runtime],
  )

  const clearFeedback = useCallback(() => {
    setFeedback(null)
  }, [])

  const check = useCallback(() => submit(answer), [submit, answer])

  return { answer, setAnswer, feedback, submit, check, clearFeedback, hasAttempted }
}
