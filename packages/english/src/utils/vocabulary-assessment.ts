const LEVELS_DESCENDING = ['C2', 'C1', 'B2', 'B1', 'A2', 'A1'] as const
export type VocabularyLevel = typeof LEVELS_DESCENDING[number]
export type AssessmentWordList = 'KET' | 'PET' | 'FCE'
const FALLBACK_LEVEL: Record<AssessmentWordList, VocabularyLevel> = { KET: 'A2', PET: 'B1', FCE: 'B2' }

export type VocabularyAssessmentCandidate = {
  headwordId: string
  senseId: string
  word: string
  partOfSpeech: string
  context?: string
  requiresContext?: boolean
  /** Only memberships that explicitly cover the candidate's sense. */
  wordLists: readonly AssessmentWordList[]
  cefr?: VocabularyLevel
}

export type VocabularyAssessmentItem = VocabularyAssessmentCandidate & {
  level: VocabularyLevel
  levelSource: 'cefr' | 'word_list'
}

function itemFor(
  candidate: VocabularyAssessmentCandidate,
  scope: ReadonlySet<AssessmentWordList>,
): VocabularyAssessmentItem | null {
  if (!candidate.partOfSpeech.trim() || (candidate.requiresContext && !candidate.context?.trim())) return null
  if (!candidate.wordLists.some((list) => scope.has(list))) return null
  if (candidate.cefr) return { ...candidate, level: candidate.cefr, levelSource: 'cefr' }
  const fallback = LEVELS_DESCENDING.findLast((level) =>
    candidate.wordLists.some((list) => scope.has(list) && FALLBACK_LEVEL[list] === level),
  )
  return fallback ? { ...candidate, level: fallback, levelSource: 'word_list' } : null
}

export function sampleVocabularyAssessment(
  candidates: readonly VocabularyAssessmentCandidate[],
  wordLists: readonly AssessmentWordList[],
  quotas: Partial<Record<VocabularyLevel, number>>,
  random: () => number = Math.random,
) {
  const scope = new Set(wordLists)
  const strata = new Map<VocabularyLevel, Map<string, Map<string, VocabularyAssessmentItem>>>()
  const sensesByPartOfSpeech = new Map<string, Set<string>>()
  const partOfSpeechKey = (candidate: VocabularyAssessmentCandidate) =>
    JSON.stringify([candidate.headwordId, candidate.partOfSpeech.trim().toLowerCase()])
  for (const candidate of candidates) {
    const key = partOfSpeechKey(candidate)
    const senses = sensesByPartOfSpeech.get(key) ?? new Set<string>()
    senses.add(candidate.senseId)
    sensesByPartOfSpeech.set(key, senses)
  }
  for (const candidate of candidates) {
    const ambiguous = (sensesByPartOfSpeech.get(partOfSpeechKey(candidate))?.size ?? 0) > 1
    if (ambiguous && !candidate.context?.trim()) continue
    const item = itemFor(candidate, scope)
    if (!item) continue
    const group = strata.get(item.level) ?? new Map<string, Map<string, VocabularyAssessmentItem>>()
    const senses = group.get(item.headwordId) ?? new Map<string, VocabularyAssessmentItem>()
    senses.set(item.senseId, item)
    group.set(item.headwordId, senses)
    strata.set(item.level, group)
  }

  const used = new Set<string>()
  const items: VocabularyAssessmentItem[] = []
  const coverage: Partial<Record<VocabularyLevel, { requested: number; sampled: number; fallback: number }>> = {}
  for (const level of LEVELS_DESCENDING) {
    const requested = quotas[level] ?? 0
    if (!Number.isSafeInteger(requested) || requested < 0) throw new RangeError('Invalid assessment quota')
    if (requested === 0) continue
    const pool = Array.from(strata.get(level) ?? []).filter(([headwordId]) => !used.has(headwordId))
    const sampled = Math.min(requested, pool.length)
    let fallback = 0
    for (let index = 0; index < sampled; index++) {
      const swap = index + Math.floor(random() * (pool.length - index))
      const current = pool[index]
      pool[index] = pool[swap]
      pool[swap] = current
      const options = Array.from(pool[index][1].values())
      const item = options[Math.floor(random() * options.length)]
      used.add(item.headwordId)
      items.push(item)
      if (item.levelSource === 'word_list') fallback++
    }
    coverage[level] = { requested, sampled, fallback }
  }
  return { items, coverage }
}
