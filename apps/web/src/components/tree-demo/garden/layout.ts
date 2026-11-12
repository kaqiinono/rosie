// 树冠分区的几何和物件摆放，使用 640 × 600 的原始绘图坐标。

import {
  addDaysKey,
  capacityOf,
  dayLoad,
  shortDate,
  weekdayLabel,
  weekdayOf,
  type GardenState,
} from './model'

// 取景范围包含树冠摇摆的两端，以及树根下方的投影。
export const TREE_VIEW_BOX = '14 36 612 562'
export const MAX_ITEMS_PER_REGION = 9
export const MAX_HISTORY_REGIONS = 6

interface Geom {
  cx: number
  cy: number
  rx: number
  ry: number
}

/** 七片彩色叶区：今天在树冠最显眼的位置，其余六天顺时针排开 */
const FUTURE_GEOMS: Geom[] = [
  { cx: 320, cy: 168, rx: 92, ry: 66 },
  { cx: 452, cy: 168, rx: 72, ry: 54 },
  { cx: 512, cy: 252, rx: 66, ry: 50 },
  { cx: 408, cy: 266, rx: 72, ry: 54 },
  { cx: 232, cy: 266, rx: 72, ry: 54 },
  { cx: 128, cy: 252, rx: 66, ry: 50 },
  { cx: 188, cy: 168, rx: 72, ry: 54 },
]

/** 历史叶区：更小、褪色，退到树冠外圈和下沿，最近的离树干最近 */
const HISTORY_GEOMS: Geom[] = [
  { cx: 214, cy: 360, rx: 52, ry: 38 },
  { cx: 426, cy: 360, rx: 52, ry: 38 },
  { cx: 112, cy: 346, rx: 46, ry: 34 },
  { cx: 528, cy: 346, rx: 46, ry: 34 },
  { cx: 146, cy: 436, rx: 44, ry: 32 },
  { cx: 494, cy: 436, rx: 44, ry: 32 },
]

/** 星期颜色：下标是 Date.getDay()，避开苹果用的红、黄、蓝、绿 */
const WEEKDAY_FILL = ['#e7d9b8', '#c4b5fd', '#fbcfe8', '#99f6e4', '#fed7aa', '#f5d0fe', '#bae6fd']
const WEEKDAY_STROKE = ['#a8925f', '#7c5fd6', '#d9609a', '#2f9e8f', '#d98a3d', '#b45fcf', '#4a9bd0']
export const HISTORY_FILL = '#cfc6b6'
export const HISTORY_STROKE = '#9a8c78'

/** 单位椭圆里的 9 个物件位置（乘以 rx、ry），苹果先占靠上的位置 */
const SLOTS: [number, number][] = [
  [-0.21, 0.02],
  [0.21, 0.02],
  [0, -0.5],
  [-0.55, -0.42],
  [0.55, -0.42],
  [-0.62, 0.02],
  [0.62, 0.02],
  [-0.3, 0.5],
  [0.3, 0.5],
]

export type RegionItem =
  | { kind: 'apple'; id: string }
  | { kind: 'flower'; id: string }
  | { kind: 'bud'; id: string }

export interface PlacedItem {
  item: RegionItem
  x: number
  y: number
}

export interface Region {
  key: string
  tone: 'today' | 'future' | 'history'
  /** 历史合并区为空 */
  dateKey: string | null
  /** 「更早」合并区包含的日期 */
  mergedKeys: string[]
  weekday: number
  label: string
  sub: string
  fill: string
  stroke: string
  geom: Geom
  placed: PlacedItem[]
  overflow: number
  load: number
  capacity: number
  plannedMinutes?: { completed: number; total: number }
  /** 物件缩放：小叶区里的东西更小 */
  scale: number
}

