import type { InequalityOp, RegionPos } from './types'
import type { WindowRegion } from './index'
import { KNIGHT_DELTAS, resolveSudokuBoxDimensions } from './index'

export interface ValidateResult {
  ok: boolean
  message: string
  /** 0-indexed cell keys "r,c" that violate rules */
  invalidCells?: string[]
}

const DIRS = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
] as const

function cellKey(r: number, c: number): string {
  return `${r},${c}`
}

function isConnected(cells: { r: number; c: number }[], rows: number, cols: number): boolean {
  if (cells.length === 0) return false
  const set = new Set(cells.map(({ r, c }) => cellKey(r, c)))
  const stack = [cells[0]]
  const seen = new Set<string>()
  while (stack.length) {
    const { r, c } = stack.pop()!
    const k = cellKey(r, c)
    if (seen.has(k)) continue
    seen.add(k)
    for (const [dr, dc] of DIRS) {
      const nr = r + dr
      const nc = c + dc
      if (set.has(cellKey(nr, nc))) stack.push({ r: nr, c: nc })
    }
  }
  return seen.size === set.size
}

/** 数连：相同数字连通、覆盖全盘、端点数字与路径一致 */
export function validateShulian(
  grid: number[][],
  painted: number[][],
  rows: number,
  cols: number,
): ValidateResult {
  const owner = (r: number, c: number) => (grid[r][c] > 0 ? grid[r][c] : painted[r][c])

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (owner(r, c) <= 0) {
        return { ok: false, message: '还有格子未涂色，请覆盖所有格子' }
      }
      if (grid[r][c] > 0 && owner(r, c) !== grid[r][c]) {
        return { ok: false, message: '数字格的颜色与数字不匹配' }
      }
    }
  }

  const numbers = new Set<number>()
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] > 0) numbers.add(grid[r][c])
    }
  }

  for (const n of numbers) {
    const cells: { r: number; c: number }[] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (owner(r, c) === n) cells.push({ r, c })
      }
    }
    if (!isConnected(cells, rows, cols)) {
      return { ok: false, message: `数字 ${n} 的路径未连成一片，请检查是否交叉或断开` }
    }
  }

  return { ok: true, message: '✓ 完全正确！太棒了！' }
}

/** 数方：矩形区域、面积等于数字、线索唯一、覆盖全盘 */
export function validateShufang(
  grid: number[][],
  regions: (string | null)[][],
  rows: number,
  cols: number,
): ValidateResult {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!regions[r][c]) {
        return { ok: false, message: '还有格子未划分区域' }
      }
    }
  }

  const byRegion = new Map<string, { r: number; c: number }[]>()
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = regions[r][c]!
      if (!byRegion.has(id)) byRegion.set(id, [])
      byRegion.get(id)!.push({ r, c })
    }
  }

  for (const [id, cells] of byRegion) {
    const [cr, cc] = id.split(',').map(Number)
    const clueVal = grid[cr][cc]
    if (!clueVal) {
      return { ok: false, message: '区域划分有误（无效区域）' }
    }

    let clueCount = 0
    for (const { r, c } of cells) {
      if (grid[r][c] > 0) clueCount++
    }
    if (clueCount !== 1) {
      return { ok: false, message: '每个方片只能包含一个数字' }
    }

    if (cells.length !== clueVal) {
      return {
        ok: false,
        message: `数字 ${clueVal} 所在方片面积应为 ${clueVal}，当前为 ${cells.length}`,
      }
    }

    const rs = cells.map(({ r }) => r)
    const cs = cells.map(({ c }) => c)
    const minR = Math.min(...rs)
    const maxR = Math.max(...rs)
    const minC = Math.min(...cs)
    const maxC = Math.max(...cs)
    const w = maxC - minC + 1
    const h = maxR - minR + 1
    if (w * h !== cells.length) {
      return { ok: false, message: '方片必须是长方形或正方形' }
    }
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (regions[r][c] !== id) {
          return { ok: false, message: '方片必须是长方形或正方形' }
        }
      }
    }
  }

  return { ok: true, message: '✓ 完全正确！划分方式正确！' }
}

