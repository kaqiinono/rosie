/** 题目难度：1（入门）～ 5（挑战） */
export type ProblemDifficulty = 1 | 2 | 3 | 4 | 5

/** Fixed digit; `null` = blank方格; `'spacer'` = 列对齐占位（不可填、不参与组成数值）。 */
export type VerticalPuzzleCell = number | null | 'spacer'

/** Structured竖式数字谜 — rendered interactively in the answer area. */
export interface VerticalDigitPuzzleSpec {
  op: '+' | '-'
  /** Operand rows above the divider (one row for subtraction minuend, etc.). */
  operands: VerticalPuzzleCell[][]
  /** Result row below the divider. */
  result: VerticalPuzzleCell[]
  /** Optional reference fill for per-cell feedback when the puzzle has one solution. */
  solutionFills?: Record<string, number>
  /** After the addition `result`, subtract this row to get `chainResult` (e.g. L18). */
  chainSubtract?: VerticalPuzzleCell[]
  chainResult?: VerticalPuzzleCell[]
}

export const DIFFICULTY_LABELS: Record<ProblemDifficulty, string> = {
  1: '入门',
  2: '基础',
  3: '中等',
  4: '较难',
  5: '挑战',
}

export function clampDifficulty(n: number): ProblemDifficulty {
  if (n <= 1) return 1
  if (n >= 5) return 5
  return Math.round(n) as ProblemDifficulty
}

export const ALL_DIFFICULTY_LEVELS: ProblemDifficulty[] = [1, 2, 3, 4, 5]

export const DIFFICULTY_FILTER_BTNS: { key: ProblemDifficulty; label: string }[] =
  ALL_DIFFICULTY_LEVELS.map(level => ({
    key: level,
    label: `${'★'.repeat(level)}${'☆'.repeat(5 - level)} ${DIFFICULTY_LABELS[level]}`,
  }))

export function allDifficultiesSelected(selected: Set<ProblemDifficulty>): boolean {
  return ALL_DIFFICULTY_LEVELS.every(d => selected.has(d))
}
