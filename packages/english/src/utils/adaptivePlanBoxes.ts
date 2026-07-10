import type { AdaptivePlanWordProgress } from './adaptivePlanTypes'

/** Days until next due after the word lands in this box (spec §4.3). */
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
 * On correct: if due box===5 → MASTERED; else box+1 and set next_review_date.
 * On wrong: box=1, streakWrong++, due again today so same-day re-practice can progress.
 */
export function applyBoxAnswer(
  row: AdaptivePlanWordProgress,
  correct: boolean,
  today: string,
): AdaptivePlanWordProgress {
  const box = row.boxIndex ?? 1

  if (correct) {
    if (box === 5) {
      const isDue = row.nextReviewDate == null || row.nextReviewDate <= today
      if (!isDue) {
        return {
          ...row,
          status: 'LEARNING',
          boxIndex: 5,
          streakWrong: 0,
        }
      }

      return {
        ...row,
        status: 'MASTERED',
        boxIndex: null,
        nextReviewDate: null,
        streakWrong: 0,
      }
    }
    const newBox = (box + 1) as BoxIndex
    return {
      ...row,
      boxIndex: newBox,
      streakWrong: 0,
      nextReviewDate: addCalendarDays(today, BOX_INTERVALS_DAYS[newBox]),
    }
  }

  return {
    ...row,
    boxIndex: 1,
    streakWrong: row.streakWrong + 1,
    // Keep due today so another session the same day can re-drill weak words.
    nextReviewDate: today,
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
    nextReviewDate: addCalendarDays(today, BOX_INTERVALS_DAYS[box]),
    streakWrong: 0,
  }
}
