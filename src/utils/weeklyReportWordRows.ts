import type { WordEntry, WordMasteryInfo, WordMasteryMap, WeeklyPlan } from '@/utils/type'
import { classifyPlanWords, getDailySessionWords, wordKey } from '@/utils/english-helpers'
import {
  getWordMasteryLevel,
  MASTERY_ICON,
  ensureStageInit,
  isGraduated,
} from '@/utils/masteryUtils'
import { todayStr } from '@/utils/constant'

export type WeeklyReportWordRow = {
  key: string
  word: string
  kind: 'consolidate' | 'preview'
  unit: string
  lesson: string
  firstScheduledDay: string
  lastQuizDay: string | null
  lastScore: number | null
  didQuiz: boolean
  /** 答对次（App 累计计分） */
  correct: number
  /** 答错次 */
  incorrect: number
  /** 判题总次 = 答对 + 答错（每次选项判分累加） */
  totalGrades: number
  /** 0–100，无判题时 null */
  accuracyPercent: number | null
  reviewRounds: number
  lastSeen: string | null
  nextReviewDate: string | null
  /** 相对今天的复习剩余天数，负数为已过期 */
  daysToNextReview: number | null
  stage: number
  level: 0 | 1 | 2 | 3
  isHard: boolean
  isGraduated: boolean
}

const LEVEL_NAME: Record<0 | 1 | 2 | 3, string> = {
  0: '新接触',
  1: '起步',
  2: '巩固中',
  3: '熟练',
}

/**
 * All words in the plan (by scheduled newWordKeys), with first schedule day, daily quiz stats, and current mastery.
 */
export function buildWeeklyReportWordRows(
  plan: WeeklyPlan,
  vocab: WordEntry[],
  masteryMap: WordMasteryMap,
): WeeklyReportWordRow[] {
  const today = todayStr()
  const keyToEntry = new Map<string, WordEntry>()
  for (const w of vocab) keyToEntry.set(wordKey(w), w)
  const cls = classifyPlanWords(plan, vocab)

  const firstDay = new Map<string, string>()
  for (const day of plan.days) {
    for (const k of day.newWordKeys) {
      if (!firstDay.has(k)) firstDay.set(k, day.date)
    }
  }

  const allKeys = new Set<string>()
  for (const day of plan.days) for (const k of day.newWordKeys) allKeys.add(k)

  const rows: WeeklyReportWordRow[] = []
  for (const k of allKeys) {
    const entry = keyToEntry.get(k)
    if (!entry) continue
    const kind: 'consolidate' | 'preview' = cls.get(k) === 'preview' ? 'preview' : 'consolidate'
    const m0: WordMasteryInfo = masteryMap[k] ?? { correct: 0, incorrect: 0, lastSeen: today }
    const c = m0.correct ?? 0
    const ic = m0.incorrect ?? 0
    const totalGrades = c + ic
    const accuracyPercent
      = totalGrades > 0 ? Math.round((100 * c) / totalGrades) : null
    const m = m0.stage === undefined ? ensureStageInit(m0, today) : m0
    const level = getWordMasteryLevel(c)
    const graduated = isGraduated(m)
    const nextReview = m.nextReviewDate
    const daysToNextReview =
      !graduated && nextReview
        ? Math.round(
          (Date.parse(nextReview + 'T12:00:00') - Date.parse(today + 'T12:00:00')) / 86400000,
        )
        : null
    const reviewRounds = m0.reviewHistory?.length ?? 0
    const lastSeenDisplay = m0.lastSeen || null
    let lastQuizDay: string | null = null
    let lastScore: number | null = null
    for (let i = 0; i < plan.days.length; i += 1) {
      const date = plan.days[i].date
      const inSession = getDailySessionWords(plan, vocab, masteryMap, i).some(
        (s) => wordKey(s.entry) === k,
      )
      if (!inSession) continue
      const p = plan.progress[date]
      if (p?.quizDone) {
        lastQuizDay = date
        lastScore = p.lastScore !== undefined ? p.lastScore : null
      }
    }
    const didQuiz = lastQuizDay !== null

    rows.push({
      key: k,
      word: entry.word,
      kind,
      unit: entry.unit,
      lesson: entry.lesson,
      firstScheduledDay: firstDay.get(k) ?? plan.days[0]?.date ?? today,
      lastQuizDay,
      lastScore,
      didQuiz,
      correct: c,
      incorrect: ic,
      totalGrades,
      accuracyPercent,
      reviewRounds,
      lastSeen: lastSeenDisplay,
      nextReviewDate: graduated ? null : nextReview ?? null,
      daysToNextReview: graduated ? null : daysToNextReview,
      stage: m.stage ?? 0,
      level,
      isHard: m.isHard === true,
      isGraduated: graduated,
    })
  }

  rows.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'consolidate' ? -1 : 1
    return a.firstScheduledDay.localeCompare(b.firstScheduledDay) || a.word.localeCompare(b.word)
  })

  return rows
}

export function wordLevelName(level: 0 | 1 | 2 | 3): string {
  return LEVEL_NAME[level]
}

export { MASTERY_ICON }
