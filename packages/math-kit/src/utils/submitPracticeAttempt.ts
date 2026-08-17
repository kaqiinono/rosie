'use client'

import type { Problem } from '@rosie/core'
import type { ScratchObject } from '@rosie/math-kit/components/shared/ScratchPad/scratch-pad-types'
import { mathWrongStore } from '@rosie/math-kit/hooks/useMathWrong'
import {
  mathPracticeStatsStore,
  patchMathPracticeStats,
} from '@rosie/math-kit/hooks/useMathPracticeStats'
import { invalidateSessionStore, supabase } from '@rosie/core'
import { lessonIdFromProblemId } from '@rosie/math-kit/constants'

export type PracticeAttemptResult = 'correct' | 'wrong' | 'dont_know'

export type SubmitPracticeAttemptInput = {
  userId: string
  problem: Problem
  section: string
  result: PracticeAttemptResult
  objects: ScratchObject[]
  answerSnapshot: unknown | null
  paperId?: string | null
  /** When caller already has the in-progress id */
  attemptId?: string | null
}

export type SubmitPracticeAttemptResult = {
  attemptId: string
  draftId: string | null
}

type SubmitRpcResult = {
  attempt_id?: unknown
  recorded_new?: unknown
}

const pendingSubmissions = new Map<string, Promise<SubmitPracticeAttemptResult>>()

async function submitPracticeAttemptOnce(
  input: SubmitPracticeAttemptInput,
): Promise<SubmitPracticeAttemptResult> {
  const { userId, problem, section, result, objects, paperId = null } = input
  const correct = result === 'correct'
  const answerSnapshot = result === 'dont_know'
    ? { reason: 'dont_know', answer: input.answerSnapshot }
    : input.answerSnapshot
  const { data, error } = await supabase.rpc('submit_math_practice_attempt', {
    p_user_id: userId,
    p_problem_id: problem.id,
    p_lesson_id: lessonIdFromProblemId(problem.id),
    p_section: section,
    p_result: result,
    p_objects: objects,
    p_answer_snapshot: answerSnapshot,
    p_paper_id: paperId,
    p_attempt_id: input.attemptId ?? null,
  })
  const rpcResult = data as SubmitRpcResult | null
  if (error || typeof rpcResult?.attempt_id !== 'string') {
    throw error ?? new Error('practice attempt submission returned no id')
  }
  const attemptId = rpcResult.attempt_id
  const recordedNew = rpcResult.recorded_new !== false

  invalidateSessionStore('math_practice_attempts_today')
  if (recordedNew) patchMathPracticeStats(userId, problem.id, correct)
  else void mathPracticeStatsStore.refreshInBackground(userId)

  const now = new Date().toISOString()
  if (!correct) {
    mathWrongStore.patchSessionData(userId, (prev) => {
      if (prev.some((r) => r.problemId === problem.id && !r.resolved)) return prev
      const without = prev.filter((r) => r.problemId !== problem.id)
      return [
        ...without,
        { problemId: problem.id, addedAt: now, resolved: false, resolvedAt: null },
      ]
    })
  } else {
    mathWrongStore.patchSessionData(userId, (prev) => {
      const hit = prev.some((r) => r.problemId === problem.id)
      if (!hit) return prev
      return prev.map((r) =>
        r.problemId === problem.id ? { ...r, resolved: true, resolvedAt: now } : r,
      )
    })
  }

  return { attemptId, draftId: null }
}

export function submitPracticeAttempt(
  input: SubmitPracticeAttemptInput,
): Promise<SubmitPracticeAttemptResult> {
  const key = `${input.userId}:${input.paperId ?? 'practice'}:${input.problem.id}`
  const pending = pendingSubmissions.get(key)
  if (pending) return pending

  const submission = submitPracticeAttemptOnce(input).finally(() => {
    if (pendingSubmissions.get(key) === submission) pendingSubmissions.delete(key)
  })
  pendingSubmissions.set(key, submission)
  return submission
}
