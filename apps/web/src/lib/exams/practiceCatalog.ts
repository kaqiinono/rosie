import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { KET_SCHOOLS_2020_TEMPLATE } from '@rosie/exams'
import type { ExamContentRevision, ExamContentSet, ExamPracticeGroup, ExamPracticeOptions, ExamPracticePage,
  ExamTemplate, Question, VocabularyLink } from '@rosie/exams'
import { ExamApiError, examIdentifier } from './http'
import { attemptStorageError } from './attempts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DOMAINS: Record<string, string> = { reading: '阅读', listening: '听力', writing: '写作', speaking: '口语', grammar: '语法', vocabulary: '词汇' }
const OPTION_LIMIT = 500
interface RevisionRow { id: string; set_snapshot: ExamContentSet; content: ExamContentRevision }
interface Candidate { item: ExamPracticeGroup; questions: readonly Question[]; links: readonly VocabularyLink[] }

function optionalId(params: URLSearchParams, key: string): string | null {
  return params.has(key) ? examIdentifier(params.get(key)) : null
}
function optionalUuid(params: URLSearchParams, key: string): string | null {
  if (!params.has(key)) return null
  const value = params.get(key) ?? ''
  if (!UUID.test(value)) throw new ExamApiError('exam_invalid_id', 400)
  return value.toLowerCase()
}

