import type { WordEntry, WordMasteryMap } from './type'
import { getMasteryLevel } from './masteryUtils'
import { KW_MAP } from './english-data'

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function hilite(text: string, word: string): string {
  const pairs = KW_MAP[word] || []
  if (!pairs.length) return escHtml(text)

  const sorted = [...pairs].sort((a, b) => b[0].length - a[0].length)
  const matches: { start: number; end: number; cls: string }[] = []

  for (const [phrase, cls] of sorted) {
    const lo = text.toLowerCase()
    const ph = phrase.toLowerCase()
    let idx = 0
    while ((idx = lo.indexOf(ph, idx)) !== -1) {
      const end = idx + phrase.length
      const overlap = matches.some(m => idx < m.end && end > m.start)
      if (!overlap) matches.push({ start: idx, end, cls })
      idx = end
    }
  }

  if (!matches.length) return escHtml(text)
  matches.sort((a, b) => a.start - b.start)

  let result = ''
  let last = 0
  for (const m of matches) {
    result += escHtml(text.slice(last, m.start))
    result += `<span class="${m.cls}">${escHtml(text.slice(m.start, m.end))}</span>`
    last = m.end
  }
  result += escHtml(text.slice(last))
  return result
}

export function highlightExample(example: string, word: string): string {
  let ex = escHtml(example)
  const candidates = [word, word.split(' ')[0]].filter((x, i, a) => a.indexOf(x) === i)
  for (const cand of candidates) {
    const escaped = escHtml(cand).replace(/[-.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp('(?<![a-zA-Z])' + escaped + '(?![a-zA-Z])', 'gi')
    const replaced = ex.replace(re, m => `<strong>${m}</strong>`)
    if (replaced !== ex) {
      ex = replaced
      break
    }
  }
  return ex
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

export function shuffle<T>(arr: T[], seed?: number): T[] {
  const a = [...arr]
  const r = rng(seed ?? Date.now())
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function getAllUnits(vocab: WordEntry[]): string[] {
  return [...new Set(vocab.map(v => v.unit))].sort()
}

export function getAllLessons(vocab: WordEntry[], selectedUnits: Set<string>): string[] {
  const src = selectedUnits.size ? vocab.filter(v => selectedUnits.has(v.unit)) : vocab
  return [...new Set(src.map(v => v.lesson))].sort()
}

export function getFilteredWords(
  vocab: WordEntry[],
  selUnits: Set<string>,
  selLessons: Set<string>,
  selWords: Set<string>,
): WordEntry[] {
  return vocab.filter(v => {
    if (selUnits.size && !selUnits.has(v.unit)) return false
    if (selLessons.size && !selLessons.has(v.lesson)) return false
    if (selWords.size && !selWords.has(v.word)) return false
    return true
  })
}

export interface DayPlan {
  day: number
  newWords: number[]
  reviewWords: number[]
  totalCount: number
  allWords: number[]
}

const DP_REVIEW_OFFSETS = [1, 3, 7, 14]
const DP_NEW_PER_DAY = 3
const DP_MAX_PER_DAY = 20

export function buildDailyPlan(totalWords: number): DayPlan[] {
  const plan: DayPlan[] = []
  const totalDays = Math.ceil(totalWords / DP_NEW_PER_DAY)

  for (let d = 1; d <= totalDays; d++) {
    const s = (d - 1) * DP_NEW_PER_DAY
    const newWords: number[] = []
    for (let i = s; i < Math.min(s + DP_NEW_PER_DAY, totalWords); i++) newWords.push(i)

    const reviewWords: number[] = []
    for (let pd = 1; pd < d; pd++) {
      if (DP_REVIEW_OFFSETS.includes(d - pd)) {
        const ps = (pd - 1) * DP_NEW_PER_DAY
        for (let i = ps; i < Math.min(ps + DP_NEW_PER_DAY, totalWords); i++) reviewWords.push(i)
      }
    }

    const combined = [...newWords]
    for (const r of reviewWords) {
      if (combined.length >= DP_MAX_PER_DAY) break
      if (!combined.includes(r)) combined.push(r)
    }

    plan.push({
      day: d,
      newWords,
      reviewWords: reviewWords.filter(r => combined.includes(r)),
      totalCount: combined.length,
      allWords: combined,
    })
  }
  return plan
}

export interface QuizQuestion {
  word: WordEntry
  type: 'A' | 'B' | 'C'
}

export function buildQuizQuestions(
  words: WordEntry[],
  types: ('A' | 'B' | 'C')[],
): QuizQuestion[] {
  const seed = Date.now()
  const shuffled = shuffle(words, seed)
  let qs = shuffled.map((w, i) => ({ word: w, type: types[i % types.length] }))
  qs = shuffle(qs, seed + 1)
  return qs
}

export function getResultEmoji(pct: number): string {
  if (pct >= 90) return '🏆'
  if (pct >= 70) return '🎉'
  if (pct >= 50) return '💪'
  return '😅'
}

export function getResultMessage(pct: number): string {
  if (pct >= 90) return '太棒了，几乎满分！'
  if (pct >= 70) return '不错哦，继续加油！'
  if (pct >= 50) return '有进步，再练练吧！'
  return '继续努力，你可以的！'
}

export function wordKey(e: WordEntry): string {
  return `${e.unit}::${e.lesson}::${e.word}`
}

export function prioritizeReviews(
  reviewIndices: number[],
  vocab: WordEntry[],
  masteryMap: WordMasteryMap,
  maxSlots: number,
): number[] {
  const sorted = [...reviewIndices].sort((a, b) => {
    const ma = masteryMap[wordKey(vocab[a])] ?? { correct: 0, incorrect: 0, lastSeen: '' }
    const mb = masteryMap[wordKey(vocab[b])] ?? { correct: 0, incorrect: 0, lastSeen: '' }
    const la = getMasteryLevel(ma.correct)
    const lb = getMasteryLevel(mb.correct)
    // mastered words go last
    if (la === 3 && lb !== 3) return 1
    if (lb === 3 && la !== 3) return -1
    // otherwise sort by correct/total ratio ascending (weaker first)
    const totalA = ma.correct + ma.incorrect
    const totalB = mb.correct + mb.incorrect
    const ratioA = totalA === 0 ? 0 : ma.correct / totalA
    const ratioB = totalB === 0 ? 0 : mb.correct / totalB
    return ratioA - ratioB
  })
  return sorted.slice(0, maxSlots)
}

export function getStuckWords(
  vocab: WordEntry[],
  masteryMap: WordMasteryMap,
  alreadyIncluded: Set<number>,
): number[] {
  const stuck: { idx: number; incorrect: number }[] = []
  vocab.forEach((entry, idx) => {
    if (alreadyIncluded.has(idx)) return
    const m = masteryMap[wordKey(entry)]
    if (m && m.incorrect >= 2 && m.correct === 0) {
      stuck.push({ idx, incorrect: m.incorrect })
    }
  })
  return stuck.sort((a, b) => b.incorrect - a.incorrect).map(s => s.idx)
}
