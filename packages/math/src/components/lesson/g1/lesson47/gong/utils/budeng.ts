import type { InequalityOp, IneqCoord, BudengGridSize } from "./types";

export function resolveBudengGridSize(rows: BudengGridSize): { rowCount: number; colCount: number } {
  const rowCount = rows[0];
  const colCount = rows[1] ?? rowCount;
  return { rowCount, colCount };
}

/**
 * 将线号坐标转为渲染/校验用的二维表。
 * - hIneq [行, 竖线号, 符号]：该行第 line 根竖线（从左往右），符号表示左→右，仅内部竖线 2..colCount
 * - vIneq [列, 横线号, 符号]：该列第 line 根横线（从上往下），符号表示上→下，仅内部横线 2..rowCount
 */
export function buildBudengIneqMaps(
  hIneq: IneqCoord[] = [],
  vIneq: IneqCoord[] = [],
  rowCount: number,
  colCount: number,
): { hMap: InequalityOp[][]; vMap: InequalityOp[][] } {
  const hMap: InequalityOp[][] = Array.from({ length: rowCount }, () =>
    Array<InequalityOp>(Math.max(0, colCount - 1)).fill(null),
  );
  const vMap: InequalityOp[][] = Array.from({ length: Math.max(0, rowCount - 1) }, () =>
    Array<InequalityOp>(colCount).fill(null),
  );

  for (const [row, line, op] of hIneq) {
    if (!op || row < 1 || row > rowCount) continue;
    if (line < 2 || line > colCount) continue;
    hMap[row - 1][line - 2] = op;
  }

  for (const [col, line, op] of vIneq) {
    if (!op || col < 1 || col > colCount) continue;
    if (line < 2 || line > rowCount) continue;
    vMap[line - 2][col - 1] = op;
  }

  return { hMap, vMap };
}
