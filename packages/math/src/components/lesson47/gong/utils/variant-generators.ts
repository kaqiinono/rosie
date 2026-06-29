import type {
  BudengGridSize,
  CellCoord,
  ChuangkouWindowConfig,
  CoordGridProps,
  IneqCoord,
  InequalityOp,
} from './types'
import {
  KNIGHT_DELTAS,
  parseChuangkouWindows,
  resolveDefaultChuangkouWindow,
  resolveGridSize,
  resolveSudokuBoxDimensions,
  toGridSize,
} from './index'
import type { WindowRegion } from './index'

const DIRS = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
] as const

function shuffle<T>(arr: T[]): T[] {
  const next = [...arr]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

type Symmetry = { rot: 0 | 1 | 2 | 3; flipH: boolean }

function applySymmetry(
  r: number,
  c: number,
  rows: number,
  cols: number,
  sym: Symmetry,
): [number, number] {
  let nr = r
  let nc = c
  for (let i = 0; i < sym.rot; i++) {
    ;[nr, nc] = [nc, rows - 1 - nr]
    ;[rows, cols] = [cols, rows]
  }
  if (sym.flipH) nc = cols - 1 - nc
  return [nr, nc]
}

function randomSymmetry(): Symmetry {
  return { rot: randInt(0, 3) as 0 | 1 | 2 | 3, flipH: Math.random() < 0.5 }
}

function permuteLabels(cells: CellCoord[]): CellCoord[] {
  const labels = [...new Set(cells.map(([, , v]) => v))]
  const perm = shuffle(labels)
  const map = new Map(labels.map((l, i) => [l, perm[i]]))
  return cells.map(([r, c, v]) => [r, c, map.get(v)!])
}

function transformCoords(cells: CellCoord[], rows: number, cols: number): CellCoord[] {
  const sym = randomSymmetry()
  return cells.map(([r, c, v]) => {
    const [nr, nc] = applySymmetry(r - 1, c - 1, rows, cols, sym)
    return [nr + 1, nc + 1, v] as CellCoord
  })
}

/** 数连：对称变换 + 数字重标（标签可互换） */
function transformShulianCells(cells: CellCoord[], rows: number, cols: number): CellCoord[] {
  return permuteLabels(transformCoords(cells, rows, cols))
}

function rowUsed(grid: number[][], r: number, v: number): boolean {
  return grid[r].includes(v)
}

function colUsed(grid: number[][], c: number, v: number): boolean {
  return grid.some((row) => row[c] === v)
}

function boxUsed(
  grid: number[][],
  r: number,
  c: number,
  boxRows: number,
  boxCols: number,
  v: number,
): boolean {
  const br = Math.floor(r / boxRows) * boxRows
  const bc = Math.floor(c / boxCols) * boxCols
  for (let i = br; i < br + boxRows; i++) {
    for (let j = bc; j < bc + boxCols; j++) {
      if (grid[i][j] === v) return true
    }
  }
  return false
}

function knightUsed(grid: number[][], r: number, c: number, v: number): boolean {
  for (const [dr, dc] of KNIGHT_DELTAS) {
    const nr = r + dr
    const nc = c + dc
    if (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid[0].length && grid[nr][nc] === v) {
      return true
    }
  }
  return false
}

function windowUsed(
  grid: number[][],
  r: number,
  c: number,
  windows: WindowRegion[],
  v: number,
): boolean {
  for (const win of windows) {
    if (r >= win.r1 && r <= win.r2 && c >= win.c1 && c <= win.c2) {
      for (let i = win.r1; i <= win.r2; i++) {
        for (let j = win.c1; j <= win.c2; j++) {
          if (grid[i][j] === v) return true
        }
      }
    }
  }
  return false
}

function fillSudoku(
  rowCount: number,
  colCount: number,
  extraCheck?: (grid: number[][], r: number, c: number, v: number) => boolean,
  windows?: WindowRegion[],
): number[][] | null {
  const boxDims = resolveSudokuBoxDimensions(rowCount, colCount)
  const grid = Array.from({ length: rowCount }, () => Array<number>(colCount).fill(0))

  function canPlace(r: number, c: number, v: number): boolean {
    if (rowUsed(grid, r, v) || colUsed(grid, c, v)) return false
    if (boxDims && boxUsed(grid, r, c, boxDims.boxRows, boxDims.boxCols, v)) return false
    if (extraCheck && !extraCheck(grid, r, c, v)) return false
    if (windows && windowUsed(grid, r, c, windows, v)) return false
    return true
  }

  function dfs(idx: number): boolean {
    if (idx === rowCount * colCount) return true
    const r = Math.floor(idx / colCount)
    const c = idx % colCount
    for (const v of shuffle(Array.from({ length: rowCount }, (_, i) => i + 1))) {
      if (!canPlace(r, c, v)) continue
      grid[r][c] = v
      if (dfs(idx + 1)) return true
      grid[r][c] = 0
    }
    return false
  }

  for (let attempt = 0; attempt < 40; attempt++) {
    grid.forEach((row) => row.fill(0))
    if (dfs(0)) return grid.map((row) => [...row])
  }
  return null
}

function pickGivens(grid: number[][], targetMin: number, targetMax: number): CellCoord[] {
  const coords: CellCoord[] = []
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      coords.push([r + 1, c + 1, grid[r][c]])
    }
  }
  const count = randInt(targetMin, targetMax)
  return shuffle(coords).slice(0, count)
}