function parseGrid(values: string[][], size: number): number[][] | null {
  return parseRectGrid(values, size, size, size)
}

function parseRectGrid(
  values: string[][],
  rows: number,
  cols: number,
  maxVal: number,
): number[][] | null {
  const grid: number[][] = []
  for (let r = 0; r < rows; r++) {
    if (!values[r] || values[r].length < cols) return null
    grid[r] = []
    for (let c = 0; c < cols; c++) {
      const v = parseInt(values[r][c], 10)
      if (!v || v < 1 || v > maxVal) return null
      grid[r][c] = v
    }
  }
  return grid
}

function markGroupDuplicates(cells: { r: number; c: number; v: number }[]): string[] {
  const invalid = new Set<string>()
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      if (cells[i].v === cells[j].v) {
        invalid.add(cellKey(cells[i].r, cells[i].c))
        invalid.add(cellKey(cells[j].r, cells[j].c))
      }
    }
  }
  return [...invalid]
}

/** 常规数独：行/列/宫不重复 */
export function validateChangguiSudoku(
  values: string[][],
  gridRows: number,
  gridCols: number,
): ValidateResult {
  const grid = parseRectGrid(values, gridRows, gridCols, gridRows)
  if (!grid) return { ok: false, message: '还有空格未填！' }

  const invalid = new Set<string>()

  for (let r = 0; r < gridRows; r++) {
    markGroupDuplicates(
      Array.from({ length: gridCols }, (_, c) => ({ r, c, v: grid[r][c] })),
    ).forEach((k) => invalid.add(k))
  }
  for (let c = 0; c < gridCols; c++) {
    markGroupDuplicates(
      Array.from({ length: gridRows }, (_, r) => ({ r, c, v: grid[r][c] })),
    ).forEach((k) => invalid.add(k))
  }

  if (gridRows === gridCols) {
    const boxSize = Math.sqrt(gridRows)
    if (Number.isInteger(boxSize)) {
      for (let br = 0; br < gridRows; br += boxSize) {
        for (let bc = 0; bc < gridCols; bc += boxSize) {
          const group: { r: number; c: number; v: number }[] = []
          for (let r = br; r < br + boxSize; r++) {
            for (let c = bc; c < bc + boxSize; c++) group.push({ r, c, v: grid[r][c] })
          }
          markGroupDuplicates(group).forEach((k) => invalid.add(k))
        }
      }
    }
  }

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (grid[r][c] < 1 || grid[r][c] > gridRows) invalid.add(cellKey(r, c))
    }
  }

  if (invalid.size) {
    return { ok: false, message: '有错误（红色），请检查行/列/宫', invalidCells: [...invalid] }
  }
  return { ok: true, message: '✓ 完全正确！' }
}

/** 不等号数独 */
export function validateBudengSudoku(
  values: string[][],
  hIneq: InequalityOp[][],
  vIneq: InequalityOp[][],
  gridRows: number,
  gridCols: number,
): ValidateResult {
  const grid = parseRectGrid(values, gridRows, gridCols, gridRows)
  if (!grid) return { ok: false, message: '还有空格未填！' }

  const invalid = new Set<string>()
  const digitMax = gridRows

  for (let r = 0; r < gridRows; r++) {
    markGroupDuplicates(
      Array.from({ length: gridCols }, (_, c) => ({ r, c, v: grid[r][c] })),
    ).forEach((k) => invalid.add(k))
  }
  for (let c = 0; c < gridCols; c++) {
    markGroupDuplicates(
      Array.from({ length: gridRows }, (_, r) => ({ r, c, v: grid[r][c] })),
    ).forEach((k) => invalid.add(k))
  }

  if (gridRows === gridCols) {
    const boxDims = resolveSudokuBoxDimensions(gridRows, gridCols)
    if (boxDims) {
      const { boxRows, boxCols } = boxDims
      for (let br = 0; br < gridRows; br += boxRows) {
        for (let bc = 0; bc < gridCols; bc += boxCols) {
          const group: { r: number; c: number; v: number }[] = []
          for (let r = br; r < br + boxRows; r++) {
            for (let c = bc; c < bc + boxCols; c++) group.push({ r, c, v: grid[r][c] })
          }
          markGroupDuplicates(group).forEach((k) => invalid.add(k))
        }
      }
    }
  }

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols - 1; c++) {
      const op = hIneq[r]?.[c]
      if (!op) continue
      const a = grid[r][c]
      const b = grid[r][c + 1]
      const ok = op === '<' ? a < b : a > b
      if (!ok) {
        invalid.add(cellKey(r, c))
        invalid.add(cellKey(r, c + 1))
      }
    }
  }
  for (let r = 0; r < gridRows - 1; r++) {
    for (let c = 0; c < gridCols; c++) {
      const op = vIneq[r]?.[c]
      if (!op) continue
      const a = grid[r][c]
      const b = grid[r + 1][c]
      const ok = op === '<' ? a < b : a > b
      if (!ok) {
        invalid.add(cellKey(r, c))
        invalid.add(cellKey(r + 1, c))
      }
    }
  }

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (grid[r][c] < 1 || grid[r][c] > digitMax) invalid.add(cellKey(r, c))
    }
  }

  if (invalid.size) {
    return {
      ok: false,
      message: '有错误（红色），请检查行/列/宫或不等号约束',
      invalidCells: [...invalid],
    }
  }
  return { ok: true, message: '✓ 完全正确！' }
}

