'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AnswerCheckResult, Problem } from '@rosie/core'
import {
  checkProblemAnswer,
  isEmptyAnswerInput,
  type CheckProblemAnswerOptions,
} from '@rosie/math/utils/check-problem-answer'

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnswer('')
    setFeedback(null)
  }, [problem.id])

  const submit = useCallback(
    (input: unknown) => {
      if (!problem.checkAnswer && isEmptyAnswerInput(input)) {
        return { ok: false, message: '' } satisfies AnswerCheckResult
      }

      const result = checkProblemAnswer(problem, input, options)
      if (!result.message && !result.ok) {
        return result
      }

      setFeedback(result)
      if (result.ok) {
        ctx.handleSolve(problem.id)
        options?.onCorrect?.(result)
      } else {
        ctx.addWrong(problem.id)
      }
      return result
    },
    [problem, ctx, options],
  )

  const clearFeedback = useCallback(() => {
    setFeedback(null)
  }, [])

  const check = useCallback(() => submit(answer), [submit, answer])

  return { answer, setAnswer, feedback, submit, check, clearFeedback }
}