function buildInequalities(
  grid: number[][],
  density: number,
): { hIneq: IneqCoord[]; vIneq: IneqCoord[] } {
  const rows = grid.length
  const cols = grid[0].length
  const hIneq: IneqCoord[] = []
  const vIneq: IneqCoord[] = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      if (Math.random() > density) continue
      const op: InequalityOp = grid[r][c] < grid[r][c + 1] ? '<' : '>'
      hIneq.push([r + 1, c + 2, op])
    }
  }
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      if (Math.random() > density) continue
      const op: InequalityOp = grid[r][c] < grid[r + 1][c] ? '<' : '>'
      vIneq.push([c + 1, r + 2, op])
    }
  }
  return { hIneq, vIneq }
}

export function variantShulian(template: CoordGridProps) {
  const { rowCount, colCount } = resolveGridSize(template.rows)
  if (Math.random() < 0.5) {
    return {
      rows: template.rows,
      cells: transformShulianCells(template.cells, rowCount, colCount),
    }
  }
  const generated = generateShulian(rowCount, colCount)
  return (
    generated ?? {
      rows: template.rows,
      cells: transformShulianCells(template.cells, rowCount, colCount),
    }
  )
}

function tryGenerateShulian(rowCount: number, colCount: number): CoordGridProps | null {
  const owner = Array.from({ length: rowCount }, () => Array<number>(colCount).fill(0))
  const cells: CellCoord[] = []
  let num = 1

  function unoccupied(): [number, number][] {
    const list: [number, number][] = []
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        if (owner[r][c] === 0) list.push([r, c])
      }
    }
    return list
  }

  while (unoccupied().length > 0) {
    const free = unoccupied()
    const [sr, sc] = free[Math.floor(Math.random() * free.length)]!
    owner[sr][sc] = num
    const path: [number, number][] = [[sr, sc]]
    let r = sr
    let c = sc

    while (true) {
      const neighbors = DIRS.map(([dr, dc]) => [r + dr, c + dc] as [number, number]).filter(
        ([nr, nc]) => nr >= 0 && nr < rowCount && nc >= 0 && nc < colCount && owner[nr][nc] === 0,
      )
      if (neighbors.length === 0) break
      if (path.length >= 2 && Math.random() < 0.2) break
      const [nr, nc] = neighbors[Math.floor(Math.random() * neighbors.length)]!
      owner[nr][nc] = num
      path.push([nr, nc])
      r = nr
      c = nc
    }

    if (path.length < 2) {
      for (const [pr, pc] of path) owner[pr][pc] = 0
      return null
    }

    const [a, b] = [path[0]!, path[path.length - 1]!]
    cells.push([a[0] + 1, a[1] + 1, num], [b[0] + 1, b[1] + 1, num])
    num++
  }

  return { rows: toGridSize(rowCount, colCount), cells }
}

export function generateShulian(rowCount: number, colCount: number) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const result = tryGenerateShulian(rowCount, colCount)
    if (result) return result
  }
  return null
}

export function variantShufang(template: CoordGridProps) {
  const { rowCount, colCount } = resolveGridSize(template.rows)
  if (Math.random() < 0.45) {
    return {
      rows: template.rows,
      cells: transformCoords(template.cells, rowCount, colCount),
    }
  }
  return generateShufang(rowCount, colCount)
}

