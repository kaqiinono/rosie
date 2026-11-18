import 'server-only'

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VocabularyLink } from '@rosie/exams'
import { examVocabularyText, validateExamDraft, type ExamDraftInput } from '@rosie/exams/validation'
import { getWordFormCandidates, normalizeWordForms } from '@rosie/english/utils/word-forms'
import { ExamApiError } from './http'

type WordRow = {
  id: string
  stage: string
  unit: string
  lesson: string
  word: string
  word_forms: unknown
  accepted_spellings: string[] | null
  case_sensitive: boolean
  display_chinese_def: string | null
  display_explanation: string
}

type Candidate = { row: WordRow; rank: number }
type Candidates = { entries: Map<string, Candidate>; maxTerms: number }
const columns = 'id,stage,unit,lesson,word,word_forms,accepted_spellings,case_sensitive,display_chinese_def,display_explanation'
const tokens = /[\p{L}\p{M}\p{N}]+(?:['’\-‐‑][\p{L}\p{M}\p{N}]+)*/gu
const normalize = (text: string) => text.normalize('NFC').replace(/’/gu, "'").replace(/[‐‑]/gu, '-').replace(/\s+/gu, ' ').trim()

async function vocabularyIndex(db: SupabaseClient, preferredStage: string) {
  const index = new Map<string, Candidates>()
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db.from('vocabulary_positions').select(columns).order('id').range(offset, offset + pageSize - 1)
    if (error || !Array.isArray(data)) throw new ExamApiError('exam_unavailable', 503)
    for (const row of data as WordRow[]) {
      if (!row.stage?.trim() || !row.unit?.trim() || !row.lesson?.trim() || !row.word?.trim()) continue
      const forms = getWordFormCandidates({
        word: row.word, explanation: row.display_explanation, unit: row.unit, lesson: row.lesson,
        wordForms: normalizeWordForms(row.word_forms),
      }).map(form => ({ text: form.text, rank: form.source === 'base' ? 0 : form.source === 'explicit' ? 1 : 2 }))
      forms.push({ text: row.word, rank: 0 }, ...(row.accepted_spellings ?? []).map(text => ({ text, rank: 0 })))
      for (const form of forms) {
        const surface = normalize(form.text)
        const terms = [...surface.matchAll(tokens)].map(match => match[0])
        if (!terms.length || terms.join(' ') !== surface) continue
        const first = terms[0].toLowerCase()
        const candidates = index.get(first) ?? { entries: new Map(), maxTerms: 0 }
        const key = row.case_sensitive ? `exact:${surface}` : surface.toLowerCase()
        const rank = form.rank * 2 + Number(row.stage !== preferredStage)
        const previous = candidates.entries.get(key)
        if (!previous || rank < previous.rank) candidates.entries.set(key, { row, rank })
        candidates.maxTerms = Math.max(candidates.maxTerms, terms.length)
        index.set(first, candidates)
      }
    }
    if (data.length < pageSize) return index
  }
}

const sentenceSegments = new Intl.Segmenter('en', { granularity: 'sentence' })
const wordScope = (ids: readonly string[], wordId: string) => JSON.stringify([wordId.toLowerCase(), [...ids].sort()])

export async function matchExamVocabulary(db: SupabaseClient, draft: ExamDraftInput) {
  const sources = examVocabularyText(draft.content)
  const authored = draft.content.vocabularyLinks.filter(link => !link.matchSource)
  const matches: VocabularyLink[] = []
  if (!sources.length) return { links: authored, matched: 0, omitted: 0 }
  const preferredStage = draft.contentSet.template.id.split('-')[0].toUpperCase()
  const index = await vocabularyIndex(db, preferredStage)
  const seen = new Set(authored.map(link => wordScope(link.questionIds, link.wordEntryId)))
  for (const source of sources) {
    const segments = sentenceSegments.segment(source.text)
    const spans = [...source.text.matchAll(tokens)]
    for (const [position, token] of spans.entries()) {
      const first = normalize(token[0])
      const candidates = index.get(first.toLowerCase())
      if (!candidates) continue
      const start = token.index ?? 0
      let end = start + token[0].length
      for (let next = position; next < spans.length && next < position + candidates.maxTerms; next++) {
        const span = spans[next]
        const spanStart = span.index ?? 0
        if (next !== position && !/^\s+$/u.test(source.text.slice(end, spanStart))) break
        end = spanStart + span[0].length
        const matchedForm = source.text.slice(start, end)
        const normalized = normalize(matchedForm)
        const candidate = candidates.entries.get(`exact:${normalized}`) ?? candidates.entries.get(normalized.toLowerCase())
        if (!candidate) continue
        const { row } = candidate
        const scope = wordScope(source.questionIds, row.id)
        if (seen.has(scope)) continue
        seen.add(scope)
        const { id, stage, unit, lesson, word } = row
        const hash = createHash('sha256').update(JSON.stringify([draft.content.id, scope])).digest('hex')
        matches.push({
          id: `word-bank:${hash}`, wordEntryId: id, sourceSnapshot: { stage, unit, lesson, word },
          questionIds: source.questionIds, matchSource: source.path, matchedForm, textRange: { start, end },
          sentence: segments.containing(start)?.segment.trim() || matchedForm,
          contextMeaning: row.display_chinese_def?.trim() || row.display_explanation?.trim() || word,
          role: 'background', review: { status: 'pending' },
        })
      }
    }
  }

  // Enforce the same payload bounds as ordinary draft saves without blocking a paper edit.
  let count = Math.min(matches.length, 2_000 - authored.length)
  while (count > 0) {
    const links = [...authored, ...matches.slice(0, count)]
    const updated = { ...draft, content: { ...draft.content, vocabularyLinks: links } }
    const result = validateExamDraft(updated)
    if (result.ok && Buffer.byteLength(JSON.stringify(updated)) <= 2 * 1024 * 1024 - 512) {
      return { links, matched: count, omitted: matches.length - count }
    }
    if (!result.ok && result.issues.some(issue => issue.code !== 'input_limit')) {
      throw new ExamApiError('exam_invalid_draft', 400, result.issues)
    }
    count = Math.floor(count / 2)
  }
  return { links: authored, matched: 0, omitted: matches.length }
}
