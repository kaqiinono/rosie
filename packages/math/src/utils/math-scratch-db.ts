'use client'

import { supabase } from '@rosie/core'
import { lessonIdFromProblemId } from '@rosie/math/constants'
import type { ScratchObject } from '@rosie/math/components/shared/ScratchPad/scratch-pad-types'
import type {
  MathPracticeAttemptRow,
  MathScratchDraftRow,
  MathScratchWorkingRow,
} from '@rosie/math/hooks/math-scratch-types'

function parseObjects(raw: unknown): ScratchObject[] {
  if (!Array.isArray(raw)) return []
  return raw as ScratchObject[]
}

type WorkingDbRow = {
  user_id: string
  problem_id: string
  paper_scope: string
  objects: unknown
  answer_draft: unknown | null
  updated_at: string
}

/** '' = practice working shared across lesson entry points */
export function toPaperScope(paperId: string | null | undefined): string {
  return paperId ?? ''
}

type DraftDbRow = {
  id: string
  user_id: string
  problem_id: string
  lesson_id: string
  section: string
  objects: unknown
  object_count: number
  submitted_at: string
}

type AttemptDbRow = {
  id: string
  user_id: string
  problem_id: string
  lesson_id: string
  section: string
  paper_id: string | null
  correct: boolean
  draft_id: string | null
  answer_snapshot: unknown | null
  attempted_at: string
}

function rowToWorking(r: WorkingDbRow): MathScratchWorkingRow {
  return {
    userId: r.user_id,
    problemId: r.problem_id,
    paperScope: r.paper_scope,
    objects: parseObjects(r.objects),
    answerDraft: r.answer_draft,
    updatedAt: r.updated_at,
  }
}

function rowToDraft(r: DraftDbRow): MathScratchDraftRow {
  return {
    id: r.id,
    userId: r.user_id,
    problemId: r.problem_id,
    lessonId: r.lesson_id,
    section: r.section,
    objects: parseObjects(r.objects),
    objectCount: r.object_count,
    submittedAt: r.submitted_at,
  }
}

function rowToAttempt(r: AttemptDbRow): MathPracticeAttemptRow {
  return {
    id: r.id,
    userId: r.user_id,
    problemId: r.problem_id,
    lessonId: r.lesson_id,
    section: r.section,
    paperId: r.paper_id,
    correct: r.correct,
    draftId: r.draft_id,
    answerSnapshot: r.answer_snapshot,
    attemptedAt: r.attempted_at,
  }
}

export function countScratchObjects(objects: ScratchObject[]): number {
  return objects.length
}

export async function fetchScratchWorking(
  userId: string,
  problemId: string,
  paperId: string | null,
): Promise<MathScratchWorkingRow | null> {
  const paperScope = toPaperScope(paperId)
  const { data, error } = await supabase
    .from('math_scratch_working')
    .select('user_id, problem_id, paper_scope, objects, answer_draft, updated_at')
    .eq('user_id', userId)
    .eq('problem_id', problemId)
    .eq('paper_scope', paperScope)
    .maybeSingle()
  if (error || !data) return null
  return rowToWorking(data as WorkingDbRow)
}

