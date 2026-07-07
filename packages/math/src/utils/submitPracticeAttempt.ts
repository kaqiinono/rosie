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
  } else {
    const now = new Date().toISOString()
    await supabase
      .from('math_wrong')
      .update({ resolved: true, resolved_at: now })
      .eq('user_id', userId)
      .eq('problem_id', problem.id)
  }

  if (paperId && draftId) {
    await upsertQuizScratchLink(userId, paperId, problem.id, draftId)
  }

  await clearScratchWorking(userId, problem.id, paperId)

  return { attemptId, draftId }
}