/** 对角线数独：行/列/宫/两条主对角线不重复 */
export function validateDuijiaoxianSudoku(
  values: string[][],
  gridRows: number,
  gridCols: number,
): ValidateResult {
  const grid = parseRectGrid(values, gridRows, gridCols, gridRows)
  if (!grid) return { ok: false, message: '还有空格未填！' }

  const invalid = new Set<string>()
  const box = gridRows === gridCols && gridRows === 6 ? { boxRows: 2, boxCols: 3 } : null
  const squareBox = gridRows === gridCols ? Math.sqrt(gridRows) : NaN
  const boxDims =
    box ?? (Number.isInteger(squareBox) ? { boxRows: squareBox, boxCols: squareBox } : null)

  for (let r = 0; r < gridRows; r++) {
    markGroupDuplicates(
      Array.from({ length: gridCols }, (_, c) => ({ r, c, v: grid[r][c] })),
    ).forEach((k) => invalid.add(k))
  }
  for (let c = 0; c < gridCols; c++) {
    markGroupDuplicates(
      Array.from({ length: gridRows }, (_, r) => ({ r, c, v: grid[r][c] })),
    ).forEach((k) => invalid.add(k))
  }

  if (boxDims) {
    const { boxRows, boxCols } = boxDims
    for (let br = 0; br < gridRows; br += boxRows) {
      for (let bc = 0; bc < gridCols; bc += boxCols) {
        const group: { r: number; c: number; v: number }[] = []
        for (let r = br; r < br + boxRows; r++) {
          for (let c = bc; c < bc + boxCols; c++) group.push({ r, c, v: grid[r][c] })
        }
        markGroupDuplicates(group).forEach((k) => invalid.add(k))
      }
    }
  }

  if (gridRows === gridCols) {
    const mainDiag: { r: number; c: number; v: number }[] = []
    const antiDiag: { r: number; c: number; v: number }[] = []
    for (let i = 0; i < gridRows; i++) {
      mainDiag.push({ r: i, c: i, v: grid[i][i] })
      antiDiag.push({ r: i, c: gridCols - 1 - i, v: grid[i][gridCols - 1 - i] })
    }
    markGroupDuplicates(mainDiag).forEach((k) => invalid.add(k))
    markGroupDuplicates(antiDiag).forEach((k) => invalid.add(k))
  }

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (grid[r][c] < 1 || grid[r][c] > gridRows) invalid.add(cellKey(r, c))
    }
  }

  if (invalid.size) {
    return {
      ok: false,
      message: '有错误（红色），请检查行/列/宫或对角线',
      invalidCells: [...invalid],
    }
  }
  return { ok: true, message: '✓ 完全正确！' }
}

