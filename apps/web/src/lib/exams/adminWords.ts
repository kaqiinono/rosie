import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExamAdminWordChoice, ExamAdminWordSearch } from '@rosie/exams'
import { ExamApiError } from './http'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseExamAdminWordSearch(request: Request): { query: string; limit: number } {
  const params = new URL(request.url).searchParams
  if ([...params.keys()].some(key => !['q', 'limit'].includes(key) || params.getAll(key).length !== 1)
    || !params.has('q')) throw new ExamApiError('exam_invalid_request', 400)
  const raw = params.get('q') ?? ''
  const query = raw.trim()
  const limitText = params.get('limit') ?? '20'
  if (!query || raw.length > 80 || /[\u0000-\u001f\u007f]/.test(raw)
    || !/^[1-9][0-9]?$/.test(limitText) || Number(limitText) > 30) throw new ExamApiError('exam_invalid_request', 400)
  return { query, limit: Number(limitText) }
}

function choice(input: unknown): ExamAdminWordChoice {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ExamApiError('exam_unavailable', 503)
  const row = input as Record<string, unknown>
  if (typeof row.id !== 'string' || !UUID.test(row.id) || row.stage !== 'KET'
    || typeof row.unit !== 'string' || typeof row.lesson !== 'string'
    || typeof row.word !== 'string' || !row.word.trim()) throw new ExamApiError('exam_unavailable', 503)
  return { id: row.id.toLowerCase(), sourceSnapshot: { stage: row.stage, unit: row.unit, lesson: row.lesson, word: row.word } }
}

export async function searchExamAdminWords(db: SupabaseClient, search: { query: string; limit: number }): Promise<ExamAdminWordSearch> {
  const literal = search.query.replace(/[\\%_]/g, character => `\\${character}`)
  const { data, error } = await db.from('word_entries').select('id,stage,unit,lesson,word')
    .eq('stage', 'KET').ilike('word', `%${literal}%`).order('word').order('unit').order('lesson').order('id').limit(search.limit + 1)
  if (error || !Array.isArray(data)) throw new ExamApiError('exam_unavailable', 503)
  return { query: search.query, items: data.slice(0, search.limit).map(choice), hasMore: data.length > search.limit }
}