function placeItems(items: RegionItem[], geom: Geom): { placed: PlacedItem[]; overflow: number } {
  const visible = items.slice(0, MAX_ITEMS_PER_REGION)
  const placed = visible.map((item, i) => {
    const [ux, uy] = SLOTS[i] ?? [0, 0]
    return { item, x: geom.cx + ux * geom.rx, y: geom.cy + uy * geom.ry }
  })
  return { placed, overflow: Math.max(0, items.length - visible.length) }
}

function itemsOfDates(state: GardenState, keys: string[]): RegionItem[] {
  const set = new Set(keys)
  return [
    ...state.apples.filter((a) => set.has(a.dateKey)).map((a): RegionItem => ({ kind: 'apple', id: a.id })),
    ...state.flowers.filter((f) => set.has(f.dateKey)).map((f): RegionItem => ({ kind: 'flower', id: f.id })),
    ...state.buds
      .filter((b) => b.dateKey !== null && set.has(b.dateKey))
      .map((b): RegionItem => ({ kind: 'bud', id: b.id })),
  ]
}

export function buildRegions(state: GardenState): Region[] {
  const regions: Region[] = []

  // 历史叶区：还有苹果或花苞的日期，最近的在前
  const pastKeys = state.aliveHistory.filter((k) => k < state.today).sort((a, b) => (a < b ? 1 : -1))
  const groups: string[][] =
    pastKeys.length <= MAX_HISTORY_REGIONS
      ? pastKeys.map((k) => [k])
      : [...pastKeys.slice(0, MAX_HISTORY_REGIONS - 1).map((k) => [k]), pastKeys.slice(MAX_HISTORY_REGIONS - 1)]
  groups.forEach((keys, i) => {
    const geom = HISTORY_GEOMS[i]
    if (!geom) return
    const merged = keys.length > 1
    const first = keys[0]
    const { placed, overflow } = placeItems(itemsOfDates(state, keys), geom)
    regions.push({
      key: `h${i}`,
      tone: 'history',
      dateKey: merged ? null : first,
      mergedKeys: merged ? keys : [],
      weekday: weekdayOf(first),
      label: merged ? '更早' : weekdayLabel(first),
      sub: merged ? `${keys.length} 天` : shortDate(first),
      fill: HISTORY_FILL,
      stroke: HISTORY_STROKE,
      geom,
      placed,
      overflow,
      load: 0,
      capacity: 0,
      scale: 0.72,
    })
  })

  // 七天：先画远的，今天最后画在最上面
  FUTURE_GEOMS.forEach((geom, offset) => {
    const key = addDaysKey(state.today, offset)
    const w = weekdayOf(key)
    const { placed, overflow } = placeItems(itemsOfDates(state, [key]), geom)
    regions.push({
      key: `d${offset}`,
      tone: offset === 0 ? 'today' : 'future',
      dateKey: key,
      mergedKeys: [],
      weekday: w,
      label: weekdayLabel(key),
      sub: offset === 0 ? `今天 ${shortDate(key)}` : shortDate(key),
      fill: WEEKDAY_FILL[w],
      stroke: WEEKDAY_STROKE[w],
      geom,
      placed,
      overflow,
      load: dayLoad(state, key),
      capacity: capacityOf(key),
      scale: offset === 0 ? 1 : 0.86,
    })
  })

  // 绘制顺序：历史 → 远的天 → 今天
  const history = regions.filter((r) => r.tone === 'history')
  const future = regions.filter((r) => r.tone !== 'history')
  return [...history, ...future.reverse()]
}

/** 今天叶区的中心，花苞戳破后种子飞向这里 */
export function todayCenter(): { x: number; y: number } {
  return { x: FUTURE_GEOMS[0].cx, y: FUTURE_GEOMS[0].cy }
}

export const TRUNK_TOP_Y = 270
export const GROUND_Y = 572

/** 树干在某个高度的半宽，用来画年轮 */
export function trunkHalfWidth(y: number): number {
  return 18 + ((y - 380) / 190) * 20
}
