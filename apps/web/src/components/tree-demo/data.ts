// 时间成长树外观预览用的固定示例数据。本文件不含任何业务逻辑，也不读写 Supabase。

export type SubjectKey = 'chinese' | 'math' | 'english' | 'life'

export interface SubjectStyle {
  label: string
  /** 苹果颜色 */
  apple: string
  /** 石头名称 */
  stone: string
}

export const SUBJECTS: Record<SubjectKey, SubjectStyle> = {
  chinese: { label: '语文', apple: '#ef4444', stone: '红玛瑙' },
  math: { label: '数学', apple: '#facc15', stone: '黄水晶' },
  english: { label: '英语', apple: '#3b82f6', stone: '蓝宝石' },
  life: { label: '生活', apple: '#22c55e', stone: '绿松石' },
}

export type TreeItem =
  | { kind: 'bud'; subject: SubjectKey }
  | { kind: 'flower'; subject: SubjectKey; count: number }
  | { kind: 'grayBud'; subject: SubjectKey }
  | { kind: 'apple'; subject: SubjectKey }
  | { kind: 'rainbow' }

export interface BranchData {
  /** 距离今天的天数，0 是今天，负数是历史枝 */
  offset: number
  weekday: number
  label: string
  color: string
  isToday: boolean
  /** 是否周末（位置更少） */
  weekend: boolean
  items: TreeItem[]
}

/** 星期对应的彩枝颜色，避开苹果用的红、黄、蓝、绿。下标是 Date.getDay()，0 是周日。 */
export const WEEKDAY_COLORS = [
  '#d9c7a3',
  '#a78bfa',
  '#f9a8d4',
  '#5eead4',
  '#fdba74',
  '#f0abfc',
  '#7dd3fc',
]
export const HISTORY_COLOR = '#b7a99a'

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function dayLabel(d: Date): string {
  return `周${WEEKDAY_NAMES[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`
}

// 未来六天的花苞样例（按天循环取用）。
const PLANNED_SAMPLES: TreeItem[][] = [
  [
    { kind: 'bud', subject: 'chinese' },
    { kind: 'bud', subject: 'english' },
    { kind: 'bud', subject: 'math' },
    { kind: 'bud', subject: 'life' },
  ],
  [
    { kind: 'bud', subject: 'chinese' },
    { kind: 'bud', subject: 'math' },
    { kind: 'bud', subject: 'english' },
    { kind: 'bud', subject: 'chinese' },
  ],
  [
    { kind: 'bud', subject: 'english' },
    { kind: 'bud', subject: 'math' },
    { kind: 'bud', subject: 'life' },
    { kind: 'bud', subject: 'chinese' },
  ],
]

// 今天：已经开花的事 + 还没做的花苞。
const TODAY_ITEMS: TreeItem[] = [
  { kind: 'flower', subject: 'chinese', count: 2 },
  { kind: 'flower', subject: 'math', count: 3 },
  { kind: 'bud', subject: 'english' },
  { kind: 'bud', subject: 'life' },
]

// 历史枝：昨天起往前，枝上挂着没摘的苹果和没补做的灰色花苞。
const HISTORY_ITEMS: TreeItem[][] = [
  [
    { kind: 'apple', subject: 'chinese' },
    { kind: 'apple', subject: 'english' },
    { kind: 'grayBud', subject: 'math' },
  ],
  [{ kind: 'apple', subject: 'math' }],
  [{ kind: 'rainbow' }, { kind: 'grayBud', subject: 'chinese' }],
  [
    { kind: 'apple', subject: 'life' },
    { kind: 'apple', subject: 'english' },
  ],
]

function makeBranch(base: Date, offset: number, items: TreeItem[]): BranchData {
  const d = addDays(base, offset)
  const weekday = d.getDay()
  const weekend = weekday === 0 || weekday === 6
  return {
    offset,
    weekday,
    label: offset === 0 ? `今天 ${d.getMonth() + 1}/${d.getDate()}` : dayLabel(d),
    color: offset >= 0 ? WEEKDAY_COLORS[weekday] : HISTORY_COLOR,
    isToday: offset === 0,
    weekend,
    items,
  }
}

export function buildSevenDays(base: Date): BranchData[] {
  return Array.from({ length: 7 }, (_, i) => {
    if (i === 0) return makeBranch(base, 0, TODAY_ITEMS)
    const sample = PLANNED_SAMPLES[(i - 1) % PLANNED_SAMPLES.length]
    const d = addDays(base, i)
    const slots = d.getDay() === 0 || d.getDay() === 6 ? 3 : 4
    return makeBranch(base, i, sample.slice(0, slots))
  })
}

export function buildHistory(base: Date): BranchData[] {
  return HISTORY_ITEMS.map((items, i) => makeBranch(base, -(i + 1), items))
}

export interface BubbleData {
  subject: SubjectKey
  title: string
}

export const BUBBLES: BubbleData[] = [
  { subject: 'chinese', title: '单课预习' },
  { subject: 'english', title: '每日单词' },
  { subject: 'math', title: '每日三道题' },
  { subject: 'english', title: '背三句话' },
]

export interface StonePile {
  subject: SubjectKey
  count: number
}

export const STONE_PILES: StonePile[] = [
  { subject: 'chinese', count: 5 },
  { subject: 'math', count: 3 },
  { subject: 'english', count: 6 },
  { subject: 'life', count: 4 },
]

/** 树干上的年轮：已经收进树干的空历史枝 */
export const TRUNK_RINGS = 4
