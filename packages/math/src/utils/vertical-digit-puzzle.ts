import type {
  AnswerCheckResult,
  VerticalDigitPuzzleSpec,
  VerticalPuzzleBlock,
  VerticalPuzzleCell,
  VerticalPuzzleSymbolCell,
} from '@rosie/core'
import { CORRECT_MESSAGE } from '@rosie/math/utils/check-problem-answer'

export type VerticalPuzzleFills = Record<string, number>

export type BlankSlot = {
  id: string
  rowKey: string
  col: number
  sym?: string
}

function isSymbolCell(cell: VerticalPuzzleCell): cell is VerticalPuzzleSymbolCell {
  return typeof cell === 'object' && cell !== null && 'sym' in cell
}

function isSpacer(cell: VerticalPuzzleCell): boolean {
  return cell === 'spacer'
}

function isEditableBlank(cell: VerticalPuzzleCell): boolean {
  if (cell === null) return true
  if (isSymbolCell(cell)) return cell.fixed === undefined
  return false
}

function symOf(cell: VerticalPuzzleCell): string | undefined {
  if (isSymbolCell(cell)) return cell.sym
  return undefined
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
    if (!isEditableBlank(cell)) return
    blanks.push({ id: `b${nextId.n++}`, rowKey: rowKeyStr, col, sym: symOf(cell) })
  })
}

function collectBlockBlanks(
  block: VerticalPuzzleBlock,
  prefix: string,
  blanks: BlankSlot[],
  nextId: { n: number },
): void {
  block.operands.forEach((row, ri) => collectRowBlanks(row, `${prefix}op${ri}`, blanks, nextId))
  collectRowBlanks(block.result, `${prefix}result`, blanks, nextId)
}

function collectSpecBlanks(spec: VerticalDigitPuzzleSpec, prefix: string, blanks: BlankSlot[]): void {
  const nextId = { n: blanks.length }
  spec.operands.forEach((row, ri) => collectRowBlanks(row, `${prefix}op${ri}`, blanks, nextId))
  collectRowBlanks(spec.result, `${prefix}result`, blanks, nextId)
  if (spec.chainSubtract) collectRowBlanks(spec.chainSubtract, `${prefix}sub`, blanks, nextId)
  if (spec.chainResult) collectRowBlanks(spec.chainResult, `${prefix}final`, blanks, nextId)
  spec.blocks?.forEach((block, bi) => collectBlockBlanks(block, `${prefix}blk${bi}_`, blanks, nextId))
}

/** List editable blanks in stable fill order (top→bottom, left→right). */
export function listPuzzleBlanks(spec: VerticalDigitPuzzleSpec): BlankSlot[] {
  const blanks: BlankSlot[] = []
  collectSpecBlanks(spec, '', blanks)
  return blanks
}

function rowLengths(spec: VerticalDigitPuzzleSpec): number[] {
  const lengths = [
    ...spec.operands.map((r) => r.length),
    spec.result.length,
    spec.chainSubtract?.length ?? 0,
    spec.chainResult?.length ?? 0,
  ]
  for (const block of spec.blocks ?? []) {
    lengths.push(...block.operands.map((r) => r.length), block.result.length)
  }
  return lengths
}

export function totalPuzzleCols(spec: VerticalDigitPuzzleSpec): number {
  return Math.max(...rowLengths(spec), 1)
}

export function blockPuzzleCols(block: VerticalPuzzleBlock): number {
  return Math.max(...block.operands.map((r) => r.length), block.result.length, 1)
}

export function allBlanksFilled(spec: VerticalDigitPuzzleSpec, fills: VerticalPuzzleFills): boolean {
  return listPuzzleBlanks(spec).every((b) => fills[b.id] !== undefined)
}

function getRowFromSpec(
  spec: VerticalDigitPuzzleSpec,
  rowKeyStr: string,
): VerticalPuzzleCell[] | null {
  if (rowKeyStr.startsWith('blk')) {
    const m = rowKeyStr.match(/^blk(\d+)_(op\d+|result)$/)
    if (!m) return null
    const block = spec.blocks?.[Number(m[1])]
    if (!block) return null
    if (m[2] === 'result') return block.result
    const ri = Number(m[2].slice(2))
    return block.operands[ri] ?? null
  }

  if (rowKeyStr.startsWith('op')) {
    const ri = Number(rowKeyStr.slice(2))
    return spec.operands[ri] ?? null
  }
  if (rowKeyStr === 'result') return spec.result
  if (rowKeyStr === 'sub') return spec.chainSubtract ?? null
  if (rowKeyStr === 'final') return spec.chainResult ?? null
  return null
}

function resolveDigit(
  cell: VerticalPuzzleCell,
  rowKeyStr: string,
  col: number,
  fills: VerticalPuzzleFills,
  blanks: BlankSlot[],
  knownSymbols: Record<string, number> | undefined,
): number | undefined {
  if (typeof cell === 'number') return cell
  if (isSymbolCell(cell)) {
    if (cell.fixed !== undefined) return cell.fixed
    const known = knownSymbols?.[cell.sym]
    if (known !== undefined) return known
  }
  const id = blanks.find((b) => b.rowKey === rowKeyStr && b.col === col)?.id
  if (id !== undefined && fills[id] !== undefined) return fills[id]
  return undefined
}

