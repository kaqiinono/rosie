import type { AnswerCheckResult, VerticalDigitPuzzleSpec, VerticalPuzzleCell } from '@rosie/core'
import { CORRECT_MESSAGE } from '@rosie/math/utils/check-problem-answer'

export type VerticalPuzzleFills = Record<string, number>

export type BlankSlot = {
  id: string
  rowKey: string
  col: number
}

function isSpacer(cell: VerticalPuzzleCell): boolean {
  return cell === 'spacer'
}

function isBlank(cell: VerticalPuzzleCell): boolean {
  return cell === null
}

function padRowLeft(row: VerticalPuzzleCell[], totalCols: number): VerticalPuzzleCell[] {
  const pad = Math.max(0, totalCols - row.length)
  return [...Array<VerticalPuzzleCell>(pad).fill('spacer'), ...row]
}

function collectRowBlanks(
  row: VerticalPuzzleCell[],
  rowKeyStr: string,
  blanks: BlankSlot[],
  nextId: { n: number },
): void {
  row.forEach((cell, col) => {
    if (isBlank(cell)) blanks.push({ id: `b${nextId.n++}`, rowKey: rowKeyStr, col })
  })
}

/** List editable blanks in stable fill order (top→bottom, left→right). */
export function listPuzzleBlanks(spec: VerticalDigitPuzzleSpec): BlankSlot[] {
  const blanks: BlankSlot[] = []
  const nextId = { n: 0 }
  spec.operands.forEach((row, ri) => collectRowBlanks(row, `op${ri}`, blanks, nextId))
  collectRowBlanks(spec.result, 'result', blanks, nextId)
  if (spec.chainSubtract) collectRowBlanks(spec.chainSubtract, 'sub', blanks, nextId)
  if (spec.chainResult) collectRowBlanks(spec.chainResult, 'final', blanks, nextId)
  return blanks
}

export function totalPuzzleCols(spec: VerticalDigitPuzzleSpec): number {
  const lengths = [
    ...spec.operands.map((r) => r.length),
    spec.result.length,
    spec.chainSubtract?.length ?? 0,
    spec.chainResult?.length ?? 0,
  ]
  return Math.max(...lengths, 1)
}

export function allBlanksFilled(spec: VerticalDigitPuzzleSpec, fills: VerticalPuzzleFills): boolean {
  return listPuzzleBlanks(spec).every((b) => fills[b.id] !== undefined)
}

/** Significant digits of a row (skip leading spacers; reject interior spacers & leading zeros). */
function significantDigits(
  row: VerticalPuzzleCell[],
  rowKeyStr: string,
  fills: VerticalPuzzleFills,
  blanks: BlankSlot[],
): number[] | null {
  let start = 0
  while (start < row.length && isSpacer(row[start])) start++

  const digits: number[] = []
  for (let col = start; col < row.length; col++) {
    const cell = row[col]
    if (isSpacer(cell)) return null
    if (typeof cell === 'number') {
      digits.push(cell)
      continue
    }
    const id = blanks.find((b) => b.rowKey === rowKeyStr && b.col === col)?.id
    if (id === undefined || fills[id] === undefined) return null
    digits.push(fills[id])
  }

  if (digits.length === 0) return null
  if (digits.length > 1 && digits[0] === 0) return null
  return digits
}

function digitsToNumber(digits: number[]): number {
  return Number(digits.join(''))
}

function rowNumber(
  row: VerticalPuzzleCell[],
  rowKeyStr: string,
  fills: VerticalPuzzleFills,
  blanks: BlankSlot[],
): number | null {
  const digits = significantDigits(row, rowKeyStr, fills, blanks)
  return digits ? digitsToNumber(digits) : null
}

/** True when filled digits satisfy the vertical equation. */
export function evaluateVerticalPuzzle(spec: VerticalDigitPuzzleSpec, fills: VerticalPuzzleFills): boolean {
  const blanks = listPuzzleBlanks(spec)

  const operandNums = spec.operands.map((row, ri) => rowNumber(row, `op${ri}`, fills, blanks))

  const resultNum = rowNumber(spec.result, 'result', fills, blanks)

  if (operandNums.some((n) => n === null) || resultNum === null) return false

  if (spec.chainSubtract && spec.chainResult) {
    if (spec.op !== '+') return false
    const sum = operandNums.reduce<number>((a, b) => a + (b as number), 0)
    if (sum !== resultNum) return false
    const subNum = rowNumber(spec.chainSubtract, 'sub', fills, blanks)
    const finalNum = rowNumber(spec.chainResult, 'final', fills, blanks)
    if (subNum === null || finalNum === null) return false
    return sum - subNum === finalNum
  }

  if (spec.op === '+') {
    return operandNums.reduce<number>((a, b) => a + (b as number), 0) === resultNum
  }

  if (operandNums.length < 2) return false
  const first = operandNums[0] as number
  const sub = operandNums.slice(1).reduce<number>((a, b) => a + (b as number), 0)
  return first - sub === resultNum
}

export function isVerticalPuzzleFills(input: unknown): input is VerticalPuzzleFills {
  if (!input || typeof input !== 'object') return false
  return Object.values(input).every((v) => typeof v === 'number' && v >= 0 && v <= 9)
}

export function makeVerticalPuzzleChecker(
  spec: VerticalDigitPuzzleSpec,
  wrongHint = '竖式还不对，从个位起检查进位或退位。',
): NonNullable<import('@rosie/core').Problem['checkAnswer']> {
  return (input: unknown): AnswerCheckResult => {
    if (!isVerticalPuzzleFills(input)) {
      return { ok: false, message: '请用下方竖式方格作答' }
    }
    if (!allBlanksFilled(spec, input)) {
      return { ok: false, message: '还有空方格没填哦' }
    }
    if (!evaluateVerticalPuzzle(spec, input)) {
      return { ok: false, message: wrongHint }
    }
    return { ok: true, message: CORRECT_MESSAGE }
  }
}

/** Left-pad a row with spacers for column alignment in the grid UI. */
export function padPuzzleRow(row: VerticalPuzzleCell[], totalCols: number): VerticalPuzzleCell[] {
  return padRowLeft(row, totalCols)
}

export function blankIdAt(
  blanks: BlankSlot[],
  rowKeyStr: string,
  col: number,
): string | undefined {
  return blanks.find((b) => b.rowKey === rowKeyStr && b.col === col)?.id
}

/** Count solutions (for authoring); caps enumeration for performance. */
export function countPuzzleSolutions(spec: VerticalDigitPuzzleSpec, limit = 10): number {
  const blanks = listPuzzleBlanks(spec)
  let count = 0

  function dfs(i: number, fills: VerticalPuzzleFills) {
    if (count >= limit) return
    if (i >= blanks.length) {
      if (evaluateVerticalPuzzle(spec, fills)) count++
      return
    }
    for (let d = 0; d <= 9; d++) {
      fills[blanks[i].id] = d
      dfs(i + 1, fills)
    }
  }

  dfs(0, {})
  return count
}