/** Only eligible group/facet metadata; never question text, answers or reserved material. */
export async function listPracticeGroups(db: SupabaseClient, userId: string, request: Request): Promise<ExamPracticePage> {
  const params = new URL(request.url).searchParams
  const allowed = ['revisionId', 'sectionId', 'partNumber', 'domain', 'questionType', 'knowledgePoint', 'wordEntryId', 'unseen', 'page', 'wordReviewBatchId']
  if ([...params.keys()].some(key => !allowed.includes(key) || params.getAll(key).length !== 1)) throw new ExamApiError('exam_invalid_request', 400)
  const pageText = params.get('page') ?? '1'
  const page = Number(pageText)
  if (!/^[1-9][0-9]*$/.test(pageText) || !Number.isSafeInteger(page) || page > 10000) throw new ExamApiError('exam_invalid_pagination', 400)
  const part = params.get('partNumber')
  if (part !== null && (!/^[1-9][0-9]*$/.test(part) || !Number.isSafeInteger(Number(part)) || Number(part) > 100)) throw new ExamApiError('exam_invalid_request', 400)
  const filters = { revisionId: optionalId(params, 'revisionId'), sectionId: optionalId(params, 'sectionId'), partNumber: part ? Number(part) : null,
    domain: optionalId(params, 'domain'), questionType: optionalId(params, 'questionType'), knowledgePoint: optionalId(params, 'knowledgePoint'),
    wordEntryId: optionalUuid(params, 'wordEntryId') }
  if ((filters.domain && !Object.hasOwn(DOMAINS, filters.domain))
    || (params.has('unseen') && !['true', 'false'].includes(params.get('unseen') ?? ''))) throw new ExamApiError('exam_invalid_request', 400)
  const batchId = optionalUuid(params, 'wordReviewBatchId')
  let batchWords: Map<string, Record<string, unknown>> | null = null
  if (batchId) {
    const batch = await db.from('exam_word_review_batches').select('id,status').eq('id', batchId).eq('user_id', userId).maybeSingle()
    if (batch.error) attemptStorageError(batch.error)
    if (!batch.data || batch.data.status !== 'completed') throw new ExamApiError('exam_not_found', 404)
    const words = await db.from('exam_word_review_items').select('word_entry_id,word_snapshot').eq('batch_id', batchId).eq('user_id', userId)
    if (words.error) attemptStorageError(words.error)
    batchWords = new Map((words.data ?? []).map(row => [(row.word_entry_id as string).toLowerCase(), row.word_snapshot as Record<string, unknown>]))
  }
  const revisions = await db.from('exam_content_revisions').select('id,set_snapshot,content').eq('status', 'published')
    .eq('set_snapshot->>purpose', 'training').order('id').limit(101)
  if (revisions.error) attemptStorageError(revisions.error)
  const rows = ((revisions.data ?? []) as RevisionRow[]).slice(0, 100)
  // A per-paper link remains usable beyond the bounded initial directory.
  // The exact lookup retains both publication and purpose gates.
  if (filters.revisionId && !rows.some(row => row.id === filters.revisionId)) {
    const selected = await db.from('exam_content_revisions').select('id,set_snapshot,content').eq('id', filters.revisionId)
      .eq('status', 'published').eq('set_snapshot->>purpose', 'training').maybeSingle()
    if (selected.error) attemptStorageError(selected.error)
    if (selected.data) rows.push(selected.data as RevisionRow)
  }
  const seen = new Set<string>()
  for (let offset = 0; ; offset += 1000) {
    const exposures = await db.from('exam_material_exposures').select('family_id').eq('user_id', userId)
      .order('family_id').order('attempt_id').range(offset, offset + 999)
    if (exposures.error) attemptStorageError(exposures.error)
    for (const row of exposures.data ?? []) seen.add(row.family_id as string)
    if ((exposures.data?.length ?? 0) < 1000) break
    // Never silently call old material unseen when exposure retrieval is truncated.
    if (offset >= 99000) throw new ExamApiError('exam_unavailable', 503)
  }
  const candidates: Candidate[] = []
  const typeLabels = new Map<string, string>()
  for (const row of rows) {
    if (row.set_snapshot.purpose !== 'training' || row.content.status !== 'published') continue
    const template: ExamTemplate | undefined = row.set_snapshot.template.id === KET_SCHOOLS_2020_TEMPLATE.id
      && row.set_snapshot.template.version === KET_SCHOOLS_2020_TEMPLATE.version ? KET_SCHOOLS_2020_TEMPLATE : undefined
    for (const section of template?.sections ?? []) for (const part of section.parts) typeLabels.set(part.questionTypeId, part.label)
    for (const group of row.content.groups) {
      const questions = group.questions.filter(question => question.scoring.kind !== 'example')
      if (!questions.length) continue
      const links = row.content.vocabularyLinks.filter(link => link.review.status !== 'blocked'
        && link.questionIds.some(id => questions.some(question => question.id === id)))
      const previouslySeen = row.content.materials.some(material => group.materialIds.includes(material.id) && seen.has(material.familyId))
      const reviewedWords = batchWords
      if (reviewedWords && (!links.some(link => link.role === 'key' && reviewedWords.has(link.wordEntryId.toLowerCase())
        && Object.entries(link.sourceSnapshot).every(([key, value]) => reviewedWords.get(link.wordEntryId.toLowerCase())?.[key] === value)) || previouslySeen)) continue
      if (params.get('unseen') === 'true' && previouslySeen) continue
      const section = template?.sections.find(value => value.id === group.sectionId)
      const part = section?.parts.find(value => value.number === group.partNumber)
      const questionTypes = [...new Set(questions.map(question => question.classification.questionTypeId))]
      candidates.push({ questions, links, item: { revisionId: row.id, groupId: group.id, title: row.set_snapshot.title,
        sectionId: group.sectionId, sectionLabel: section?.label ?? group.sectionId,
        partNumber: group.partNumber, partLabel: part ? `Part ${group.partNumber} · ${part.label}` : `Part ${group.partNumber}`,
        role: group.role, questionCount: questions.length, matchedQuestionCount: questions.length, seen: previouslySeen,
        domains: [...new Set(questions.map(question => question.classification.domain))], questionTypes,
        questionTypeLabels: questionTypes.map(id => typeLabels.get(id) ?? id),
        knowledgePoints: [...new Set(questions.flatMap(question => [...question.classification.knowledgePointIds]))] } })
    }
  }

  const maps: Record<keyof ExamPracticeOptions, Map<string, string>> = {
    revisions: new Map(), sections: new Map(), parts: new Map(), domains: new Map(),
    questionTypes: new Map(), knowledgePoints: new Map(), words: new Map(),
  }
  const groups: ExamPracticeGroup[] = []
  // Facets follow the UI hierarchy; a field never filters away its own alternatives.
  // Multiple question filters must match the same actual question.
  for (const candidate of candidates) {
    const { item, links } = candidate
    maps.revisions.set(item.revisionId, item.title)
    if (filters.revisionId && item.revisionId !== filters.revisionId) continue
    maps.sections.set(item.sectionId, item.sectionLabel)
    if (filters.sectionId && item.sectionId !== filters.sectionId) continue
    maps.parts.set(String(item.partNumber), filters.sectionId ? item.partLabel : `Part ${item.partNumber}`)
    if (filters.partNumber && item.partNumber !== filters.partNumber) continue
    let questions = candidate.questions
    for (const question of questions) maps.domains.set(question.classification.domain, DOMAINS[question.classification.domain])
    if (filters.domain) questions = questions.filter(question => question.classification.domain === filters.domain)
    for (const question of questions) maps.questionTypes.set(question.classification.questionTypeId,
      typeLabels.get(question.classification.questionTypeId) ?? question.classification.questionTypeId)
    if (filters.questionType) questions = questions.filter(question => question.classification.questionTypeId === filters.questionType)
    for (const question of questions) for (const id of question.classification.knowledgePointIds) maps.knowledgePoints.set(id, id)
    const knowledgePoint = filters.knowledgePoint
    if (knowledgePoint) questions = questions.filter(question => question.classification.knowledgePointIds.includes(knowledgePoint))
    const visibleLinks = links.filter(link => link.questionIds.some(id => questions.some(question => question.id === id)))
    for (const link of visibleLinks) maps.words.set(link.wordEntryId.toLowerCase(), `${link.sourceSnapshot.word} · ${link.sourceSnapshot.stage}`)
    if (filters.wordEntryId) {
      const questionIds = new Set(visibleLinks.filter(link => link.wordEntryId.toLowerCase() === filters.wordEntryId).flatMap(link => [...link.questionIds]))
      questions = questions.filter(question => questionIds.has(question.id))
    }
    if (questions.length) groups.push({ ...item, matchedQuestionCount: questions.length })
  }
  const options = Object.fromEntries(Object.entries(maps).map(([key, map]) => [key,
    [...map.entries()].sort((a, b) => key === 'parts' ? Number(a[0]) - Number(b[0]) : a[1].localeCompare(b[1], 'zh-CN') || a[0].localeCompare(b[0], 'en'))
      .slice(0, OPTION_LIMIT).map(([value, label]) => ({ value, label }))])) as unknown as ExamPracticeOptions
  groups.sort((a, b) => Number(a.seen) - Number(b.seen) || a.title.localeCompare(b.title, 'zh-CN')
    || a.sectionId.localeCompare(b.sectionId, 'en') || a.partNumber - b.partNumber || a.groupId.localeCompare(b.groupId, 'en'))
  const offset = (page - 1) * 25
  return { items: groups.slice(offset, offset + 25), page, pageSize: 25, hasMore: groups.length > offset + 25,
    catalogLimited: (revisions.data?.length ?? 0) > 100, optionsLimited: Object.values(maps).some(map => map.size > OPTION_LIMIT), options }
}
