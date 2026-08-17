'use client'

import { invalidateSessionStore, supabase } from '@rosie/core'
import { lessonIdFromProblemId } from '@rosie/math-kit/constants'
import type { ScratchObject } from '@rosie/math-kit/components/shared/ScratchPad/scratch-pad-types'
import type {
  MathPracticeAttemptRow,
  MathScratchDraftRow,
  MathScratchWorkingRow,
  PracticeAttemptStatus,
} from '@rosie/math-kit/hooks/math-scratch-types'
import {
  attemptRowHasViewableCanvas,
  resolveAttemptCanvasObjects,
} from '@rosie/math-kit/utils/math-practice-attempt'

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
  status?: string | null
  correct: boolean | null
  draft_id: string | null
  objects?: unknown
  answer_snapshot: unknown | null
  attempted_at: string
  record_origin?: string | null
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
  const status: PracticeAttemptStatus =
    r.status === 'in_progress' ? 'in_progress' : 'completed'
  return {
    id: r.id,
    userId: r.user_id,
    problemId: r.problem_id,
    lessonId: r.lesson_id,
    section: r.section,
    paperId: r.paper_id,
    status,
    correct: r.correct,
    draftId: r.draft_id,
    objects: parseObjects(r.objects),
    answerSnapshot: r.answer_snapshot,
    attemptedAt: r.attempted_at,
    recordOrigin: r.record_origin === 'math_solved_backfill' ? 'math_solved_backfill' : 'native',
  }
}

export function countScratchObjects(objects: ScratchObject[]): number {
  return objects.length
}

/** @deprecated Admin/migration only (MathPdfSliceMatcher). Practice canvas lives on attempts. */
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
    .eq('status', 'completed')
    .order('attempted_at', { ascending: false })
  if (error || !data) return []
  return (data as AttemptDbRow[]).map(rowToAttempt)
}

