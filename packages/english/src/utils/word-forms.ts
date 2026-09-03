import type { WordEntry, WordForms, WordFormType } from '@rosie/core'

export const WORD_FORM_TYPES = [
  'plural',
  'thirdPerson',
  'presentParticiple',
  'past',
  'pastParticiple',
  'comparative',
  'superlative',
  'other',
] as const satisfies readonly WordFormType[]

export const WORD_FORM_LABELS: Record<WordFormType, string> = {
  plural: '复数',
  thirdPerson: '第三人称单数',
  presentParticiple: '现在分词',
  past: '过去式',
  pastParticiple: '过去分词',
  comparative: '比较级',
  superlative: '最高级',
  other: '其他特殊形式',
}

export interface WordFormCandidate {
  text: string
  formTypes: WordFormType[]
  source: 'base' | 'generated' | 'explicit'
}

export interface WordFormMatch extends WordFormCandidate {
  entry: WordEntry
  matchedText: string
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])

function isCvc(word: string): boolean {
  if (word.length < 3) return false
  const [a, b, c] = word.slice(-3).toLowerCase()
  return !VOWELS.has(a) && VOWELS.has(b) && !VOWELS.has(c) && !['w', 'x', 'y'].includes(c)
}

function regularThirdPerson(word: string): string {
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`
  if (/(?:s|x|z|ch|sh|o)$/i.test(word)) return `${word}es`
  return `${word}s`
}

function regularPast(word: string): string {
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ied`
  if (/e$/i.test(word)) return `${word}d`
  return `${word}${isCvc(word) ? word.at(-1) : ''}ed`
}

function regularParticiple(word: string): string {
  if (/ie$/i.test(word)) return `${word.slice(0, -2)}ying`
  if (/e$/i.test(word) && !/(?:ee|ye|oe)$/i.test(word)) return `${word.slice(0, -1)}ing`
  return `${word}${isCvc(word) ? word.at(-1) : ''}ing`
}

function regularComparative(word: string): string {
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ier`
  if (/e$/i.test(word)) return `${word}r`
  return `${word}${isCvc(word) ? word.at(-1) : ''}er`
}

function regularSuperlative(word: string): string {
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}iest`
  if (/e$/i.test(word)) return `${word}st`
  return `${word}${isCvc(word) ? word.at(-1) : ''}est`
}

function wordAliases(word: string): string[] {
  const trimmed = word.trim()
  const optionalSuffix = /^(.*?)\(([^)]+)\)(.*)$/.exec(trimmed)
  if (optionalSuffix && !/^(?:AmE|also|verb|noun|adjective|adverb)\b/i.test(optionalSuffix[2])) {
    return [
      `${optionalSuffix[1]}${optionalSuffix[3]}`,
      `${optionalSuffix[1]}${optionalSuffix[2]}${optionalSuffix[3]}`,
    ].map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean)
  }
  const labelled = /^(.+?)\s*\((?:AmE|also)\s+([^)]+)\)$/i.exec(trimmed)
  if (labelled) return [labelled[1].trim(), labelled[2].trim()]
  const withoutGrammarLabel = trimmed.replace(/\s*\((?:verb|noun|adjective|adverb)\)$/i, '')
  return withoutGrammarLabel.split(/\s+\/\s+/).map((part) => part.trim()).filter(Boolean)
}

function addCandidate(
  map: Map<string, WordFormCandidate>,
  text: string,
  formType: WordFormType | null,
  source: WordFormCandidate['source'],
) {
  const normalized = text.trim().toLowerCase()
  if (!normalized) return
  const existing = map.get(normalized)
  if (existing) {
    if (formType && !existing.formTypes.includes(formType)) existing.formTypes.push(formType)
    if (source === 'explicit') existing.source = source
    return
  }
  map.set(normalized, { text: text.trim(), formTypes: formType ? [formType] : [], source })
}

function generatedSingleWordForms(word: string): Array<[WordFormType, string]> {
  return [
    ['plural', regularThirdPerson(word)],
    ['thirdPerson', regularThirdPerson(word)],
    ['presentParticiple', regularParticiple(word)],
    ['past', regularPast(word)],
    ['pastParticiple', regularPast(word)],
    ['comparative', regularComparative(word)],
    ['superlative', regularSuperlative(word)],
  ]
}

/** Build all matchable surface forms for one entry without database access. */
export function getWordFormCandidates(entry: WordEntry): WordFormCandidate[] {
  const map = new Map<string, WordFormCandidate>()
  const disabled = new Set(entry.wordForms?.disableGenerated ?? [])

  for (const alias of wordAliases(entry.word)) {
    addCandidate(map, alias, null, 'base')
    const tokens = alias.split(/\s+/)
    const positions = tokens.length === 1 ? [0] : [0, tokens.length - 1]
    for (const position of new Set(positions)) {
      const token = tokens[position]
      if (!/^[a-z]+$/i.test(token)) continue
      for (const [type, form] of generatedSingleWordForms(token)) {
        if (disabled.has(type)) continue
        const surface = [...tokens]
        surface[position] = form
        addCandidate(map, surface.join(' '), type, 'generated')
      }
    }
  }

  for (const type of WORD_FORM_TYPES) {
    for (const form of entry.wordForms?.[type] ?? []) addCandidate(map, form, type, 'explicit')
  }
  return [...map.values()]
}

export function normalizeWordForms(value: unknown): WordForms | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const input = value as Record<string, unknown>
  const out: WordForms = {}
  for (const type of WORD_FORM_TYPES) {
    const values = input[type]
    if (!Array.isArray(values)) continue
    const cleaned = [...new Set(values.map((v) => String(v).trim()).filter(Boolean))]
    if (cleaned.length) out[type] = cleaned
  }
  if (Array.isArray(input.disableGenerated)) {
    const disabled = input.disableGenerated.filter(
      (value): value is WordFormType =>
        typeof value === 'string' && WORD_FORM_TYPES.includes(value as WordFormType),
    )
    if (disabled.length) out.disableGenerated = [...new Set(disabled)]
  }
  return Object.keys(out).length ? out : undefined
}

export function parseWordFormsCell(value: string): WordForms | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  try {
    return normalizeWordForms(JSON.parse(trimmed))
  } catch {
    throw new Error(`word_forms 不是有效 JSON：${trimmed}`)
  }
}
