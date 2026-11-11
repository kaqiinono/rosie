import type { SubjectKey } from '../data'

// 与 TimeTreeScene（卡通版）保持同一套摆位，两个预览可以直接对照。

export const TRUNK_HEIGHT = 5.4
export const TRUNK_R_BOTTOM = 0.62
export const TRUNK_R_TOP = 0.4
export const BRANCH_LENGTH = 2.9
export const HISTORY_LENGTH = 2.1
export const BRANCH_HEIGHTS = [3.3, 3.9, 4.5, 3.6, 4.2, 4.8, 3.0]
export const HISTORY_HEIGHTS = [2.3, 2.7, 1.95, 2.45]
export const FIRST_ALPHA = -75

export const PILE_SPOTS: Record<SubjectKey, [number, number, number]> = {
  chinese: [-1.9, 0, 2.9],
  math: [0, 0, 3.1],
  english: [1.9, 0, 2.9],
  life: [3.7, 0, 1.7],
}

export const BUBBLE_SPOTS: [number, number, number][] = [
  [-3.3, 7.9, 0.8],
  [-1.15, 8.7, 1.5],
  [1.3, 8.0, 0.3],
  [3.4, 8.8, 1.1],
]

/** 树干在高度 y 处的基础半径（未叠加板根外扩）。 */
export function trunkRadiusAt(y: number): number {
  return TRUNK_R_BOTTOM - (TRUNK_R_BOTTOM - TRUNK_R_TOP) * (y / TRUNK_HEIGHT)
}

/** 石头堆的静态摆位：3-2-1 的金字塔。 */
export function pilePositions(count: number): [number, number, number][] {
  const rows = [3, 2, 1]
  const out: [number, number, number][] = []
  let layer = 0
  while (out.length < count) {
    const size = rows[layer % rows.length]
    for (let j = 0; j < size && out.length < count; j++) {
      out.push([(j - (size - 1) / 2) * 0.5, 0.2 + layer * 0.34, ((layer + j) % 2) * 0.08])
    }
    layer++
  }
  return out
}
