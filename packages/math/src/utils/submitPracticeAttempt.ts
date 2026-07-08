'use client'

import type { Problem } from '@rosie/core'
import type { ScratchObject } from '@rosie/math/components/shared/ScratchPad/scratch-pad-types'
import {
  clearScratchWorking,
  insertPracticeAttempt,
  insertScratchDraft,
  upsertQuizScratchLink,
  upsertWrongWithAttempt,
} from '@rosie/math/utils/math-scratch-db'
import { mathWrongStore } from '@rosie/math/hooks/useMathWrong'
import { supabase } from '@rosie/core'

export type SubmitPracticeAttemptInput = {
  userId: string
  problem: Problem
  section: string
  correct: boolean
  objects: ScratchObject[]
  answerSnapshot: unknown | null
  paperId?: string | null
}

export type SubmitPracticeAttemptResult = {
  attemptId: string
  draftId: string | null
}

export async function submitPracticeAttempt(
  input: SubmitPracticeAttemptInput,
): Promise<SubmitPracticeAttemptResult> {
  const { userId, problem, section, correct, objects, answerSnapshot, paperId = null } = input

  const draftId = await insertScratchDraft(userId, problem.id, section, objects)

  const attemptId = await insertPracticeAttempt(
    userId,
    problem.id,
    section,
    correct,
    draftId,
    answerSnapshot,
    paperId,
  )

  if (!correct) {
    await upsertWrongWithAttempt(userId, problem.id, attemptId)
    const now = new Date().toISOString()
    mathWrongStore.patchSessionData(userId, (prev) => {
      if (prev.some((r) => r.problemId === problem.id && !r.resolved)) return prev
      const without = prev.filter((r) => r.problemId !== problem.id)
      return [
        ...without,
        { problemId: problem.id, addedAt: now, resolved: false, resolvedAt: null },
      ]
    })
  } else {
    const now = new Date().toISOString()
    mathWrongStore.patchSessionData(userId, (prev) => {
      const hit = prev.some((r) => r.problemId === problem.id)
      if (!hit) return prev
      return prev.map((r) =>
        r.problemId === problem.id ? { ...r, resolved: true, resolvedAt: now } : r,
      )
    })
    await supabase
      .from('math_wrong')
      .update({ resolved: true, resolved_at: now })
      .eq('user_id', userId)
      .eq('problem_id', problem.id)
  }

  if (paperId && draftId) {
    await upsertQuizScratchLink(userId, paperId, problem.id, draftId)
  }

  if (correct) {
    await clearScratchWorking(userId, problem.id, paperId)
  }

  return { attemptId, draftId }
}