/** 锯齿数独：行/列/不规则宫不重复 */
export function validateJuchiSudoku(
  values: string[][],
  gridRows: number,
  gridCols: number,
  regions: readonly (readonly RegionPos[])[],
): ValidateResult {
  const grid = parseRectGrid(values, gridRows, gridCols, gridRows)
  if (!grid) return { ok: false, message: '还有空格未填！' }

  const invalid = new Set<string>()

  for (let r = 0; r < gridRows; r++) {
    markGroupDuplicates(
      Array.from({ length: gridCols }, (_, c) => ({ r, c, v: grid[r][c] })),
    ).forEach((k) => invalid.add(k))
  }
  for (let c = 0; c < gridCols; c++) {
    markGroupDuplicates(
      Array.from({ length: gridRows }, (_, r) => ({ r, c, v: grid[r][c] })),
    ).forEach((k) => invalid.add(k))
  }

  for (const region of regions) {
    const group: { r: number; c: number; v: number }[] = []
    for (const [row, col] of region) {
      const r = row - 1
      const c = col - 1
      if (r >= 0 && r < gridRows && c >= 0 && c < gridCols) {
        group.push({ r, c, v: grid[r][c] })
      }
    }
    markGroupDuplicates(group).forEach((k) => invalid.add(k))
  }

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (grid[r][c] < 1 || grid[r][c] > gridRows) invalid.add(cellKey(r, c))
    }
  }

  if (invalid.size) {
    return { ok: false, message: '有错误（红色），请检查行/列/宫', invalidCells: [...invalid] }
  }
  return { ok: true, message: '✓ 完全正确！' }
}

const KNIGHT = KNIGHT_DELTAS

/** 无马数独：行/列/宫不重复，且马步位置两格数字不能相同 */
export function validateWumaSudoku(
  values: string[][],
  gridRows: number,
  gridCols: number,
): ValidateResult {
  const grid = parseRectGrid(values, gridRows, gridCols, gridRows)
  if (!grid) return { ok: false, message: '还有空格未填！' }

  const invalid = new Set<string>()
  const boxDims = resolveSudokuBoxDimensions(gridRows, gridCols)

  for (let r = 0; r < gridRows; r++) {
    markGroupDuplicates(
      Array.from({ length: gridCols }, (_, c) => ({ r, c, v: grid[r][c] })),
    ).forEach((k) => invalid.add(k))
  }
  for (let c = 0; c < gridCols; c++) {
    markGroupDuplicates(
      Array.from({ length: gridRows }, (_, r) => ({ r, c, v: grid[r][c] })),
    ).forEach((k) => invalid.add(k))
  }

  if (boxDims) {
    const { boxRows, boxCols } = boxDims
    for (let br = 0; br < gridRows; br += boxRows) {
      for (let bc = 0; bc < gridCols; bc += boxCols) {
        const group: { r: number; c: number; v: number }[] = []
        for (let r = br; r < br + boxRows; r++) {
          for (let c = bc; c < bc + boxCols; c++) group.push({ r, c, v: grid[r][c] })
        }
        markGroupDuplicates(group).forEach((k) => invalid.add(k))
      }
    }
  }

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const v = grid[r][c]
      for (const [dr, dc] of KNIGHT) {
        const nr = r + dr
        const nc = c + dc
        if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols && grid[nr][nc] === v) {
          invalid.add(cellKey(r, c))
          invalid.add(cellKey(nr, nc))
        }
      }
    }
  }

  if (invalid.size) {
    return {
      ok: false,
      message: '有错误（红色），请检查数独或马步约束',
      invalidCells: [...invalid],
    }
  }
  return { ok: true, message: '✓ 完全正确！' }
}

