import type { AdaptivePlanWordProgress } from './adaptivePlanTypes'

/** Legacy intervals retained for old rows/tests; V2 batch scheduling ignores dates. */
export const BOX_INTERVALS_DAYS = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 7 } as const

type BoxIndex = keyof typeof BOX_INTERVALS_DAYS

/** Calendar-day add only. Use for *writing* nextReviewDate. Due checks use string compare — see Task 3. */
export function addCalendarDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  // Local-calendar arithmetic at noon (DST-safe). Never use toISOString here:
  // it converts to UTC and shifts the DATE for UTC+13/+14 users (spec §4.4).
  const date = new Date(y, (m ?? 1) - 1, (d ?? 1) + days, 12)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * On correct: Stages 1–4 advance; Stage 5 enters Boss waiting.
 * On wrong: stay at the current stage and increment the weak-word counter.
 */
export function applyBoxAnswer(
  row: AdaptivePlanWordProgress,
  correct: boolean,
  _today: string,
): AdaptivePlanWordProgress {
  const box = row.boxIndex ?? 1

  if (correct) {
    if (box === 5) {
      // V2: passing Stage 5 enters the Boss waiting area. Boss—not Stage 5—
      // is the only path to final mastery.
      return {
        ...row,
        status: 'LEARNING_PENDING',
        boxIndex: 5,
        targetBox: null,
        nextReviewDate: null,
        streakWrong: 0,
      }
    }
    const newBox = (box + 1) as BoxIndex
    return {
      ...row,
      boxIndex: newBox,
      streakWrong: 0,
      nextReviewDate: null,
    }
  }

  return {
    ...row,
    boxIndex: box as BoxIndex,
    streakWrong: row.streakWrong + 1,
    nextReviewDate: null,
  }
}

export function activateWord(
  row: AdaptivePlanWordProgress,
  today: string,
): AdaptivePlanWordProgress {
  const box =
    row.status === 'LEARNING_PENDING' && (row.targetBox === 1 || row.targetBox === 3)
      ? row.targetBox
      : 1
  return {
    ...row,
    status: 'LEARNING',
    boxIndex: box,
    targetBox: null,
    introducedOn: today,
    // Due today until the activating session settles. Writing tomorrow here used
    // to burn the daily quota on「开始」and then hide the words if the child
    // left before 闯关 — looking like「今天暂无新任务」with unpracticed new words.
    nextReviewDate: null,
    streakWrong: 0,
  }
}

/**
 * Activated today but not yet settled (still on the landing box, no wrongs).
 * Includes the legacy shape where activateWord used to push nextReviewDate to
 * today+interval before any practice happened.
 */
export function isUnfinishedSameDayActivation(
  row: AdaptivePlanWordProgress,
  today: string,
): boolean {
  if (row.status !== 'LEARNING' || row.archivedAt != null) return false
  if (row.introducedOn !== today || row.streakWrong !== 0) return false
  const box = row.boxIndex
  if (box !== 1 && box !== 3) return false
  if (row.nextReviewDate == null || row.nextReviewDate === today) return true
  return row.nextReviewDate === addCalendarDays(today, BOX_INTERVALS_DAYS[box])
}
