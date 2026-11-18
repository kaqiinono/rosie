import 'server-only'

import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { WordEntry, WordMasteryInfo } from '@rosie/core'
import type { ExamResolvedWord, ExamWordProgress, ExamWordReviewBatch, ExamWordReviewItem, ExamWordReviewSummary, VocabularyLink } from '@rosie/exams'
import { buildQuizOptions, isAcceptedSpelling, wordKey } from '@rosie/english/utils/english-helpers'
import { normalizeWordForms } from '@rosie/english/utils/word-forms'
import { attemptCommandHash, attemptUuid, readAttemptEnvelope } from './attempts'
import { selectedGroups } from './attemptEngine'
import { ExamApiError, examIdentifier } from './http'

interface StoredItem extends Omit<ExamWordReviewItem, 'valid'> {
  options: { id: string; label: string }[]
  correctOptionId: string | null
}
interface WordState { schemaVersion: 1; status: ExamWordReviewBatch['status']; items: StoredItem[]; cursor: number }
interface Row { id: string; user_id: string; version: string; state: WordState; completed_at: string | null; updated_at: string }
const WORD_COLUMNS = 'id,stage,unit,lesson,word,explanation,chinese_def,ipa,example,phonics,syllables,keywords,vocab_type,part_of_speech,word_forms,image_path'
function storage(error: { message?: string; code?: string }): never {
  const statuses: Record<string, number> = { exam_not_found: 404, exam_conflict: 409, exam_word_invalid: 409, exam_word_batch_full: 409, exam_invalid_request: 400 }
  if (error.message && statuses[error.message]) throw new ExamApiError(error.message, statuses[error.message])
  if (error.code === '23505') throw new ExamApiError('exam_conflict', 409)
  throw new ExamApiError('exam_unavailable', 503)
}
function wordFromRow(row: Record<string, unknown>): WordEntry {
  if (typeof row.id !== 'string' || typeof row.word !== 'string' || typeof row.unit !== 'string' || typeof row.lesson !== 'string' || typeof row.explanation !== 'string') throw new ExamApiError('exam_word_invalid', 409)
  return { id: row.id, stage: typeof row.stage === 'string' ? row.stage : undefined, unit: row.unit, lesson: row.lesson, word: row.word, explanation: row.explanation,
    chineseDef: typeof row.chinese_def === 'string' ? row.chinese_def : undefined, ipa: typeof row.ipa === 'string' ? row.ipa : undefined,
    example: typeof row.example === 'string' ? row.example : undefined, phonics: typeof row.phonics === 'string' ? row.phonics : undefined,
    syllables: Array.isArray(row.syllables) ? row.syllables as string[] : undefined, keywords: Array.isArray(row.keywords) ? row.keywords as [string, string][] : undefined,
    vocabType: row.vocab_type === 'Target' || row.vocab_type === 'Context' || row.vocab_type === 'Extension' ? row.vocab_type : undefined,
    partOfSpeech: Array.isArray(row.part_of_speech) ? row.part_of_speech as string[] : undefined,
    wordForms: normalizeWordForms(row.word_forms), imagePath: typeof row.image_path === 'string' ? row.image_path : undefined }
}
function matches(word: WordEntry, snapshot: VocabularyLink['sourceSnapshot']) {
  return word.stage === snapshot.stage && word.unit === snapshot.unit && word.lesson === snapshot.lesson && word.word === snapshot.word
}
function wordBatches(values: string[]) {
  return Array.from({ length: Math.ceil(values.length / 100) }, (_, index) => values.slice(index * 100, (index + 1) * 100))
}
async function wordsByIds(db: SupabaseClient, ids: string[]) {
  const pages = await Promise.all(wordBatches(ids).map(async batch => {
    const { data, error } = await db.from('word_entries').select(WORD_COLUMNS).in('id', batch)
    if (error) storage(error)
    return (data ?? []).map(wordFromRow)
  }))
  return new Map(pages.flat().map(word => [word.id!, word]))
}
export async function resolveExamWords(db: SupabaseClient, userId: string, attemptId: string): Promise<ExamResolvedWord[]> {
  const { attempt, draft } = await readAttemptEnvelope(db, userId, attemptId)
  const publication = await db.rpc('read_exam_publication', { p_id: attempt.contentRevisionId })
  if (publication.error) storage(publication.error)
  const published = publication.data as { id: string; version: string; status: string; reviews: Record<string, { contentRevisionId: string; contentVersion: string; decision: string } | null> } | null
  if (!published || !published.reviews || !['published', 'withdrawn'].includes(published.status) || ['exam', 'explanations'].some(scope => {
    const review = published.reviews[scope]
    return !review || review.decision !== 'approved' || review.contentRevisionId !== attempt.contentRevisionId || review.contentVersion !== published.version
  })) throw new ExamApiError('exam_word_invalid', 409)
  const submitted = new Set(selectedGroups(draft, attempt.state).filter(group => attempt.state.sections[group.sectionId]?.status === 'submitted').flatMap(group => group.questions.map(question => question.id)))
  const links = draft.content.vocabularyLinks.filter(link => link.review.status !== 'blocked' && link.questionIds.length > 0 && link.questionIds.every(id => submitted.has(id)))
  const words = await wordsByIds(db, [...new Set(links.map(link => link.wordEntryId))])
  const keys = [...new Set([...words.values()].map(wordKey))]
  const masteryPages = await Promise.all(wordBatches(keys).map(async batch => {
    const { data, error } = await db.from('word_mastery').select('word_key,correct,incorrect,last_seen,stage,next_review_date,is_hard').eq('user_id', userId).in('word_key', batch)
    if (error) storage(error)
    return data ?? []
  }))
  const masteryByKey = new Map(masteryPages.flat().map(row => [row.word_key, row]))
  return links.map(link => {
    const candidate = words.get(link.wordEntryId.toLowerCase())
    const valid = !!candidate && matches(candidate, link.sourceSnapshot)
    const row = candidate ? masteryByKey.get(wordKey(candidate)) : undefined
    const info: WordMasteryInfo | null = row ? { correct: row.correct ?? 0, incorrect: row.incorrect ?? 0, lastSeen: row.last_seen ?? '', stage: row.stage ?? undefined, nextReviewDate: row.next_review_date ?? undefined, isHard: row.is_hard ?? undefined } : null
    return { link, word: valid ? candidate! : null, valid, mastery: info, masteryScope: 'legacy_shared', sources: link.questionIds.map(questionId => ({
      attemptId, contentRevisionId: attempt.contentRevisionId, questionId, linkId: link.id, title: draft.contentSet.title,
      sentence: link.sentence, matchedForm: link.matchedForm, contextMeaning: link.contextMeaning, sourceSnapshot: link.sourceSnapshot,
    })) }
  })
}
function storedRow(value: unknown, userId: string): Row {
  if (!value || typeof value !== 'object') throw new ExamApiError('exam_unavailable', 503)
  const row = value as Row
  if (row.user_id !== userId || !row.state || row.state.schemaVersion !== 1 || !Array.isArray(row.state.items)) throw new ExamApiError('exam_not_found', 404)
  return row
}
async function readRow(db: SupabaseClient, userId: string, id: string): Promise<Row> {
  const { data, error } = await db.from('exam_word_review_batches').select('id,user_id,version,state,completed_at,updated_at').eq('id', id).eq('user_id', userId).maybeSingle()
  if (error) storage(error)
  if (!data) throw new ExamApiError('exam_not_found', 404)
  return storedRow(data, userId)
}
async function project(db: SupabaseClient, row: Row): Promise<ExamWordReviewBatch> {
  const words = await wordsByIds(db, row.state.items.map(item => item.wordEntryId))
  const items = row.state.items.map(item => ({ wordEntryId: item.wordEntryId, word: item.word, sources: item.sources,
    valid: !!words.get(item.wordEntryId) && item.sources.every(source => matches(words.get(item.wordEntryId)!, source.sourceSnapshot)),
    meaning: item.meaning, spelling: item.spelling }))
  const item = row.state.items[Math.floor(row.state.cursor / 2)]
  const plans = row.state.status === 'completed' ? await db.from('adaptive_word_plans').select('id,scope').eq('user_id', row.user_id).eq('status', 'active').is('archived_at', null).limit(10) : { data: [], error: null }
  const plan = plans.data?.find(candidate => Array.isArray(candidate.scope?.stages) && candidate.scope.stages.includes('KET'))
  return { id: row.id, version: row.version, status: row.state.status, items, cursor: row.state.cursor, completedAt: row.completed_at, updatedAt: row.updated_at,
    next: { activePlanHref: plan ? `/english/words/adaptive/${plan.id}/practice` : null, planStatus: row.state.status !== 'completed' ? 'not_requested' : plans.error ? 'unavailable' : plan ? 'available' : 'none', materialHref: row.state.status === 'completed' ? `/exams/ket/practice?wordReviewBatchId=${row.id}` : null },
    current: row.state.status === 'active' && item ? { wordEntryId: item.wordEntryId, phase: row.state.cursor % 2 ? 'spelling' : 'meaning', options: row.state.cursor % 2 ? [] : item.options } : null }
}
export async function readWordReview(db: SupabaseClient, userId: string, id: string) { return project(db, await readRow(db, userId, id)) }
export async function listWordReviews(db: SupabaseClient, userId: string): Promise<ExamWordReviewSummary[]> {
  const { data, error } = await db.from('exam_word_review_batches').select('id,version,state,updated_at').eq('user_id', userId).order('updated_at', { ascending: false }).limit(50)
  if (error) storage(error)
  return (data ?? []).map(row => ({ id: row.id, version: row.version, status: row.state.status, count: row.state.items.length, updatedAt: row.updated_at }))
}
async function prior(db: SupabaseClient, userId: string, requestId: string, hash: string): Promise<string | null> {
  const { data, error } = await db.rpc('find_exam_word_review_request', { p_user: userId, p_request_id: requestId, p_command_hash: hash })
  if (error) storage(error)
  return typeof data === 'string' ? data : null
}
async function save(db: SupabaseClient, userId: string, row: Row | null, state: WordState, requestId: string, hash: string, operation: string) {
  const { data, error } = await db.rpc('save_exam_word_review', { p_user: userId, p_id: row?.id ?? randomUUID(), p_expected_version: row?.version ?? null,
    p_request_id: requestId, p_command_hash: hash, p_operation: operation, p_state: state })
  if (error) storage(error)
  return project(db, storedRow(data, userId))
}
const initialProgress = (): ExamWordProgress => ({ attempts: 0, helpClicks: 0, firstCorrect: null, firstIndependent: null, lastAnswer: null, lastCorrect: null })
export async function addReviewWord(db: SupabaseClient, userId: string, body: Record<string, unknown>) {
  if (Object.keys(body).some(key => !['requestId', 'attemptId', 'linkId'].includes(key))) throw new ExamApiError('exam_invalid_request', 400)
  const requestId = attemptUuid(body.requestId), attemptId = attemptUuid(body.attemptId), linkId = examIdentifier(body.linkId)
  const hash = attemptCommandHash({ userId, operation: 'add', requestId, attemptId, linkId })
  const previous = await prior(db, userId, requestId, hash)
  if (previous) return readWordReview(db, userId, previous)
  const resolved = (await resolveExamWords(db, userId, attemptId)).find(item => item.link.id === linkId)
  if (!resolved) throw new ExamApiError('exam_not_found', 404)
  if (!resolved.valid || !resolved.word) throw new ExamApiError('exam_word_invalid', 409)
  const active = await db.from('exam_word_review_batches').select('id,user_id,version,state,completed_at,updated_at').eq('user_id', userId).eq('status', 'collecting').maybeSingle()
  if (active.error) storage(active.error)
  const row = active.data ? storedRow(active.data, userId) : null
  const state: WordState = row ? structuredClone(row.state) : { schemaVersion: 1, status: 'collecting', cursor: 0, items: [] }
  const existing = state.items.find(item => item.wordEntryId === resolved.word!.id)
  if (existing) {
    if (!matches(existing.word, resolved.link.sourceSnapshot)) throw new ExamApiError('exam_word_invalid', 409)
    resolved.sources.forEach(source => { if (!existing.sources.some(value => value.attemptId === source.attemptId && value.questionId === source.questionId && value.linkId === source.linkId)) existing.sources.push(source) })
  } else {
    if (state.items.length >= 10) throw new ExamApiError('exam_word_batch_full', 409)
    state.items.push({ wordEntryId: resolved.word.id!, word: resolved.word, sources: resolved.sources, options: [], correctOptionId: null, meaning: initialProgress(), spelling: initialProgress() })
  }
  return save(db, userId, row, state, requestId, hash, 'add')
}
export async function commandWordReview(db: SupabaseClient, userId: string, id: string, body: Record<string, unknown>) {
  if (Object.keys(body).some(key => !['requestId', 'expectedVersion', 'operation', 'answer', 'wordEntryId'].includes(key)) || !['start', 'answer', 'help', 'retry', 'next', 'remove'].includes(String(body.operation))) throw new ExamApiError('exam_invalid_request', 400)
  const requestId = attemptUuid(body.requestId), version = attemptUuid(body.expectedVersion), operation = String(body.operation)
  if (operation === 'answer' ? typeof body.answer !== 'string' || body.answer.length > 300 : body.answer !== undefined) throw new ExamApiError('exam_invalid_request', 400)
  if (operation === 'remove') attemptUuid(body.wordEntryId)
  else if (body.wordEntryId !== undefined) throw new ExamApiError('exam_invalid_request', 400)
  const hash = attemptCommandHash({ userId, id, body })
  const previous = await prior(db, userId, requestId, hash)
  if (previous) { if (previous !== id) throw new ExamApiError('exam_conflict', 409); return readWordReview(db, userId, id) }
  const row = await readRow(db, userId, id)
  if (row.version !== version) throw new ExamApiError('exam_conflict', 409)
  const state = structuredClone(row.state)
  const view = await project(db, row)
  if (operation !== 'remove' && view.items.some(item => !item.valid)) throw new ExamApiError('exam_word_invalid', 409)
  if (operation === 'remove') {
    if (state.status !== 'collecting' || !state.items.some(item => item.wordEntryId === body.wordEntryId)) throw new ExamApiError('exam_invalid_request', 400)
    state.items = state.items.filter(item => item.wordEntryId !== body.wordEntryId)
  } else if (operation === 'start') {
    if (state.status !== 'collecting' || !state.items.length) throw new ExamApiError('exam_invalid_request', 400)
    const poolResult = await db.from('vocabulary_positions').select(WORD_COLUMNS).in('stage', [...new Set(state.items.map(item => item.word.stage).filter((stage): stage is string => !!stage))]).order('id').limit(500)
    if (poolResult.error) storage(poolResult.error)
    const pool = (poolResult.data ?? []).map(wordFromRow)
    state.items.forEach((item, index) => {
      const labels = new Set([item.word.explanation.trim()])
      const distinct = pool.filter(word => { const label = word.explanation.trim(); if (!label || labels.has(label)) return false; labels.add(label); return true })
      const choices = buildQuizOptions(item.word, [item.word, ...distinct], index + Number.parseInt(id.slice(0, 8), 16))
      if (choices.length < 2 || !item.word.explanation.trim()) throw new ExamApiError('exam_word_options_unavailable', 409)
      item.options = choices.map((word, choice) => ({ id: String.fromCharCode(65 + choice), label: word.explanation }))
      item.correctOptionId = item.options[choices.findIndex(word => word.id === item.wordEntryId)].id
    })
    state.status = 'active'
  } else {
    if (state.status !== 'active') throw new ExamApiError('exam_invalid_request', 400)
    const item = state.items[Math.floor(state.cursor / 2)]
    const phase = state.cursor % 2 ? 'spelling' : 'meaning'
    const progress = item[phase]
    if (operation === 'help') {
      if (progress.lastCorrect !== null) throw new ExamApiError('exam_invalid_request', 400)
      progress.helpClicks += 1
    } else if (operation === 'answer') {
      if (progress.lastCorrect !== null) throw new ExamApiError('exam_invalid_request', 400)
      const answer = body.answer as string
      if (phase === 'meaning' && !item.options.some(option => option.id === answer)) throw new ExamApiError('exam_invalid_request', 400)
      const correct = phase === 'meaning' ? answer === item.correctOptionId : isAcceptedSpelling(answer, item.word.word)
      if (!progress.attempts) { progress.firstCorrect = correct; progress.firstIndependent = progress.helpClicks === 0 }
      progress.attempts += 1; progress.lastAnswer = answer; progress.lastCorrect = correct
    } else if (operation === 'retry') {
      if (progress.lastCorrect !== false) throw new ExamApiError('exam_invalid_request', 400)
      progress.lastAnswer = null; progress.lastCorrect = null
    } else {
      if (progress.lastCorrect !== true) throw new ExamApiError('exam_invalid_request', 400)
      state.cursor += 1
      if (state.cursor === state.items.length * 2) state.status = 'completed'
    }
  }
  return save(db, userId, row, state, requestId, hash, operation)
}