/** 窗口数独 */
export function validateChuangkouSudoku(
  values: string[][],
  gridRows: number,
  gridCols: number,
  windows: WindowRegion[],
): ValidateResult {
  const grid = parseRectGrid(values, gridRows, gridCols, gridRows)
  if (!grid) return { ok: false, message: '还有空格未填！' }

  const invalid = new Set<string>()

  for (let r = 0; r < gridRows; r++) {
    markGroupDuplicates(
      Array.from({ length: gridCols }, (_, c) => ({ r, c, v: grid[r][c] })),
    ).forEach((k) => invalid.add(k))
  }
  for (let c = 0; c < gridCols; c++) {
    markGroupDuplicates(
      Array.from({ length: gridRows }, (_, r) => ({ r, c, v: grid[r][c] })),
    ).forEach((k) => invalid.add(k))
  }

  if (gridRows === gridCols) {
    const boxSize = Math.sqrt(gridRows)
    if (Number.isInteger(boxSize)) {
      for (let br = 0; br < gridRows; br += boxSize) {
        for (let bc = 0; bc < gridCols; bc += boxSize) {
          const group: { r: number; c: number; v: number }[] = []
          for (let r = br; r < br + boxSize; r++) {
            for (let c = bc; c < bc + boxSize; c++) group.push({ r, c, v: grid[r][c] })
          }
          markGroupDuplicates(group).forEach((k) => invalid.add(k))
        }
      }
    }
  }

  for (const { r1, r2, c1, c2 } of windows) {
    const group: { r: number; c: number; v: number }[] = []
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) group.push({ r, c, v: grid[r][c] })
    }
    markGroupDuplicates(group).forEach((k) => invalid.add(k))
  }

  if (invalid.size) {
    return {
      ok: false,
      message: '有错误（红色），请检查行/列/宫或窗口区域',
      invalidCells: [...invalid],
    }
  }
  return { ok: true, message: '✓ 完全正确！' }
}

/** 数桥：每个岛桥数匹配，且所有岛连通 */
export function validateShuqiao(
  islands: { row: number; col: number; bridges: number }[],
  bridgeCounts: Record<string, number>,
): ValidateResult {
  const getUsed = (row: number, col: number) => {
    const self = `${row},${col}`
    return Object.entries(bridgeCounts)
      .filter(([k, v]) => v > 0 && k.split('-').includes(self))
      .reduce((s, [, v]) => s + v, 0)
  }

  for (const isl of islands) {
    const used = getUsed(isl.row, isl.col)
    if (used !== isl.bridges) {
      return {
        ok: false,
        message: `第 ${isl.row} 行第 ${isl.col} 列的桥数不正确（当前 ${used}，需要 ${isl.bridges}）`,
      }
    }
  }

  if (islands.length <= 1) return { ok: true, message: '✓ 完全正确！每个岛的桥数都已匹配！' }

  const coordKey = (row: number, col: number) => `${row},${col}`
  const adj = new Map<string, Set<string>>()
  for (const isl of islands) adj.set(coordKey(isl.row, isl.col), new Set())

  for (const [key, cnt] of Object.entries(bridgeCounts)) {
    if (cnt <= 0) continue
    const [a, b] = key.split('-')
    if (!adj.has(a)) adj.set(a, new Set())
    if (!adj.has(b)) adj.set(b, new Set())
    adj.get(a)!.add(b)
    adj.get(b)!.add(a)
  }

  const start = coordKey(islands[0].row, islands[0].col)
  const seen = new Set<string>()
  const stack = [start]
  while (stack.length) {
    const k = stack.pop()!
    if (seen.has(k)) continue
    seen.add(k)
    for (const nb of adj.get(k) ?? []) {
      if (!seen.has(nb)) stack.push(nb)
    }
  }
  if (seen.size !== islands.length) {
    return { ok: false, message: '所有岛必须连成一片，请检查桥的连接' }
  }

  return { ok: true, message: '✓ 完全正确！每个岛的桥数都已匹配！' }
}

export function applyValidateColors(
  size: number,
  givenGrid: number[][],
  result: ValidateResult,
): Record<string, string> {
  const colors: Record<string, string> = {}
  if (result.ok) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!givenGrid[r]?.[c]) colors[cellKey(r, c)] = 'var(--gong-accent)'
      }
    }
    return colors
  }
  if (result.invalidCells?.length) {
    for (const k of result.invalidCells) {
      const [r, c] = k.split(',').map(Number)
      if (!givenGrid[r]?.[c]) colors[k] = 'var(--gong-coral)'
    }
  }
  return colors
}
