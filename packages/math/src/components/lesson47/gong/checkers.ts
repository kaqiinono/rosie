import type { AnswerCheckResult } from '@rosie/core'
import { buildBudengIneqMaps } from './utils/budeng'
import { buildJuchiRegionsFromLines } from './utils/juchi'
import {
  coordsToGrid,
  parseChuangkouWindows,
  resolveChuangkouWindow,
  resolveGridSize,
} from './utils'
import {
  validateBudengSudoku,
  validateChangguiSudoku,
  validateChuangkouSudoku,
  validateDuijiaoxianSudoku,
  validateJuchiSudoku,
  validateShufang,
  validateShulian,
  validateShuqiao,
  validateWumaSudoku,
} from './utils/validators'
import type {
  BudengSudokuProps,
  ChangguiSudokuProps,
  ChuangkouSudokuProps,
  DuijiaoxianSudokuProps,
  JuchiSudokuProps,
  ShufangProps,
  ShulianProps,
  ShuqiaoProps,
  WumaSudokuProps,
} from './utils/types'

function toResult(result: { ok: boolean; message: string }): AnswerCheckResult {
  return { ok: result.ok, message: result.message }
}

function regionId(r: number, c: number): string {
  return `${r},${c}`
}

function buildShufangRegions(
  grid: number[][],
  painted: (string | null)[][],
  rowCount: number,
  colCount: number,
): (string | null)[][] {
  const regions: (string | null)[][] = Array.from({ length: rowCount }, () =>
    Array(colCount).fill(null),
  )
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      regions[r][c] = grid[r][c] > 0 ? regionId(r, c) : painted[r][c]
    }
  }
  return regions
}

export interface ShulianState {
  painted: number[][]
}

export interface ShufangState {
  painted: (string | null)[][]
}

export interface ShuqiaoState {
  bridges: Record<string, number>
}

export interface SudokuState {
  values: string[][]
}

export function makeShulianChecker(config: ShulianProps) {
  const { rowCount, colCount } = resolveGridSize(config.rows)
  const grid = coordsToGrid(rowCount, colCount, config.cells)
  return (input: unknown): AnswerCheckResult => {
    const state = input as ShulianState
    if (!state?.painted) {
      return { ok: false, message: '请先在宫格中完成作答' }
    }
    return toResult(validateShulian(grid, state.painted, rowCount, colCount))
  }
}

export function makeShufangChecker(config: ShufangProps) {
  const { rowCount, colCount } = resolveGridSize(config.rows)
  const grid = coordsToGrid(rowCount, colCount, config.cells)
  return (input: unknown): AnswerCheckResult => {
    const state = input as ShufangState
    if (!state?.painted) {
      return { ok: false, message: '请先在宫格中完成作答' }
    }
    return toResult(
      validateShufang(grid, buildShufangRegions(grid, state.painted, rowCount, colCount), rowCount, colCount),
    )
  }
}

export function makeShuqiaoChecker(config: ShuqiaoProps) {
  const islands = config.cells.map(([row, col, bridges]) => ({ row, col, bridges }))
  return (input: unknown): AnswerCheckResult => {
    const state = input as ShuqiaoState
    if (!state?.bridges) {
      return { ok: false, message: '请先在宫格中完成作答' }
    }
    return toResult(validateShuqiao(islands, state.bridges))
  }
}

export function makeChangguiSudokuChecker(config: ChangguiSudokuProps) {
  const { rowCount, colCount } = resolveGridSize(config.rows)
  return (input: unknown): AnswerCheckResult => {
    const state = input as SudokuState
    if (!state?.values) {
      return { ok: false, message: '请先在宫格中完成作答' }
    }
    return toResult(validateChangguiSudoku(state.values, rowCount, colCount))
  }
}

export function makeBudengSudokuChecker(config: BudengSudokuProps) {
  const { rowCount, colCount } = resolveGridSize(config.rows)
  const { hMap, vMap } = buildBudengIneqMaps(config.hIneq ?? [], config.vIneq ?? [], rowCount, colCount)
  return (input: unknown): AnswerCheckResult => {
    const state = input as SudokuState
    if (!state?.values) {
      return { ok: false, message: '请先在宫格中完成作答' }
    }
    return toResult(validateBudengSudoku(state.values, hMap, vMap, rowCount, colCount))
  }
}

export function makeWumaSudokuChecker(config: WumaSudokuProps) {
  const { rowCount, colCount } = resolveGridSize(config.rows)
  return (input: unknown): AnswerCheckResult => {
    const state = input as SudokuState
    if (!state?.values) {
      return { ok: false, message: '请先在宫格中完成作答' }
    }
    return toResult(validateWumaSudoku(state.values, rowCount, colCount))
  }
}

export function makeDuijiaoxianSudokuChecker(config: DuijiaoxianSudokuProps) {
  const { rowCount, colCount } = resolveGridSize(config.rows)
  return (input: unknown): AnswerCheckResult => {
    const state = input as SudokuState
    if (!state?.values) {
      return { ok: false, message: '请先在宫格中完成作答' }
    }
    return toResult(validateDuijiaoxianSudoku(state.values, rowCount, colCount))
  }
}

export function makeJuchiSudokuChecker(config: JuchiSudokuProps) {
  const { rowCount, colCount } = resolveGridSize(config.rows)
  const regions = buildJuchiRegionsFromLines(
    rowCount,
    colCount,
    config.hLine ?? [],
    config.vLine ?? [],
  )
  return (input: unknown): AnswerCheckResult => {
    const state = input as SudokuState
    if (!state?.values) {
      return { ok: false, message: '请先在宫格中完成作答' }
    }
    return toResult(validateJuchiSudoku(state.values, rowCount, colCount, regions))
  }
}

export function makeChuangkouSudokuChecker(config: ChuangkouSudokuProps) {
  const { rowCount, colCount } = resolveGridSize(config.rows)
  const resolvedWindow = resolveChuangkouWindow(rowCount, colCount, config.window)
  const windowRegions = parseChuangkouWindows(resolvedWindow)
  return (input: unknown): AnswerCheckResult => {
    const state = input as SudokuState
    if (!state?.values) {
      return { ok: false, message: '请先在宫格中完成作答' }
    }
    return toResult(validateChuangkouSudoku(state.values, rowCount, colCount, windowRegions))
  }
}