export function generateShufang(rowCount: number, colCount: number) {
  const used = Array.from({ length: rowCount }, () => Array<boolean>(colCount).fill(false))
  const cells: CellCoord[] = []

  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      if (used[r][c]) continue
      const options: { h: number; w: number }[] = []
      for (let h = 1; r + h <= rowCount; h++) {
        for (let w = 1; c + w <= colCount; w++) {
          let ok = true
          for (let i = r; i < r + h && ok; i++) {
            for (let j = c; j < c + w; j++) {
              if (used[i][j]) ok = false
            }
          }
          if (ok) options.push({ h, w })
        }
      }
      const pick = options[Math.floor(Math.random() * options.length)]!
      const area = pick.h * pick.w
      cells.push([r + 1, c + 1, area])
      for (let i = r; i < r + pick.h; i++) {
        for (let j = c; j < c + pick.w; j++) used[i][j] = true
      }
    }
  }

  return { rows: toGridSize(rowCount, colCount), cells }
}

export function variantShuqiao(template: CoordGridProps) {
  const { rowCount, colCount } = resolveGridSize(template.rows)
  return {
    rows: template.rows,
    cells: transformCoords(template.cells, rowCount, colCount),
  }
}

export function variantBudeng(template: {
  rows: BudengGridSize
  hIneq?: IneqCoord[]
  vIneq?: IneqCoord[]
  cells?: CellCoord[]
}) {
  const size = template.rows[0]
  const grid = fillSudoku(size, size)
  if (!grid) {
    return {
      ...template,
      cells: transformCoords(template.cells ?? [], size, size),
    }
  }
  const density = Math.min(
    0.55,
    Math.max(0.2, ((template.hIneq?.length ?? 0) + (template.vIneq?.length ?? 0)) / (size * 4)),
  )
  const { hIneq, vIneq } = buildInequalities(grid, density)
  const givenCount = template.cells?.length ?? 0
  return {
    rows: template.rows,
    hIneq,
    vIneq,
    cells: pickGivens(grid, Math.max(0, givenCount - 2), givenCount + 2),
  }
}

export function variantWuma(template: { rows: BudengGridSize; cells?: CellCoord[] }) {
  const size = template.rows[0]
  const grid = fillSudoku(size, size, (g, r, c, v) => {
    g[r][c] = v
    const ok = !knightUsed(g, r, c, v)
    g[r][c] = 0
    return ok
  })
  if (!grid) {
    return { ...template, cells: transformCoords(template.cells ?? [], size, size) }
  }
  const givenCount = template.cells?.length ?? 20
  return {
    rows: template.rows,
    cells: pickGivens(grid, Math.max(12, givenCount - 6), givenCount + 4),
  }
}

export function variantChuangkou(template: {
  rows: BudengGridSize
  cells?: CellCoord[]
  window?: ChuangkouWindowConfig
}) {
  const size = template.rows[0]
  const windowConfig = template.window ?? resolveDefaultChuangkouWindow(size, size)!
  const windows = parseChuangkouWindows(windowConfig)
  const grid = fillSudoku(size, size, undefined, windows)
  if (!grid) {
    return { ...template, cells: transformCoords(template.cells ?? [], size, size) }
  }
  const givenCount = template.cells?.length ?? 24
  return {
    rows: template.rows,
    cells: pickGivens(grid, Math.max(18, givenCount - 8), givenCount + 6),
    window: windowConfig,
  }
}

export type VariantKind = 'shulian' | 'shufang' | 'shuqiao' | 'budeng' | 'wuma' | 'chuangkou'

export function generateVariant(
  kind: VariantKind,
  template: Record<string, unknown>,
): Record<string, unknown> {
  switch (kind) {
    case 'shulian':
      return variantShulian(template as unknown as CoordGridProps) as unknown as Record<
        string,
        unknown
      >
    case 'shufang':
      return variantShufang(template as unknown as CoordGridProps) as unknown as Record<
        string,
        unknown
      >
    case 'shuqiao':
      return variantShuqiao(template as unknown as CoordGridProps) as unknown as Record<
        string,
        unknown
      >
    case 'budeng':
      return variantBudeng(template as Parameters<typeof variantBudeng>[0])
    case 'wuma':
      return variantWuma(template as Parameters<typeof variantWuma>[0])
    case 'chuangkou':
      return variantChuangkou(template as Parameters<typeof variantChuangkou>[0])
    default:
      return template
  }
}