export async function upsertScratchWorking(
  userId: string,
  problemId: string,
  paperId: string | null,
  objects: ScratchObject[],
  answerDraft: unknown | null,
): Promise<void> {
  const row: Record<string, unknown> = {
    user_id: userId,
    problem_id: problemId,
    paper_scope: toPaperScope(paperId),
    objects,
    answer_draft: answerDraft,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('math_scratch_working').upsert(row, {
    onConflict: 'user_id,problem_id,paper_scope',
  })
  if (error) throw error
}

export async function clearScratchWorking(
  userId: string,
  problemId: string,
  paperId: string | null,
): Promise<void> {
  await supabase
    .from('math_scratch_working')
    .delete()
    .eq('user_id', userId)
    .eq('problem_id', problemId)
    .eq('paper_scope', toPaperScope(paperId))
}

export async function clearAllScratchWorkingForPaper(
  userId: string,
  paperId: string,
): Promise<void> {
  await supabase
    .from('math_scratch_working')
    .delete()
    .eq('user_id', userId)
    .eq('paper_scope', paperId)
}

export async function insertScratchDraft(
  userId: string,
  problemId: string,
  section: string,
  objects: ScratchObject[],
): Promise<string | null> {
  if (objects.length === 0) return null
  const lessonId = lessonIdFromProblemId(problemId)
  const { data, error } = await supabase
    .from('math_scratch_drafts')
    .insert({
      user_id: userId,
      problem_id: problemId,
      lesson_id: lessonId,
      section,
      objects,
      object_count: countScratchObjects(objects),
    })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('draft insert failed')
  return data.id as string
}

export async function fetchScratchDraft(draftId: string): Promise<MathScratchDraftRow | null> {
  const { data, error } = await supabase
    .from('math_scratch_drafts')
    .select('*')
    .eq('id', draftId)
    .maybeSingle()
  if (error || !data) return null
  return rowToDraft(data as DraftDbRow)
}

export async function fetchPracticeAttemptsForProblem(
  userId: string,
  problemId: string,
): Promise<MathPracticeAttemptRow[]> {
  const { data, error } = await supabase
    .from('math_practice_attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('problem_id', problemId)
    .order('attempted_at', { ascending: false })
  if (error || !data) return []
  return (data as AttemptDbRow[]).map(rowToAttempt)
}

/** Lesson-wide draft history: attempts with archived drafts, newest first. */
export async function fetchLessonDraftAttempts(
  userId: string,
  lessonId: string,
): Promise<MathPracticeAttemptRow[]> {
  const { data, error } = await supabase
    .from('math_practice_attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .not('draft_id', 'is', null)
    .order('attempted_at', { ascending: false })
  if (error || !data) return []
  return (data as AttemptDbRow[]).map(rowToAttempt)
}

export async function fetchPracticeAttempt(
  attemptId: string,
): Promise<MathPracticeAttemptRow | null> {
  const { data, error } = await supabase
    .from('math_practice_attempts')
    .select('*')
    .eq('id', attemptId)
    .maybeSingle()
  if (error || !data) return null
  return rowToAttempt(data as AttemptDbRow)
}

export async function insertPracticeAttempt(
  userId: string,
  problemId: string,
  section: string,
  correct: boolean,
  draftId: string | null,
  answerSnapshot: unknown | null,
  paperId: string | null,
): Promise<string> {
  const lessonId = lessonIdFromProblemId(problemId)
  const { data, error } = await supabase
    .from('math_practice_attempts')
    .insert({
      user_id: userId,
      problem_id: problemId,
      lesson_id: lessonId,
      section,
      correct,
      draft_id: draftId,
      answer_snapshot: answerSnapshot,
      paper_id: paperId,
    })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('attempt insert failed')
  return data.id as string
}

export async function upsertQuizScratchLink(
  userId: string,
  paperId: string,
  problemId: string,
  draftId: string,
): Promise<void> {
  const { error } = await supabase.from('math_quiz_scratch_links').upsert(
    {
      user_id: userId,
      paper_id: paperId,
      problem_id: problemId,
      draft_id: draftId,
    },
    { onConflict: 'paper_id,problem_id' },
  )
  if (error) throw error
}

export async function fetchQuizScratchDraftId(
  paperId: string,
  problemId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('math_quiz_scratch_links')
    .select('draft_id')
    .eq('paper_id', paperId)
    .eq('problem_id', problemId)
    .maybeSingle()
  if (error || !data) return null
  return data.draft_id as string
}

export async function upsertWrongWithAttempt(
  userId: string,
  problemId: string,
  attemptId: string,
): Promise<void> {
  const { error } = await supabase.from('math_wrong').upsert(
    {
      user_id: userId,
      problem_id: problemId,
      resolved: false,
      resolved_at: null,
      last_wrong_attempt_id: attemptId,
    },
    { onConflict: 'user_id,problem_id' },
  )
  if (error) throw error
}

export async function fetchAllScratchWorkingForPaper(
  userId: string,
  paperId: string,
): Promise<Map<string, MathScratchWorkingRow>> {
  const { data, error } = await supabase
    .from('math_scratch_working')
    .select('user_id, problem_id, paper_scope, objects, answer_draft, updated_at')
    .eq('user_id', userId)
    .eq('paper_scope', paperId)
  const map = new Map<string, MathScratchWorkingRow>()
  if (error || !data) return map
  for (const row of data as WorkingDbRow[]) {
    const w = rowToWorking(row)
    map.set(w.problemId, w)
  }
  return map
}

export async function fetchQuizScratchObjectsMap(
  paperId: string,
): Promise<Map<string, ScratchObject[]>> {
  const { data: links, error } = await supabase
    .from('math_quiz_scratch_links')
    .select('problem_id, draft_id')
    .eq('paper_id', paperId)
  const map = new Map<string, ScratchObject[]>()
  if (error || !links) return map
  for (const link of links as { problem_id: string; draft_id: string }[]) {
    const draft = await fetchScratchDraft(link.draft_id)
    if (draft?.objects.length) map.set(link.problem_id, draft.objects)
  }
  return map
}

export async function fetchWrongAttemptId(
  userId: string,
  problemId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('math_wrong')
    .select('last_wrong_attempt_id')
    .eq('user_id', userId)
    .eq('problem_id', problemId)
    .eq('resolved', false)
    .maybeSingle()
  if (error || !data) return null
  return (data.last_wrong_attempt_id as string | null) ?? null
}

/** Seed practice working from the wrong attempt's draft (mistake retry). */
export async function seedWorkingFromWrongAttempt(
  userId: string,
  problemId: string,
  attemptId: string,
): Promise<{ hasScratch: boolean; answerDraft: unknown | null }> {
  const attempt = await fetchPracticeAttempt(attemptId)
  if (!attempt?.draftId) {
    await clearScratchWorking(userId, problemId, null)
    return { hasScratch: false, answerDraft: attempt?.answerSnapshot ?? null }
  }
  const draft = await fetchScratchDraft(attempt.draftId)
  if (!draft) {
    return { hasScratch: false, answerDraft: attempt.answerSnapshot }
  }
  await upsertScratchWorking(
    userId,
    problemId,
    null,
    draft.objects,
    attempt.answerSnapshot,
  )
  return { hasScratch: true, answerDraft: attempt.answerSnapshot }
}
