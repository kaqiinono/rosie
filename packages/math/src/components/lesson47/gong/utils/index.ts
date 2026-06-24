import type { BudengGridSize, CellCoord, ChuangkouWindowConfig } from "./types";

export function coordsToGrid(rows: number, cols: number, cells: CellCoord[]): number[][] {
  const grid = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  for (const [r, c, v] of cells) {
    if (r >= 1 && r <= rows && c >= 1 && c <= cols) {
      grid[r - 1][c - 1] = v;
    }
  }
  return grid;
}

export function bridgeKey(a: { row: number; col: number }, b: { row: number; col: number }): string {
  const ka = `${a.row},${a.col}`;
  const kb = `${b.row},${b.col}`;
  return [ka, kb].sort().join("-");
}

export function islandCoordKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function sudokuBoxSize(n: number): number {
  const s = Math.sqrt(n);
  return Number.isInteger(s) ? s : 0;
}

export function isSudokuBoxBorderRight(c: number, colCount: number, boxSize: number): boolean {
  return boxSize > 0 && (c + 1) % boxSize === 0 && c < colCount - 1;
}

export function isSudokuBoxBorderBottom(r: number, rowCount: number, boxSize: number): boolean {
  return boxSize > 0 && (r + 1) % boxSize === 0 && r < rowCount - 1;
}

export function resolveGridSize(rows: BudengGridSize): { rowCount: number; colCount: number } {
  const rowCount = rows[0];
  const colCount = rows[1] ?? rowCount;
  return { rowCount, colCount };
}

export function toGridSize(rowCount: number, colCount: number): BudengGridSize {
  return colCount === rowCount ? [rowCount] : [rowCount, colCount];
}

export interface WindowRegion {
  r1: number;
  r2: number;
  c1: number;
  c2: number;
}

export function parseChuangkouWindows(window: ChuangkouWindowConfig): WindowRegion[] {
  const [positions, size] = window;
  const winRows = size[0];
  const winCols = size[1] ?? winRows;
  return positions.map(([startRow, startCol]) => ({
    r1: startRow - 1,
    r2: startRow - 1 + winRows - 1,
    c1: startCol - 1,
    c2: startCol - 1 + winCols - 1,
  }));
}

/** window 未传或 positions 为空 */
export function isChuangkouWindowEmpty(window?: ChuangkouWindowConfig | null): boolean {
  if (!window) return true;
  return window[0].length === 0;
}

/**
 * 默认四窗口布局：窗口尺寸 = 宫格边长，窗口之间间隔 1 格，四边留白对称。
 * 9×9 时为 [[2,2],[2,6],[6,2],[6,6]] + [3,3]。
 */
export function resolveDefaultChuangkouWindow(
  rowCount: number,
  colCount: number,
): ChuangkouWindowConfig | null {
  if (rowCount !== colCount) return null;
  const boxSize = sudokuBoxSize(rowCount);
  if (boxSize <= 0) return null;

  const winSize = boxSize;
  const gap = 1;
  const outerMargin = (rowCount - (2 * winSize + gap)) / 2;
  if (!Number.isInteger(outerMargin) || outerMargin < 0) return null;

  const start = outerMargin + 1;
  const stride = winSize + gap;
  const positions: [number, number][] = [];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      positions.push([start + i * stride, start + j * stride]);
    }
  }
  return [positions, [winSize, winSize]] as ChuangkouWindowConfig;
}

export function resolveChuangkouWindow(
  rowCount: number,
  colCount: number,
  window?: ChuangkouWindowConfig | null,
): ChuangkouWindowConfig {
  if (!isChuangkouWindowEmpty(window)) return window!;
  return resolveDefaultChuangkouWindow(rowCount, colCount) ?? [[], [1]];
}

export function isInWindowRegions(r: number, c: number, regions: WindowRegion[]): boolean {
  return regions.some(({ r1, r2, c1, c2 }) => r >= r1 && r <= r2 && c >= c1 && c <= c2);
}

export function isRectBoxBorderRight(c: number, colCount: number, boxCols: number): boolean {
  return boxCols > 0 && (c + 1) % boxCols === 0 && c < colCount - 1;
}

export function isRectBoxBorderBottom(r: number, rowCount: number, boxRows: number): boolean {
  return boxRows > 0 && (r + 1) % boxRows === 0 && r < rowCount - 1;
}

export function resolveSudokuBoxDimensions(
  rowCount: number,
  colCount: number,
): { boxRows: number; boxCols: number } | null {
  if (rowCount !== colCount) return null;
  const s = Math.sqrt(rowCount);
  if (Number.isInteger(s)) return { boxRows: s, boxCols: s };
  if (rowCount === 6) return { boxRows: 2, boxCols: 3 };
  return null;
}

export function isOnSudokuDiagonal(r: number, c: number, size: number): boolean {
  return r === c || r + c === size - 1;
}

/** 国际象棋马步偏移 */
export const KNIGHT_DELTAS = [
  [2, 1],
  [2, -1],
  [-2, 1],
  [-2, -1],
  [1, 2],
  [1, -2],
  [-1, 2],
  [-1, -2],
] as const;

/** 棋盘内从 (r,c) 出发马步可达的格子（0-indexed） */
export function getKnightCells(
  r: number,
  c: number,
  rowCount: number,
  colCount: number,
): { r: number; c: number }[] {
  const cells: { r: number; c: number }[] = [];
  for (const [dr, dc] of KNIGHT_DELTAS) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < rowCount && nc >= 0 && nc < colCount) {
      cells.push({ r: nr, c: nc });
    }
  }
  return cells;
}

export function cellCoordKey(r: number, c: number): string {
  return `${r}-${c}`;
}
