import type { AdaptivePlanWordProgress } from './adaptivePlanTypes'

/** Days until next due after the word lands in this box (spec §4.3). */
export const BOX_INTERVALS_DAYS = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 7 } as const

type BoxIndex = keyof typeof BOX_INTERVALS_DAYS

/** Calendar-day add only. Use for *writing* nextReviewDate. Due checks use string compare — see Task 3. */
export function addCalendarDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T12:00:00') // noon avoids DST edge when computing the next DATE
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
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