/** Light list of completed attempts for many problems (newest first). */
export async function fetchPracticeAttemptsForProblems(
  userId: string,
  problemIds: string[],
): Promise<MathPracticeAttemptRow[]> {
  const unique = [...new Set(problemIds)].filter(Boolean)
  if (unique.length === 0) return []
  const { data, error } = await supabase
    .from('math_practice_attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .is('paper_id', null)
    .in('problem_id', unique)
    .order('attempted_at', { ascending: false })
  if (error || !data) return []
  return (data as AttemptDbRow[]).map(rowToAttempt)
}

/** Lesson-wide draft history: completed attempts with viewable canvas, newest first. */
export async function fetchLessonDraftAttempts(
  userId: string,
  lessonId: string,
): Promise<MathPracticeAttemptRow[]> {
  const { data, error } = await supabase
    .from('math_practice_attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .eq('status', 'completed')
    .order('attempted_at', { ascending: false })
  if (error || !data) return []
  return (data as AttemptDbRow[])
    .map(rowToAttempt)
    .filter((a) => attemptRowHasViewableCanvas(a))
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

export async function findInProgressAttempt(
  userId: string,
  problemId: string,
  paperId: string | null,
): Promise<MathPracticeAttemptRow | null> {
  let q = supabase
    .from('math_practice_attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('problem_id', problemId)
    .eq('status', 'in_progress')
  q = paperId ? q.eq('paper_id', paperId) : q.is('paper_id', null)
  const { data, error } = await q.maybeSingle()
  if (error || !data) return null
  return rowToAttempt(data as AttemptDbRow)
}

export async function ensureInProgressAttempt(
  userId: string,
  problemId: string,
  section: string,
  paperId: string | null,
): Promise<MathPracticeAttemptRow> {
  const existing = await findInProgressAttempt(userId, problemId, paperId)
  if (existing) return existing
  const lessonId = lessonIdFromProblemId(problemId)
  const { data, error } = await supabase
    .from('math_practice_attempts')
    .insert({
      user_id: userId,
      problem_id: problemId,
      lesson_id: lessonId,
      section,
      paper_id: paperId,
      status: 'in_progress',
      correct: null,
      objects: [],
      answer_snapshot: null,
      draft_id: null,
    })
    .select('*')
    .single()
  if (error) {
    // Race: unique partial index on in_progress — another insert won first.
    if (error.code === '23505') {
      const raced = await findInProgressAttempt(userId, problemId, paperId)
      if (raced) return raced
    }
    throw error
  }
  if (!data) throw new Error('ensure in_progress failed')
  invalidateSessionStore('math_practice_attempts_today')
  return rowToAttempt(data as AttemptDbRow)
}

export async function updateAttemptProgress(
  attemptId: string,
  objects: ScratchObject[],
  answerSnapshot: unknown | null,
): Promise<void> {
  const { error } = await supabase
    .from('math_practice_attempts')
    .update({
      objects,
      answer_snapshot: answerSnapshot,
      attempted_at: new Date().toISOString(),
    })
    .eq('id', attemptId)
    .eq('status', 'in_progress')
  if (error) throw error
}

export async function fetchAttemptCanvas(attemptId: string): Promise<ScratchObject[]> {
  const attempt = await fetchPracticeAttempt(attemptId)
  if (!attempt) return []
  let fallbackDraftObjects: ScratchObject[] | null = null
  if (attempt.draftId) {
    const draft = await fetchScratchDraft(attempt.draftId)
    fallbackDraftObjects = draft?.objects ?? null
  }
  return resolveAttemptCanvasObjects(attempt, fallbackDraftObjects)
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

/** Backfill math_wrong rows for wrong attempts that never synced (e.g. prior schema mismatch). */
export async function syncWrongBookFromAttempts(
  userId: string,
  lessonId: string,
): Promise<number> {
  const { data: attempts, error } = await supabase
    .from('math_practice_attempts')
    .select('problem_id')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .eq('correct', false)
  if (error || !attempts?.length) return 0

  const wrongPids = [...new Set(attempts.map((a) => a.problem_id as string))]

  const { data: existing } = await supabase
    .from('math_wrong')
    .select('problem_id')
    .eq('user_id', userId)
    .in('problem_id', wrongPids)

  const existingPids = new Set((existing ?? []).map((r) => r.problem_id as string))
  let added = 0
  for (const pid of wrongPids) {
    if (existingPids.has(pid)) continue
    const { error: upsertErr } = await supabase.from('math_wrong').upsert(
      { user_id: userId, problem_id: pid, resolved: false, resolved_at: null },
      { onConflict: 'user_id,problem_id' },
    )
    if (!upsertErr) added++
  }
  return added
}

export async function fetchAllScratchWorkingForPaper(
  userId: string,
  paperId: string,
): Promise<Map<string, MathScratchWorkingRow>> {
  const map = new Map<string, MathScratchWorkingRow>()

  const { data, error } = await supabase
    .from('math_practice_attempts')
    .select('user_id, problem_id, objects, answer_snapshot, attempted_at')
    .eq('user_id', userId)
    .eq('paper_id', paperId)
    .eq('status', 'in_progress')

  if (!error && data) {
    for (const row of data as {
      user_id: string
      problem_id: string
      objects: unknown
      answer_snapshot: unknown | null
      attempted_at: string
    }[]) {
      map.set(row.problem_id, {
        userId: row.user_id,
        problemId: row.problem_id,
        paperScope: paperId,
        objects: parseObjects(row.objects),
        answerDraft: row.answer_snapshot,
        updatedAt: row.attempted_at,
      })
    }
  }

  // Migration-only: read legacy math_scratch_working until backfill completes (see math-practice-attempts-status-objects.sql)
  const { data: legacy, error: legacyErr } = await supabase
    .from('math_scratch_working')
    .select('user_id, problem_id, paper_scope, objects, answer_draft, updated_at')
    .eq('user_id', userId)
    .eq('paper_scope', paperId)
  if (!legacyErr && legacy) {
    for (const row of legacy as WorkingDbRow[]) {
      if (map.has(row.problem_id)) continue
      map.set(row.problem_id, rowToWorking(row))
    }
  }

  return map
}

export async function fetchQuizScratchObjectsMap(
  paperId: string,
): Promise<Map<string, ScratchObject[]>> {
  const map = new Map<string, ScratchObject[]>()

  const { data: attempts, error } = await supabase
    .from('math_practice_attempts')
    .select('problem_id, objects, draft_id')
    .eq('paper_id', paperId)
    .eq('status', 'completed')
    .order('attempted_at', { ascending: false })

  if (!error && attempts) {
    for (const row of attempts as {
      problem_id: string
      objects: unknown
      draft_id: string | null
    }[]) {
      if (map.has(row.problem_id)) continue
      let objects = parseObjects(row.objects)
      if (objects.length === 0 && row.draft_id) {
        const draft = await fetchScratchDraft(row.draft_id)
        objects = draft?.objects ?? []
      }
      if (objects.length > 0) map.set(row.problem_id, objects)
    }
  }

  const { data: links, error: linkErr } = await supabase
    .from('math_quiz_scratch_links')
    .select('problem_id, draft_id')
    .eq('paper_id', paperId)
  if (!linkErr && links) {
    for (const link of links as { problem_id: string; draft_id: string }[]) {
      if (map.has(link.problem_id) && (map.get(link.problem_id)?.length ?? 0) > 0) continue
      const draft = await fetchScratchDraft(link.draft_id)
      if (draft?.objects.length) map.set(link.problem_id, draft.objects)
    }
  }

  return map
}

export async function fetchWrongAttemptId(
  userId: string,
  problemId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('math_practice_attempts')
    .select('id, objects, draft_id')
    .eq('user_id', userId)
    .eq('problem_id', problemId)
    .eq('status', 'completed')
    .eq('correct', false)
    .order('attempted_at', { ascending: false })
  if (error || !data) return null
  for (const row of data as { id: string; objects: unknown; draft_id: string | null }[]) {
    const objects = parseObjects(row.objects)
    if (objects.length > 0 || row.draft_id) return row.id
  }
  return null
}

/** Problem ids among wrong completed attempts that have viewable canvas. */
export async function fetchWrongDraftProblemIds(
  userId: string,
  problemIds: string[],
): Promise<Set<string>> {
  if (problemIds.length === 0) return new Set()
  const { data, error } = await supabase
    .from('math_practice_attempts')
    .select('problem_id, objects, draft_id')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .eq('correct', false)
    .in('problem_id', problemIds)
  if (error || !data) return new Set()
  const out = new Set<string>()
  for (const row of data as { problem_id: string; objects: unknown; draft_id: string | null }[]) {
    const objects = parseObjects(row.objects)
    if (objects.length > 0 || row.draft_id) out.add(row.problem_id)
  }
  return out
}

export async function resolveWrongAttemptId(
  userId: string,
  ...problemIds: string[]
): Promise<string | null> {
  for (const pid of problemIds) {
    const id = await fetchWrongAttemptId(userId, pid)
    if (id) return id
  }
  return null
}

const viewableDraftInflight = new Map<string, Promise<Set<string>>>()

/**
 * Batch presence check for plan pages — light queries only, never N×full canvas JSON downloads.
 * A problem is "viewable" if it has an in_progress attempt, completed attempt with embedded
 * objects, or a legacy completed attempt whose draft_id points at a non-empty draft.
 */
export async function fetchViewableDraftProblemIds(
  userId: string,
  problemIds: string[],
): Promise<Set<string>> {
  if (problemIds.length === 0) return new Set()
  const unique = [...new Set(problemIds)].sort()
  const cacheKey = `${userId}:${unique.join(',')}`
  const existing = viewableDraftInflight.get(cacheKey)
  if (existing) return existing

  const promise = (async (): Promise<Set<string>> => {
    const out = new Set<string>()

    const [{ data: inProgressRows }, { data: completedWithObjects }, { data: completedWithDraft }] =
      await Promise.all([
        supabase
          .from('math_practice_attempts')
          .select('problem_id')
          .eq('user_id', userId)
          .eq('status', 'in_progress')
          .is('paper_id', null)
          .in('problem_id', unique)
          .not('objects', 'eq', '[]'),
        supabase
          .from('math_practice_attempts')
          .select('problem_id')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .is('paper_id', null)
          .in('problem_id', unique)
          .not('objects', 'eq', '[]'),
        supabase
          .from('math_practice_attempts')
          .select('problem_id, draft_id')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .is('paper_id', null)
          .in('problem_id', unique)
          .not('draft_id', 'is', null),
      ])

    for (const row of inProgressRows ?? []) {
      out.add(row.problem_id as string)
    }
    for (const row of completedWithObjects ?? []) {
      out.add(row.problem_id as string)
    }

    const draftIds = [
      ...new Set(
        (completedWithDraft ?? [])
          .map((r) => r.draft_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ]
    if (draftIds.length > 0) {
      const { data: drafts } = await supabase
        .from('math_scratch_drafts')
        .select('id, object_count')
        .in('id', draftIds)
        .gt('object_count', 0)

      const goodDrafts = new Set((drafts ?? []).map((d) => d.id as string))
      for (const row of completedWithDraft ?? []) {
        const draftId = row.draft_id as string | null
        if (draftId && goodDrafts.has(draftId)) {
          out.add(row.problem_id as string)
        }
      }
    }
    return out
  })().finally(() => {
    viewableDraftInflight.delete(cacheKey)
  })

  viewableDraftInflight.set(cacheKey, promise)
  return promise
}

export async function problemHasViewableDraft(
  userId: string,
  problemId: string,
): Promise<boolean> {
  const ids = await fetchViewableDraftProblemIds(userId, [problemId])
  return ids.has(problemId)
}

/** Latest attempt id with viewable canvas (in_progress or completed with objects). */
export async function resolveViewableAttemptId(
  userId: string,
  problemId: string,
): Promise<string | null> {
  const inProgress = await findInProgressAttempt(userId, problemId, null)
  if (inProgress) return inProgress.id

  const attempts = await fetchPracticeAttemptsForProblem(userId, problemId)
  for (const a of attempts) {
    if (a.status !== 'completed') continue
    const canvas = await fetchAttemptCanvas(a.id)
    if (canvas.length > 0) return a.id
  }
  return null
}