/** Significant digits of a row (skip leading spacers; reject interior spacers & leading zeros). */
function significantDigits(
  row: VerticalPuzzleCell[],
  rowKeyStr: string,
  fills: VerticalPuzzleFills,
  blanks: BlankSlot[],
  knownSymbols: Record<string, number> | undefined,
): number[] | null {
  let start = 0
  while (start < row.length && isSpacer(row[start])) start++

  const digits: number[] = []
  for (let col = start; col < row.length; col++) {
    const cell = row[col]
    if (isSpacer(cell)) return null
    const d = resolveDigit(cell, rowKeyStr, col, fills, blanks, knownSymbols)
    if (d === undefined) return null
    digits.push(d)
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
  knownSymbols: Record<string, number> | undefined,
): number | null {
  const digits = significantDigits(row, rowKeyStr, fills, blanks, knownSymbols)
  return digits ? digitsToNumber(digits) : null
}

function evaluateBlock(
  block: VerticalPuzzleBlock,
  prefix: string,
  fills: VerticalPuzzleFills,
  blanks: BlankSlot[],
  knownSymbols: Record<string, number> | undefined,
): boolean {
  const operandNums = block.operands.map((row, ri) =>
    rowNumber(row, `${prefix}op${ri}`, fills, blanks, knownSymbols),
  )
  const resultNum = rowNumber(block.result, `${prefix}result`, fills, blanks, knownSymbols)
  if (operandNums.some((n) => n === null) || resultNum === null) return false

  if (block.op === '+') {
    return operandNums.reduce<number>((a, b) => a + (b as number), 0) === resultNum
  }
  if (operandNums.length < 2) return false
  const first = operandNums[0] as number
  const sub = operandNums.slice(1).reduce<number>((a, b) => a + (b as number), 0)
  return first - sub === resultNum
}

function validateSymbolConstraints(
  spec: VerticalDigitPuzzleSpec,
  fills: VerticalPuzzleFills,
  blanks: BlankSlot[],
): boolean {
  const symToDigit: Record<string, number> = { ...(spec.knownSymbols ?? {}) }

  for (const blank of blanks) {
    if (blank.sym === undefined) continue
    const d = fills[blank.id]
    if (d === undefined) continue
    if (symToDigit[blank.sym] !== undefined && symToDigit[blank.sym] !== d) return false
    symToDigit[blank.sym] = d
  }

  return true
}

/** True when filled digits satisfy the vertical equation. */
export function evaluateVerticalPuzzle(
  spec: VerticalDigitPuzzleSpec,
  fills: VerticalPuzzleFills,
): boolean {
  const blanks = listPuzzleBlanks(spec)
  const known = spec.knownSymbols

  if (!validateSymbolConstraints(spec, fills, blanks)) return false

  const operandNums = spec.operands.map((row, ri) =>
    rowNumber(row, `op${ri}`, fills, blanks, known),
  )
  const resultNum = rowNumber(spec.result, 'result', fills, blanks, known)

  if (operandNums.some((n) => n === null) || resultNum === null) return false

  if (spec.chainSubtract && spec.chainResult) {
    if (spec.op !== '+') return false
    const sum = operandNums.reduce<number>((a, b) => a + (b as number), 0)
    if (sum !== resultNum) return false
    const subNum = rowNumber(spec.chainSubtract, 'sub', fills, blanks, known)
    const finalNum = rowNumber(spec.chainResult, 'final', fills, blanks, known)
    if (subNum === null || finalNum === null) return false
    if (sum - subNum !== finalNum) return false
  } else if (spec.op === '+') {
    if (operandNums.reduce<number>((a, b) => a + (b as number), 0) !== resultNum) return false
  } else {
    if (operandNums.length < 2) return false
    const first = operandNums[0] as number
    const sub = operandNums.slice(1).reduce<number>((a, b) => a + (b as number), 0)
    if (first - sub !== resultNum) return false
  }

  for (const [bi, block] of (spec.blocks ?? []).entries()) {
    if (!evaluateBlock(block, `blk${bi}_`, fills, blanks, known)) return false
  }

  return true
}

/** Resolve a symbol's digit from fills (after validation). */
export function symDigit(
  spec: VerticalDigitPuzzleSpec,
  fills: VerticalPuzzleFills,
  sym: string,
): number | undefined {
  if (spec.knownSymbols?.[sym] !== undefined) return spec.knownSymbols[sym]
  const blank = listPuzzleBlanks(spec).find((b) => b.sym === sym)
  if (blank && fills[blank.id] !== undefined) return fills[blank.id]
  return undefined
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

export function makeVerticalPuzzleSymChecker(
  spec: VerticalDigitPuzzleSpec,
  expected: Record<string, number>,
  wrongHint = '竖式还不对，检查相同符号是否同数字。',
): NonNullable<import('@rosie/core').Problem['checkAnswer']> {
  return (input: unknown): AnswerCheckResult => {
    const base = makeVerticalPuzzleChecker(spec, wrongHint)(input)
    if (!base.ok) return base
    if (!isVerticalPuzzleFills(input)) return base
    for (const [sym, want] of Object.entries(expected)) {
      if (symDigit(spec, input, sym) !== want) {
        return { ok: false, message: wrongHint }
      }
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

export function cellDisplayLabel(cell: VerticalPuzzleCell): string | null {
  if (isSymbolCell(cell)) return cell.label ?? cell.sym
  return null
}

export function isCellEditable(cell: VerticalPuzzleCell): boolean {
  return isEditableBlank(cell)
}

export function fixedCellDigit(
  cell: VerticalPuzzleCell,
  knownSymbols?: Record<string, number>,
): number | null {
  if (typeof cell === 'number') return cell
  if (isSymbolCell(cell)) {
    if (cell.fixed !== undefined) return cell.fixed
    const known = knownSymbols?.[cell.sym]
    if (known !== undefined) return known
  }
  return null
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
