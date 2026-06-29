import type { HLineCoord, RegionPos, VLineCoord } from "./types";

const JUCHI_THICK = "2px solid var(--gong-text2)";
const JUCHI_THIN = "0.5px solid var(--gong-border2)";

function isValidHLineCoord(row: number, line: number, rowCount: number, colCount: number): boolean {
  return row >= 1 && row <= rowCount && line >= 1 && line <= colCount + 1;
}

function isValidVLineCoord(col: number, line: number, rowCount: number, colCount: number): boolean {
  return col >= 1 && col <= colCount && line >= 1 && line <= rowCount + 1;
}

/** 竖线 1 与 colCount+1 为左右外框，恒为粗线 */
function isOuterVerticalLine(line: number, colCount: number): boolean {
  return line <= 1 || line >= colCount + 1;
}

/** 横线 1 与 rowCount+1 为上下外框，恒为粗线 */
function isOuterHorizontalLine(line: number, rowCount: number): boolean {
  return line <= 1 || line >= rowCount + 1;
}

export function buildJuchiLineSets(
  hLine: HLineCoord[] = [],
  vLine: VLineCoord[] = [],
  rowCount: number,
  colCount: number,
) {
  const hSet = new Set<string>();
  const vSet = new Set<string>();

  for (const [row, line] of hLine) {
    if (isValidHLineCoord(row, line, rowCount, colCount)) {
      hSet.add(`${row},${line}`);
    }
  }
  for (const [col, line] of vLine) {
    if (isValidVLineCoord(col, line, rowCount, colCount)) {
      vSet.add(`${col},${line}`);
    }
  }

  return { hSet, vSet };
}

function isVerticalLineThick(
  hSet: Set<string>,
  row: number,
  line: number,
  colCount: number,
): boolean {
  if (isOuterVerticalLine(line, colCount)) return true;
  return hSet.has(`${row},${line}`);
}

function isHorizontalLineThick(
  vSet: Set<string>,
  col: number,
  line: number,
  rowCount: number,
): boolean {
  if (isOuterHorizontalLine(line, rowCount)) return true;
  return vSet.has(`${col},${line}`);
}

export interface JuchiCellBorderStyle {
  borderTop: string;
  borderRight: string;
  borderBottom: string;
  borderLeft: string;
}

/**
 * 格子 (R,C) 四边对应线号（1-indexed）：
 * - 左边 = 第 C 根竖线；右边 = 第 C+1 根竖线
 * - 上边 = 第 R 根横线；下边 = 第 R+1 根横线
 * 外框线（竖线 1 / colCount+1，横线 1 / rowCount+1）恒为粗线。
 */
export function getJuchiCellBorderStyle(
  r: number,
  c: number,
  rowCount: number,
  colCount: number,
  hSet: Set<string>,
  vSet: Set<string>,
): JuchiCellBorderStyle {
  const R = r + 1;
  const C = c + 1;
  const thick = (yes: boolean) => (yes ? JUCHI_THICK : JUCHI_THIN);

  return {
    borderLeft: thick(isVerticalLineThick(hSet, R, C, colCount)),
    borderTop: thick(isHorizontalLineThick(vSet, C, R, rowCount)),
    borderRight: thick(isVerticalLineThick(hSet, R, C + 1, colCount)),
    borderBottom: thick(isHorizontalLineThick(vSet, C, R + 1, rowCount)),
  };
}

class UnionFind {
  private parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }

  find(x: number): number {
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }

  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

/** 由宫界线推导不规则宫分组，供校验使用 */
export function buildJuchiRegionsFromLines(
  rowCount: number,
  colCount: number,
  hLine: HLineCoord[] = [],
  vLine: VLineCoord[] = [],
): RegionPos[][] {
  const { hSet, vSet } = buildJuchiLineSets(hLine, vLine, rowCount, colCount);
  const index = (r: number, c: number) => r * colCount + c;
  const uf = new UnionFind(rowCount * colCount);

  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      const R = r + 1;
      const C = c + 1;
      // 两格之间的竖线为第 C 根（右格左缘）；外框线 1 不会出现在 c=0 的合并判定中
      if (c > 0 && !isVerticalLineThick(hSet, R, C, colCount)) {
        uf.union(index(r, c), index(r, c - 1));
      }
      // 两格之间的横线为第 R 根（下格上缘）；外框线 1 不会出现在 r=0 的合并判定中
      if (r > 0 && !isHorizontalLineThick(vSet, C, R, rowCount)) {
        uf.union(index(r, c), index(r - 1, c));
      }
    }
  }

  const groups = new Map<number, RegionPos[]>();
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      const root = uf.find(index(r, c));
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root)!.push([r + 1, c + 1]);
    }
  }

  return [...groups.values()];
}
