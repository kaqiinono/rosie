'use client'

import { supabase } from '@rosie/core'
import { isLessonSummaryProblemId } from '@rosie/math/constants'
import {
  isRichBodyEmpty,
  sanitizeRichHtml,
} from '@rosie/math/utils/sanitize-summary-html'

type RawRow = {
  id: string
  lesson_id: string
  problem_id: string
  title: string | null
  body_html: string
  sort_order: number
  user_id: string
  created_at: string
  updated_at: string
}

export type MathProblemNote = {
  id: string
  lessonId: string
  problemId: string
  title: string | null
  bodyHtml: string
  sortOrder: number
  userId: string
  createdAt: string
  updatedAt: string
}

function rowToNote(r: RawRow): MathProblemNote {
  return {
    id: r.id,
    lessonId: r.lesson_id,
    problemId: r.problem_id,
    title: r.title,
    bodyHtml: r.body_html,
    sortOrder: r.sort_order,
    userId: r.user_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

const lessonCache = new Map<string, Promise<MathProblemNote[]>>()

export function invalidateLessonNotesCache(lessonId?: string): void {
  if (lessonId) {
    lessonCache.delete(lessonId)
    return
  }
  lessonCache.clear()
}

async function fetchLessonNotes(lessonId: string): Promise<MathProblemNote[]> {
  const { data, error } = await supabase
    .from('math_problem_notes')
    .select('id, lesson_id, problem_id, title, body_html, sort_order, user_id, created_at, updated_at')
    .eq('lesson_id', lessonId)
    .order('problem_id')
    .order('sort_order')

  if (error) throw error
  if (!data) return []
  return (data as RawRow[]).map(rowToNote)
}

export function loadLessonNotes(lessonId: string): Promise<MathProblemNote[]> {
  const existing = lessonCache.get(lessonId)
  if (existing) return existing

  const promise = fetchLessonNotes(lessonId).catch((err: unknown) => {
    lessonCache.delete(lessonId)
    throw err
  })
  lessonCache.set(lessonId, promise)
  return promise
}

/** Per-problem slice; reuses the per-lesson cache (one network call per lesson). */
export async function fetchProblemNotes(problemId: string, lessonId: string): Promise<MathProblemNote[]> {
  const all = await loadLessonNotes(lessonId)
  return notesForProblem(all, problemId)
}

export async function createMathProblemNote(
  userId: string,
  lessonId: string,
  problemId: string,
  input: { title?: string | null; bodyHtml: string; sortOrder?: number },
): Promise<{ error: string | null; note: MathProblemNote | null }> {
  const bodyHtml = sanitizeRichHtml(input.bodyHtml)
  if (isRichBodyEmpty(bodyHtml)) {
    return { error: '笔记正文不能为空', note: null }
  }

  const title = input.title?.trim() || null
  const sortOrder = input.sortOrder ?? 0
  const updatedAt = new Date().toISOString()

  const { data, error } = await supabase
    .from('math_problem_notes')
    .insert({
      lesson_id: lessonId,
      problem_id: problemId,
      title,
      body_html: bodyHtml,
      sort_order: sortOrder,
      user_id: userId,
      updated_at: updatedAt,
    })
    .select()
    .single()

  if (error || !data) return { error: error?.message ?? '保存失败', note: null }

  invalidateLessonNotesCache(lessonId)
  return { error: null, note: rowToNote(data as RawRow) }
}

export async function updateMathProblemNote(
  note: MathProblemNote,
  patch: { title?: string | null; bodyHtml?: string; sortOrder?: number },
): Promise<{ error: string | null; note: MathProblemNote | null }> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (patch.title !== undefined) row.title = patch.title?.trim() || null
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder
  if (patch.bodyHtml !== undefined) {
    const bodyHtml = sanitizeRichHtml(patch.bodyHtml)
    if (isRichBodyEmpty(bodyHtml)) return { error: '笔记正文不能为空', note: null }
    row.body_html = bodyHtml
  }

  const { data, error } = await supabase
    .from('math_problem_notes')
    .update(row)
    .eq('id', note.id)
    .select()
    .single()

  if (error || !data) return { error: error?.message ?? '更新失败', note: null }

  invalidateLessonNotesCache(note.lessonId)
  return { error: null, note: rowToNote(data as RawRow) }
}

export async function deleteMathProblemNote(note: MathProblemNote): Promise<{ error: string | null }> {
  const { error } = await supabase.from('math_problem_notes').delete().eq('id', note.id)
  if (error) return { error: error.message }

  invalidateLessonNotesCache(note.lessonId)
  return { error: null }
}

export function notesForProblem(notes: MathProblemNote[], problemId: string): MathProblemNote[] {
  return notes.filter((n) => n.problemId === problemId).sort((a, b) => a.sortOrder - b.sortOrder)
}

export function noteCountByProblem(notes: MathProblemNote[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const n of notes) {
    if (isLessonSummaryProblemId(n.problemId)) continue
    map.set(n.problemId, (map.get(n.problemId) ?? 0) + 1)
  }
  return map
}

/** Group lesson notes by problem_id, preserving sort_order within each problem. */
export function groupNotesByProblem(
  notes: MathProblemNote[],
): { problemId: string; notes: MathProblemNote[] }[] {
  const map = new Map<string, MathProblemNote[]>()
  for (const note of notes) {
    if (isLessonSummaryProblemId(note.problemId)) continue
    const list = map.get(note.problemId) ?? []
    list.push(note)
    map.set(note.problemId, list)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([problemId, problemNotes]) => ({
      problemId,
      notes: problemNotes.sort((x, y) => x.sortOrder - y.sortOrder),
    }))
}
