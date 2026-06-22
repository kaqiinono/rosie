import type { WordEntry, WordMasteryMap, WeeklyPlanDay, WeeklyPlan, QuizType, QuizQuestion } from '@rosie/core'
import { getWordMasteryLevel, ensureStageInit, isGraduated, MASTERY_THRESHOLD, CONSOLIDATE_PASS_STAGE } from './masteryUtils'

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function hilite(text: string, keywords?: [string, string][]): string {
  const pairs = keywords ?? []
  if (!pairs.length) return escHtml(text)

  const sorted = [...pairs].sort((a, b) => b[0].length - a[0].length)
  const matches: { start: number; end: number; cls: string }[] = []

  for (const [phrase, cls] of sorted) {
    const lo = text.toLowerCase()
    const ph = phrase.toLowerCase()
    if (!ph) continue // 空短语会让 indexOf 在每个位置命中、死循环
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

/** 把关键词高亮的颜色值规整成 globals.css 里的 .kw-* 类名 */
export function normalizeKwColor(c: string): string {
  const t = c.trim().toLowerCase()
  if (!t) return 'kw-red'
  if (t.startsWith('kw-')) return t
  if (t === 'red' || t === '红') return 'kw-red'
  if (t === 'gold' || t === 'yellow' || t === '金' || t === '黄') return 'kw-gold'
  if (t === 'blue' || t === '蓝') return 'kw-blue'
  return 'kw-red'
}

/** 解析音节单元格：逗号分隔 → string[]，如 "ap, ple" */
export function parseSyllablesCell(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean)
}

/** 解析关键词高亮单元格：`词|颜色; 词|颜色` → [短语, kw-类名][]，颜色支持 red/gold/blue 或 kw-* */
export function parseKeywordsCell(s: string): [string, string][] {
  return s
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((part) => {
      const [phrase, color] = part.split('|')
      return [(phrase ?? '').trim(), normalizeKwColor(color ?? '')] as [string, string]
    })
    .filter(([ph]) => ph.length > 0)
}

export const WORD_TEMPLATE_HEADERS = [
  'Stage',
  'Unit',
  'Lesson',
  '单词 (word)',
  '英文释义 (explanation)',
  '中文释义 (chinese)',
  '音标 (ipa)',
  '例句 (example)',
  'phonics',
  '音节 (syllables, 逗号分隔)',
  '关键词高亮 (词|颜色; 颜色=red/gold/blue)',
]

/**
 * 把二维表格行解析成 WordEntry[]，供 Excel 导入与文本粘贴共用。
 * 列顺序（含 stage 时）：Stage, Unit, Lesson, Word, Explanation, ChineseDef, IPA,
 * Example, Phonics, Syllables(逗号分隔), Keywords(词|颜色; 词|颜色)。
 * - hasHeader: 跳过首行表头（Excel 导出通常带表头）。
 * - hasStageColumn: 行内是否含 stage 列；为 false 时整体左移一列，stage 取 defaultStage。
 * - defaultStage: stage 为空时回填（粘贴场景下用当前选中的词库）。
 * 缺 unit / lesson / word 的行会被跳过；后面的列缺省即留空。
 */
export function parseWordRows(
  rows: unknown[][],
  opts: { hasHeader?: boolean; hasStageColumn?: boolean; defaultStage?: string } = {},
): WordEntry[] {
  const { hasHeader = false, hasStageColumn = true, defaultStage } = opts
  const out: WordEntry[] = []
  const off = hasStageColumn ? 1 : 0
  const cell = (r: unknown[], i: number) => String(r[i] ?? '').trim()
  for (let i = hasHeader ? 1 : 0; i < rows.length; i++) {
    const r = rows[i]
    if (!r) continue
    const stage = hasStageColumn ? cell(r, 0) : ''
    const unit = cell(r, off)
    const lesson = cell(r, off + 1)
    const word = cell(r, off + 2)
    if (!unit || !lesson || !word) continue
    const syllables = parseSyllablesCell(cell(r, off + 8))
    const keywords = parseKeywordsCell(cell(r, off + 9))
    out.push({
      stage: stage || defaultStage || undefined,
      unit,
      lesson,
      word,
      explanation: cell(r, off + 3),
      chineseDef: cell(r, off + 4) || undefined,
      ipa: cell(r, off + 5) || undefined,
      example: cell(r, off + 6) || undefined,
      phonics: cell(r, off + 7) || undefined,
      syllables: syllables.length ? syllables : undefined,
      keywords: keywords.length ? keywords : undefined,
    })
  }
  return out
}

export function getAllStages(vocab: WordEntry[]): string[] {
  return [...new Set(vocab.map(v => v.stage).filter((s): s is string => !!s))].sort()
}

export function getAllUnits(vocab: WordEntry[], selStage?: string): string[] {
  const src = selStage ? vocab.filter(v => !v.stage || v.stage === selStage) : vocab
  return [...new Set(src.map(v => v.unit))].sort()
}

export function getAllLessons(vocab: WordEntry[], selectedUnits: Set<string>): string[] {
  const src = selectedUnits.size ? vocab.filter(v => selectedUnits.has(v.unit)) : vocab
  return [...new Set(src.map(v => v.lesson))].sort()
}

export function getFilteredWords(
  vocab: WordEntry[],
  selStage: string,
  selUnits: Set<string>,
  selLessons: Set<string>,
  selWords: Set<string>,
): WordEntry[] {
  return vocab.filter(v => {
    if (selStage && v.stage && v.stage !== selStage) return false
    if (selUnits.size && !selUnits.has(v.unit)) return false
    if (selLessons.size && !selLessons.has(`${v.unit}::${v.lesson}`)) return false
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

const QUIZ_TYPE_ORDER: QuizType[] = ['A', 'B', 'C', 'D']

/** Selected types in difficulty order (A → B → C → D), ignoring duplicates. */
export function normalizeQuizTypes(types: QuizType[]): QuizType[] {
  const set = new Set(types)
  return QUIZ_TYPE_ORDER.filter(t => set.has(t))
}

/**
 * Randomly interleave several ordered sequences without reordering within each sequence.
 * Used so each word’s quiz stays A → B → C while the global order stays unpredictable.
 */
export function interleaveOrderedQuizSlots<T>(groups: T[][], seed: number, minGap = 3): T[] {
  const pointers = groups.map(() => 0)
  const r = rng(seed)
  const out: T[] = []
  const total = groups.reduce((s, g) => s + g.length, 0)
  // Cap gap to the number of words minus one — the maximum that can ever be honoured.
  const gap = Math.min(minGap, groups.length - 1)
  const recentPicks: number[] = []
  for (let n = 0; n < total; n++) {
    const available: number[] = []
    for (let i = 0; i < groups.length; i++) {
      if (pointers[i]! < groups[i]!.length) available.push(i)
    }
    if (available.length === 0) break
    const recentSet = new Set(recentPicks)
    const filtered = available.filter(i => !recentSet.has(i))
    // Gap is a soft constraint — when it would exclude every remaining group,
    // fall back to the full available set so we don't pick `undefined`.
    const pool = filtered.length > 0 ? filtered : available
    const pick = pool[Math.floor(r() * pool.length)]!
    out.push(groups[pick]![pointers[pick]!]!)
    pointers[pick]!++
    recentPicks.push(pick)
    if (recentPicks.length > gap) recentPicks.shift()
  }
  return out
}

export interface DailySessionWord {
  entry: WordEntry
  kind: 'consolidate' | 'preview'
  /** true iff this is a consolidate word whose mastery stage >= 2 */
  met: boolean
}

/**
 * Build quiz questions: per word, types run A → B → C → D (subset chosen); words are shuffled;
 * global order is a random interleaving so other words’ later types may appear before this
 * word’s A, but never this word’s later types before its A.
 *
 * Type D (课文语境填空) is only generated for words for which `eligibleForTypeD` returns
 * true. Words that don't satisfy the predicate simply skip the D slot.
 */
export function buildQuizQuestions(
  words: WordEntry[],
  types: QuizType[],
  seed = Date.now(),
  eligibleForTypeD?: (entry: WordEntry) => boolean,
): QuizQuestion[] {
  const orderedTypes = normalizeQuizTypes(types)
  if (!orderedTypes.length || !words.length) return []
  const shuffledWords = shuffle(words, seed)
  const groups: QuizQuestion[][] = shuffledWords.map(w =>
    orderedTypes
      .filter(type => type !== 'D' || (eligibleForTypeD ? eligibleForTypeD(w) : false))
      .map(type => ({ word: w, type })),
  )
  return interleaveOrderedQuizSlots(groups, seed + 1)
}

/** Count of alphabetic characters in `s` (spaces/punctuation excluded). */
export function letterCount(s: string): number {
  let n = 0
  for (const ch of s) if (/[a-zA-Z]/.test(ch)) n++
  return n
}

/** Mask all-but-first-`revealed`-letters of `word`, preserving spaces/punctuation/case. */
export function maskWord(word: string, revealed: number): string {
  let shown = 0
  let out = ''
  for (const ch of word) {
    if (/[a-zA-Z]/.test(ch)) {
      if (shown < revealed) {
        out += ch
        shown++
      } else {
        out += '_'
      }
    } else {
      out += ch
    }
  }
  return out
}

/**
 * Replace the first whole-word occurrence of `word` in `example` with a masked
 * version where the first `revealed` letters are shown and the rest become
 * underscores. Returns the example unchanged if no match is found.
 */
export function maskWordInExample(example: string, word: string, revealed: number): string {
  const escaped = word.replace(/[-.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp('(?<![a-zA-Z])' + escaped + '(?![a-zA-Z])', 'i')
  return example.replace(re, (m) => maskWord(m, revealed))
}

/**
 * Build reinforcement Type-C questions for words the user asked for help on.
 * Each word gets one repetition per click. Reps are interleaved so the same
 * word never appears adjacent within `minGap`.
 */
export function buildReinforcementQuestions(
  helpClicks: Record<string, number>,
  vocab: WordEntry[],
  keyOf: (w: WordEntry) => string,
  seed: number,
  minGap = 3,
): QuizQuestion[] {
  const groups: QuizQuestion[][] = []
  for (const [k, count] of Object.entries(helpClicks)) {
    if (count <= 0) continue
    const entry = vocab.find(w => keyOf(w) === k)
    if (!entry) continue
    const reps: QuizQuestion[] = []
    for (let i = 0; i < count; i++) reps.push({ word: entry, type: 'C' })
    groups.push(reps)
  }
  if (!groups.length) return []
  return interleaveOrderedQuizSlots(groups, seed, minGap)
}

/**
 * Build 错题补练 (wrong-answer reinforcement): one repetition per word the learner
 * missed (final verdict wrong — i.e. wrong even after the in-question gentle retry),
 * re-drilled in the word's original question type. Type-C words get a half-letter
 * reveal hint so the re-drill stays gentle. Interleaved so a word never repeats
 * within `minGap`. Appended at the end of a practice/review main pass.
 */
export function buildWrongAnswerReinforcement(
  wrongItems: { entry: WordEntry; type: QuizType }[],
  seed: number,
  minGap = 3,
): QuizQuestion[] {
  if (!wrongItems.length) return []
  const groups: QuizQuestion[][] = wrongItems.map((it) => [{
    word: it.entry,
    type: it.type,
    revealedHalf:
      it.type === 'C' ? Math.ceil(it.entry.word.length / 2) : undefined,
  }])
  return interleaveOrderedQuizSlots(groups, seed, minGap)
}

// Rescue reinforcement batches (review carousel words + interleaved practice) are
// assembled in useRescueQueue.buildBatches — kept there so they share the live queue.

/** Longest common prefix length (ASCII), for morphologically related forms (interest / interesting / interested). */
function morphAffinity(a: string, b: string): number {
  const x = a.toLowerCase()
  const y = b.toLowerCase()
  if (x === y) return 0
  let i = 0
  const m = Math.min(x.length, y.length)
  while (i < m && x[i] === y[i]) i++
  let score = i
  if (i >= 4 && (x.startsWith(y) || y.startsWith(x))) score += 4
  return score
}

function cnCharOverlap(a: string, b: string): number {
  const ma = a.match(/[\u4e00-\u9fff]/g)
  const mb = b.match(/[\u4e00-\u9fff]/g)
  if (!ma?.length || !mb?.length) return 0
  const set = new Set(ma)
  return mb.filter(c => set.has(c)).length
}

function distractorScore(correct: WordEntry, candidate: WordEntry): number {
  return morphAffinity(correct.word, candidate.word) * 14 + cnCharOverlap(correct.explanation, candidate.explanation)
}

/**
 * Build 4 multiple-choice options for a quiz question.
 * Prefers distractors from the same lesson, ranked by word-form similarity and overlapping
 * gloss characters (同一课近义/同根词更容易进选项).
 * Uses a deterministic seed so options stay stable across re-renders.
 */
export function buildQuizOptions(
  correctWord: WordEntry,
  pool: WordEntry[],
  seed: number,
): WordEntry[] {
  const others = pool.filter(w => w.word !== correctWord.word)
  const sameLesson = others.filter(w => w.unit === correctWord.unit && w.lesson === correctWord.lesson)

  const rankPool =
    sameLesson.length >= 3
      ? [...sameLesson].sort((a, b) => distractorScore(correctWord, b) - distractorScore(correctWord, a))
      : [...others].sort((a, b) => distractorScore(correctWord, b) - distractorScore(correctWord, a))

  const head = rankPool.slice(0, Math.min(12, rankPool.length))
  const picked = shuffle(head, seed).slice(0, 3)
  return shuffle([correctWord, ...picked], seed + 10)
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
    const la = getWordMasteryLevel(ma.correct)
    const lb = getWordMasteryLevel(mb.correct)
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

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const ALL_CN_DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function fmtDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}/${Number(d)}`
}

export function fmtWeekRange(weekStart: string, startDay: number): string {
  const [y, m, day] = weekStart.split('-').map(Number)
  const end = new Date(y, m - 1, day + 6)
  const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  return `${fmtDate(weekStart)} ${ALL_CN_DAYS[startDay]} – ${fmtDate(endStr)} ${ALL_CN_DAYS[(startDay + 6) % 7]}`
}

export function getWeekStart(date?: Date, startDay = 4): string {
  const d = date ? new Date(date) : new Date()
  const daysBack = (d.getDay() - startDay + 7) % 7
  d.setDate(d.getDate() - daysBack)
  return toLocalDateStr(d)
}

/**
 * Distributes words across 7 days in parallel across lessons.
 *
 * `lessonGroups`  — one array of WordEntry per lesson (in selection order)
 * `quotasPerDay`  — per-lesson daily word count (same index as lessonGroups)
 *
 * Each day gets exactly `quotasPerDay[g]` words from group `g` (or fewer if
 * the group is exhausted). Words beyond 7 × quota are left unassigned and
 * returned separately in `unassigned`.
 */
export function buildWeeklyPlan(
  lessonWords: WordEntry[],
  weekStart: string,
  newPerDay?: number,
  lessonGroups?: WordEntry[][],
  quotasPerDay?: number[],
): { days: WeeklyPlanDay[]; unassigned: string[] } {
  const [year, month, day] = weekStart.split('-').map(Number)

  const groups = lessonGroups && lessonGroups.length > 0 ? lessonGroups : [lessonWords]
  const perDay = newPerDay ?? 3

  // Resolve per-lesson daily quotas
  let quotas: number[]
  if (quotasPerDay && quotasPerDay.length === groups.length) {
    quotas = quotasPerDay
  } else {
    // Proportional fallback (legacy single value)
    const total = groups.reduce((s, g) => s + g.length, 0)
    if (groups.length === 1 || total === 0) {
      quotas = groups.map(() => perDay)
    } else {
      const exact = groups.map(g => (perDay * g.length) / total)
      const floors = exact.map(Math.floor)
      let rem = perDay - floors.reduce((a, b) => a + b, 0)
      const frac = exact.map((v, i) => ({ i, frac: v - floors[i] })).sort((a, b) => b.frac - a.frac)
      quotas = [...floors]
      for (const { i } of frac) {
        if (rem <= 0) break
        quotas[i]++
        rem--
      }
    }
  }

  const pointers = groups.map(() => 0)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(year, month - 1, day + i)
    const keys: string[] = []
    for (let g = 0; g < groups.length; g++) {
      const slice = groups[g].slice(pointers[g], pointers[g] + quotas[g])
      slice.forEach(w => keys.push(wordKey(w)))
      pointers[g] += quotas[g]
    }
    return { date: toLocalDateStr(d), newWordKeys: keys }
  })

  // Collect words that didn't fit in 7 days
  const assignedSet = new Set(days.flatMap(d => d.newWordKeys))
  const unassigned = groups
    .flatMap(g => g)
    .map(w => wordKey(w))
    .filter(k => !assignedSet.has(k))

  return { days, unassigned }
}

/**
 * Returns all words due for spaced-repetition review today (including overdue),
 * excluding words that appear in any of `excludeWeekPlans` (typically the current
 * and next week's plans — see spec §3.6). Excludes graduated words.
 * Sorted by overdue days desc, then stage asc.
 *
 * Words that appear in any of `excludeWeekPlans` are omitted — they are handled
 * by the weekly plan session and should not appear in the old-review pool.
 */
export function getOldReviewWords(
  vocab: WordEntry[],
  masteryMap: WordMasteryMap,
  excludeWeekPlans: WeeklyPlan[] = [],
): WordEntry[] {
  const today = new Date().toISOString().slice(0, 10)
  const excludeKeys = new Set<string>()
  for (const plan of excludeWeekPlans) {
    for (const day of plan.days) for (const k of day.newWordKeys) excludeKeys.add(k)
  }
  return vocab
    .filter(w => {
      const k = wordKey(w)
      if (excludeKeys.has(k)) return false
      const m = masteryMap[k]
      if (!m || isGraduated(m)) return false
      const init = ensureStageInit(m, today)
      const due = init.nextReviewDate ?? today
      return due <= today
    })
    .map(w => {
      const m = ensureStageInit(masteryMap[wordKey(w)]!, today)
      const overdueDays = Math.max(
        0,
        Math.floor((Date.parse(today) - Date.parse(m.nextReviewDate ?? today)) / 86400000),
      )
      return { w, overdueDays, stage: m.stage ?? 0 }
    })
    .sort((a, b) => b.overdueDays - a.overdueDays || a.stage - b.stage)
    .map(({ w }) => w)
}

export type WordKind = 'consolidate' | 'preview'

/** Abbreviate a lesson label to "L<n>" (first number found); fall back to raw label. */
export function lessonAbbr(lesson: string): string {
  const m = lesson.match(/\d+/)
  return m ? `L${m[0]}` : lesson
}

/** Abbreviate a unit to its first+last char, uppercased: "Application"→"AN", "unit2"→"U2". */
export function unitAbbr(unit: string): string {
  const u = unit.trim()
  if (!u) return ''
  return (u[0] + u[u.length - 1]).toUpperCase()
}

/** Combined word-chip sub-label: unit abbr + lesson abbr, e.g. "ANL1" / "U2L1". */
export function lessonChipTag(unit: string, lesson: string): string {
  return `${unitAbbr(unit)}${lessonAbbr(lesson)}`
}

export function getOrderedLessons(vocab: WordEntry[]): { unit: string; lesson: string }[] {
  const seen = new Set<string>()
  const result: { unit: string; lesson: string }[] = []
  for (const w of vocab) {
    const key = `${w.unit}::${w.lesson}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push({ unit: w.unit, lesson: w.lesson })
    }
  }
  return result
}

/**
 * Classify every word referenced by a plan as consolidate (must-memorize this week)
 * or preview (first-touch, next week's consolidate).
 *
 * When `plan.previewLessonKeys` is set (including `[]`), words whose
 * `(unit, lesson)` is listed there are 'preview'; all others are 'consolidate'.
 *
 * When `plan.previewLessonKeys` is omitted (legacy rows), find the (unit, lesson)
 * pairs covered by the plan, pick the one that appears latest in
 * `getOrderedLessons(vocab)`, and mark its words as 'preview'. All others are
 * 'consolidate'. A single-lesson plan has no preview words.
 *
 * When `plan.wordKinds` is set, each listed key overrides the lesson-based
 * classification for that word (edit page / per-word tuning).
 */
export function classifyPlanWords(
  plan: WeeklyPlan,
  vocab: WordEntry[],
): Map<string, 'consolidate' | 'preview'> {
  const result = new Map<string, 'consolidate' | 'preview'>()

  const planKeys = new Set<string>()
  for (const day of plan.days) for (const k of day.newWordKeys) planKeys.add(k)
  if (planKeys.size === 0) return result

  const keyToEntry = new Map<string, WordEntry>()
  for (const w of vocab) keyToEntry.set(wordKey(w), w)

  if (plan.previewLessonKeys !== undefined) {
    const previewSet = new Set(plan.previewLessonKeys)
    for (const k of planKeys) {
      const entry = keyToEntry.get(k)
      if (!entry) continue
      const lk = `${entry.unit}::${entry.lesson}`
      result.set(k, previewSet.has(lk) ? 'preview' : 'consolidate')
    }
  } else {
    const lessonsInPlan = new Set<string>()
    for (const k of planKeys) {
      const entry = keyToEntry.get(k)
      if (entry) lessonsInPlan.add(`${entry.unit}::${entry.lesson}`)
    }

    const ordered = getOrderedLessons(vocab)
    let previewLessonKey: string | null = null
    if (lessonsInPlan.size >= 2) {
      for (let i = ordered.length - 1; i >= 0; i--) {
        const key = `${ordered[i].unit}::${ordered[i].lesson}`
        if (lessonsInPlan.has(key)) {
          previewLessonKey = key
          break
        }
      }
    }

    for (const k of planKeys) {
      const entry = keyToEntry.get(k)
      if (!entry) continue
      const lk = `${entry.unit}::${entry.lesson}`
      result.set(k, lk === previewLessonKey ? 'preview' : 'consolidate')
    }
  }

  if (plan.wordKinds) {
    for (const k of planKeys) {
      const w = plan.wordKinds[k]
      if (w === 'consolidate' || w === 'preview') result.set(k, w)
    }
  }
  return result
}

/**
 * Returns every word introduced in plan.days[0..dayIndex] (union), tagged with
 * consolidate/preview classification and sorted:
 *   1. consolidate & not yet met (stage < 2): stage asc, correct asc, incorrect desc
 *   2. consolidate & met (stage >= 2)
 *   3. preview (plan insertion order)
 *
 * No 9-cap, no old-review mixing. See spec §3.2.
 */
export function getDailySessionWords(
  plan: WeeklyPlan,
  vocab: WordEntry[],
  masteryMap: WordMasteryMap,
  dayIndex: number,
): DailySessionWord[] {
  if (dayIndex < 0 || dayIndex >= plan.days.length) return []
  const cls = classifyPlanWords(plan, vocab)

  const seen = new Set<string>()
  const introducedOrder: string[] = []
  for (let i = 0; i <= dayIndex; i++) {
    for (const k of plan.days[i].newWordKeys) {
      if (!seen.has(k)) {
        seen.add(k)
        introducedOrder.push(k)
      }
    }
  }

  const keyToEntry = new Map<string, WordEntry>()
  for (const w of vocab) keyToEntry.set(wordKey(w), w)

  type Bucket = DailySessionWord & { order: number }
  const consolidateUnmet: Bucket[] = []
  const consolidateMet: Bucket[] = []
  const preview: Bucket[] = []

  introducedOrder.forEach((k, order) => {
    const entry = keyToEntry.get(k)
    if (!entry) return
    const kind = cls.get(k) ?? 'consolidate'
    const m = masteryMap[k]
    const stage = m?.stage ?? 0
    const met = stage >= CONSOLIDATE_PASS_STAGE
    const item: Bucket = { entry, kind, met, order }
    if (kind === 'preview') preview.push(item)
    else if (met) consolidateMet.push(item)
    else consolidateUnmet.push(item)
  })

  consolidateUnmet.sort((a, b) => {
    const ma = masteryMap[wordKey(a.entry)]
    const mb = masteryMap[wordKey(b.entry)]
    const sa = ma?.stage ?? 0
    const sb = mb?.stage ?? 0
    if (sa !== sb) return sa - sb
    const ca = ma?.correct ?? 0
    const cb = mb?.correct ?? 0
    if (ca !== cb) return ca - cb
    const ia = ma?.incorrect ?? 0
    const ib = mb?.incorrect ?? 0
    return ib - ia
  })
  consolidateMet.sort((a, b) => a.order - b.order)
  preview.sort((a, b) => a.order - b.order)

  return [...consolidateUnmet, ...consolidateMet, ...preview].map(({ entry, kind, met }) => ({
    entry, kind, met,
  }))
}

export function suggestNextLesson(
  vocab: WordEntry[],
  lastUnit: string,
  lastLesson: string,
): { unit: string; lesson: string } | null {
  const ordered = getOrderedLessons(vocab)
  const idx = ordered.findIndex(l => l.unit === lastUnit && l.lesson === lastLesson)
  if (idx === -1 || idx >= ordered.length - 1) return null
  return ordered[idx + 1]
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
