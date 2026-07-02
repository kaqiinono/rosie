import type { AccumulationKind, AccumulationUnit } from './g1b/types'
import { shuffle } from './chinese-helpers'

export const ACCUMULATION_KIND_LABEL: Record<AccumulationKind, string> = {
  poem: '古诗',
  idiom_4: '四字词语',
  xiehouyu: '歇后语',
  proverb: '谚语',
  quote: '名言',
}

export interface AccumulationQuizItem {
  id: string
  unit: number
  kind: AccumulationKind
  prompt: string
  answer: string
  options: string[]
}

function uniqueChars(text: string): string[] {
  return [...new Set([...text].filter((c) => /[\u4e00-\u9fff]/.test(c)))]
}

function buildOptions(answer: string, pool: string[], seed: number): string[] {
  const distractors = shuffle(
    pool.filter((p) => p !== answer),
    seed,
  ).slice(0, 3)
  while (distractors.length < 3) distractors.push(answer)
  return shuffle([answer, ...distractors.slice(0, 3)], seed + 1)
}

function blankOneChar(text: string, seed: number): { display: string; answer: string } | null {
  const chars = [...text]
  const indices = chars
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => /[\u4e00-\u9fff]/.test(c))
  if (indices.length === 0) return null
  const pick = indices[seed % indices.length]
  const display = chars.map((c, i) => (i === pick.i ? '□' : c)).join('')
  return { display, answer: pick.c }
}

function buildFromUnit(unit: AccumulationUnit, allAnswers: string[]): AccumulationQuizItem[] {
  const items: AccumulationQuizItem[] = []

  unit.items.forEach((item, index) => {
    const id = `u${unit.unit}::${unit.kind}::${index}`
    const seed = id.split('').reduce((s, c) => s * 31 + c.charCodeAt(0), 3) >>> 0

    if (unit.kind === 'xiehouyu' && item.answer) {
      const prompt = `${item.text}——□`
      items.push({
        id,
        unit: unit.unit,
        kind: unit.kind,
        prompt,
        answer: item.answer,
        options: buildOptions(item.answer, allAnswers, seed),
      })
      return
    }

    if (unit.kind === 'quote' && item.source) {
      items.push({
        id,
        unit: unit.unit,
        kind: unit.kind,
        prompt: `「${item.text}」的出处是？`,
        answer: item.source,
        options: buildOptions(
          item.source,
          unit.items.map((x) => x.source).filter((s): s is string => !!s),
          seed,
        ),
      })
      return
    }

    const blank = blankOneChar(item.text, seed)
    if (!blank) return
    const charPool = uniqueChars(unit.items.map((x) => x.text).join(''))
    items.push({
      id,
      unit: unit.unit,
      kind: unit.kind,
      prompt: blank.display,
      answer: blank.answer,
      options: buildOptions(blank.answer, charPool, seed),
    })
  })

  return items
}

export function buildAccumulationQuizItems(
  units: AccumulationUnit[],
  unitFilter?: number,
): AccumulationQuizItem[] {
  const filtered = unitFilter !== undefined ? units.filter((u) => u.unit === unitFilter) : units
  const xiehouyuAnswers = units
    .filter((u) => u.kind === 'xiehouyu')
    .flatMap((u) => u.items.map((i) => i.answer).filter((a): a is string => !!a))

  return filtered.flatMap((u) =>
    buildFromUnit(u, u.kind === 'xiehouyu' ? xiehouyuAnswers : []),
  )
}
