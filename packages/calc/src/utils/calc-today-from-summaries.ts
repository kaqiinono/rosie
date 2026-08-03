import type { CalcSessionSummaryRow } from '../hooks/useCalcDaily'

export function todayProgressFromSummaries(
  sessions: CalcSessionSummaryRow[],
  today: string,
): { todayProblems: number; todayCorrect: number } {
  let todayProblems = 0
  let todayCorrect = 0
  for (const s of sessions) {
    if (s.date !== today) continue
    todayProblems += (s.correct_count ?? 0) + (s.retry_count ?? 0) + (s.wrong_count ?? 0)
    todayCorrect += (s.correct_count ?? 0) + (s.retry_count ?? 0)
  }
  return { todayProblems, todayCorrect }
}
