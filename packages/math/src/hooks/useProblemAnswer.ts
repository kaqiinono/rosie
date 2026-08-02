'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AnswerCheckResult, Problem } from '@rosie/core'
import { useAuth } from '@rosie/core'
import {
  checkProblemAnswer,
  isEmptyAnswerInput,
  type CheckProblemAnswerOptions,
} from '@rosie/math/utils/check-problem-answer'
import { useProblemScratchContext } from '@rosie/math/components/shared/ScratchPad/ProblemScratchContext'
import { fetchScratchWorking } from '@rosie/math/utils/math-scratch-db'
import { submitPracticeAttempt } from '@rosie/math/utils/submitPracticeAttempt'

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnswer('')
    setFeedback(null)
    setHasAttempted(false)
  }, [problem.id])

  const archiveWorkingScratch = useCallback(
    async (correct: boolean, answerSnapshot: unknown) => {
      if (!user || !scratchCtx?.section) return
      const row = await fetchScratchWorking(user.id, problem.id, null)
      if (!row?.objects?.length) return
      await submitPracticeAttempt({
        userId: user.id,
        problem,
        section: scratchCtx.section,
        correct,
        objects: row.objects,
        answerSnapshot,
        paperId: null,
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

      void (async () => {
        await archiveWorkingScratch(result.ok, input)
        setFeedback(result)
        if (result.ok) {
          await ctx.handleSolve(problem.id)
          options?.onCorrect?.(result)
        } else {
          ctx.addWrong(problem.id)
        }
      })()

      return result
    },
    [problem, ctx, options, archiveWorkingScratch],
  )

  const clearFeedback = useCallback(() => {
    setFeedback(null)
  }, [])

  const check = useCallback(() => submit(answer), [submit, answer])

  return { answer, setAnswer, feedback, submit, check, clearFeedback, hasAttempted }
}
