// 时间树原型的纯规则：类型、常量、日期工具、结算。不含任何界面和网络请求。
// 规则出处是 tree.md；这里只在内存里跑，随机数由调用方传入，方便复现。

export type SubjectKey = 'chinese' | 'math' | 'english' | 'life'
/** 参与汇总、兑换的三个学科 */
export type CoreSubject = 'chinese' | 'math' | 'english'
export const CORE_SUBJECTS: CoreSubject[] = ['chinese', 'math', 'english']

export interface SubjectMeta {
  label: string
  emoji: string
  /** 苹果和石头的主色 */
  color: string
  /** 描边深色 */
  deep: string
  /** 浅底色，泡泡和卡片用 */
  tint: string
  stone: string
}

export const SUBJECTS: Record<SubjectKey, SubjectMeta> = {
  chinese: { label: '语文', emoji: '📖', color: '#ef4444', deep: '#b91c1c', tint: '#fecaca', stone: '红玛瑙' },
  math: { label: '数学', emoji: '🔢', color: '#facc15', deep: '#a16207', tint: '#fef08a', stone: '黄水晶' },
  english: { label: '英语', emoji: '🔤', color: '#3b82f6', deep: '#1d4ed8', tint: '#bfdbfe', stone: '蓝宝石' },
  life: { label: '生活', emoji: '🌱', color: '#22c55e', deep: '#15803d', tint: '#bbf7d0', stone: '绿松石' },
}

// ---------- 参数（本期固定的部分） ----------
export const BUBBLE_MAX = 4
export const RAINBOW_RATE = 0.1
export const PITY_LIMIT = 20
export const MAGIC_COST = 10
export const FLOWER_MAX_STAGE = 3
export const GOAL_POPS = 3
export const GOAL_WATER_BONUS = 2
export const COMBO_WINDOW_MS = 4000
export const COMBO_EVERY = 3
export const CAPACITY_WEEKDAY = 14
export const CAPACITY_WEEKEND = 18
export const DEFAULT_K = 2
export const DEFAULT_N = 8
export const K_RANGE = [1, 3] as const
export const N_RANGE = [6, 12] as const

export interface Settings {
  /** 几朵花结一个苹果 */
  k: number
  /** 每种石头兑换所需颗数 */
  n: number
}

// ---------- 数据结构 ----------
export interface Bud {
  id: string
  name: string
  subject: SubjectKey
  minutes: number
  /** null 表示在「先不做」里 */
  dateKey: string | null
  /** 过了计划那天还没做完 */
  overdue: boolean
}

export interface Flower {
  id: string
  subject: SubjectKey
  name: string
  dateKey: string
  /** 浇水阶段 0–3，只影响外观，不影响结算 */
  stage: number
  /** 补做出来的花，不占当天容量 */
  makeup: boolean
}

export type AppleKind = SubjectKey | 'rainbow'

export interface Apple {
  id: string
  kind: AppleKind
  /** 彩虹果原本来自哪一科，仅用于展示 */
  from?: CoreSubject
  dateKey: string
}

export type StoneCount = Record<SubjectKey, number>

export interface DiaryEntry {
  id: string
  t: number
  icon: string
  text: string
}

export interface GardenState {
  today: string
  buds: Bud[]
  flowers: Flower[]
  apples: Apple[]
  stones: StoneCount
  /** 累计掉过的学科石头颗数，兑换不会减少它 */
  stoneTotal: number
  /** 余花：按学科留到明天继续攒 */
  remainder: Record<CoreSubject, number>
  /** 连续没有彩虹果的普通学科苹果数 */
  pity: number
  /** 树干年轮圈数：已经收起的空历史叶区 */
  rings: number
  /** 当前还有东西、没被收起的历史日期 */
  aliveHistory: string[]
  sun: number
  water: number
  streak: number
  lastPopDay: string | null
  afterSchool: boolean
  /** 正飘在空中的泡泡（花苞 id），最多 4 个 */
  bubbles: string[]
  /** 每个泡泡占用的天空位置 0–3，其余泡泡被戳破后不会跳位 */
  bubbleSlots: Record<string, number>
  popsToday: number
  goalGiven: boolean
  lastPopAt: number
  combo: number
  exchanges: number
  totalPops: number
  settings: Settings
  diary: DiaryEntry[]
}

// ---------- 日期工具（本地时间） ----------
const pad = (n: number): string => String(n).padStart(2, '0')

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function fromKey(key: string): Date {
  return new Date(`${key}T12:00:00`)
}

export function addDaysKey(key: string, n: number): string {
  const d = fromKey(key)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

/** b 比 a 晚几天 */
export function diffDays(a: string, b: string): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86400000)
}

/** 0 是周日 */
export function weekdayOf(key: string): number {
  return fromKey(key).getDay()
}

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

export function weekdayLabel(key: string): string {
  return `周${WEEKDAY_NAMES[weekdayOf(key)]}`
}

export function shortDate(key: string): string {
  const d = fromKey(key)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function capacityOf(key: string): number {
  const w = weekdayOf(key)
  return w === 0 || w === 6 ? CAPACITY_WEEKEND : CAPACITY_WEEKDAY
}

// ---------- 花的数量 ----------
export function flowersForMinutes(subject: SubjectKey, minutes: number): number {
  if (subject === 'life') return 1
  if (minutes <= 10) return 1
  if (minutes <= 20) return 2
  if (minutes <= 40) return 3
  return 4
}

export function flowersOfBud(bud: Bud): number {
  return flowersForMinutes(bud.subject, bud.minutes)
}

/** 某一天已排的花数：还没做的花苞按应开的花数，加上当天开出来的花（补做不算） */
export function dayLoad(state: GardenState, key: string): number {
  const planned = state.buds
    .filter((b) => b.dateKey === key && !b.overdue)
    .reduce((sum, b) => sum + flowersOfBud(b), 0)
  const bloomed = state.flowers.filter((f) => f.dateKey === key && !f.makeup).length
  return planned + bloomed
}

// ---------- 泡泡候选 ----------
/** 今天可以飞出来的花苞：今天的青绿花苞和所有灰色花苞（已经在空中的除外） */
export function bubbleCandidates(state: GardenState): Bud[] {
  const inAir = new Set(state.bubbles)
  const today = state.buds.filter((b) => b.dateKey === state.today && !b.overdue && !inAir.has(b.id))
  const overdue = state.buds.filter((b) => b.overdue && !inAir.has(b.id))
  return [...today, ...overdue]
}

// ---------- 0 点结算 ----------
export interface SettleReport {
  apples: Apple[]
  rainbow: number
  bloomedFlowers: number
  lapsedBubbles: number
  newOverdue: number
  ringAdded: boolean
  newToday: string
}

let idCounter = 0
export function uid(prefix: string): string {
  idCounter += 1
  return `${prefix}${idCounter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
}

/** 给空中的泡泡分配稳定的天空位置：已有的保持不变，新的占最小的空位 */
export function assignSlots(prev: Record<string, number>, ids: string[]): Record<string, number> {
  const next: Record<string, number> = {}
  const used = new Set<number>()
  for (const id of ids) {
    if (prev[id] !== undefined) {
      next[id] = prev[id]
      used.add(prev[id])
    }
  }
  for (const id of ids) {
    if (next[id] !== undefined) continue
    let slot = 0
    while (used.has(slot)) slot += 1
    next[id] = slot
    used.add(slot)
  }
  return next
}

/** 把已经没有东西的历史日期收进年轮 */
export function collapseHistory(state: GardenState): GardenState {
  const past = new Set<string>()
  for (const a of state.apples) if (a.dateKey < state.today) past.add(a.dateKey)
  for (const b of state.buds) if (b.dateKey && b.dateKey < state.today) past.add(b.dateKey)
  const alive = state.aliveHistory.filter((k) => past.has(k))
  const folded = state.aliveHistory.length - alive.length
  for (const k of past) if (!alive.includes(k)) alive.push(k)
  if (folded === 0 && alive.length === state.aliveHistory.length && alive.every((k, i) => k === state.aliveHistory[i])) {
    return state
  }
  return { ...state, rings: state.rings + folded, aliveHistory: alive }
}

export function settleDay(
  state: GardenState,
  rng: () => number,
): { state: GardenState; report: SettleReport } {
  const ended = state.today
  const lapsedBubbles = state.bubbles.length

  // 1+2 泡泡变回花苞；今天没做完的花苞变灰
  let newOverdue = 0
  const buds = state.buds.map((b) => {
    if (b.dateKey === ended && !b.overdue) {
      newOverdue += 1
      return { ...b, overdue: true }
    }
    return b
  })

  // 3 花结苹果
  const todays = state.flowers.filter((f) => f.dateKey === ended)
  const bloomedFlowers = todays.filter((f) => f.stage >= FLOWER_MAX_STAGE).length
  const remainder = { ...state.remainder }
  const apples: Apple[] = []
  let pity = state.pity
  let rainbow = 0
  for (const subject of CORE_SUBJECTS) {
    const count = todays.filter((f) => f.subject === subject).length
    const total = remainder[subject] + count
    const made = Math.floor(total / state.settings.k)
    remainder[subject] = total - made * state.settings.k
    for (let i = 0; i < made; i += 1) {
      // 4 彩虹果：10% 概率，连续 20 个普通苹果后必出
      const isRainbow = pity >= PITY_LIMIT || rng() < RAINBOW_RATE
      if (isRainbow) {
        pity = 0
        rainbow += 1
        apples.push({ id: uid('a'), kind: 'rainbow', from: subject, dateKey: ended })
      } else {
        pity += 1
        apples.push({ id: uid('a'), kind: subject, dateKey: ended })
      }
    }
  }
  // 生活事项：一朵花一个绿苹果，不汇总、不进彩虹
  const lifeCount = todays.filter((x) => x.subject === 'life').length
  for (let i = 0; i < lifeCount; i += 1) {
    apples.push({ id: uid('a'), kind: 'life', dateKey: ended })
  }

  // 5 树冠滚动
  const newToday = addDaysKey(ended, 1)
  let next: GardenState = {
    ...state,
    today: newToday,
    buds,
    flowers: state.flowers.filter((f) => f.dateKey !== ended),
    apples: [...state.apples, ...apples],
    remainder,
    pity,
    bubbles: [],
    afterSchool: false,
    popsToday: 0,
    goalGiven: false,
    combo: 0,
  }

  // 6 收起空的历史叶区
  const hasItems =
    next.apples.some((a) => a.dateKey === ended) || next.buds.some((b) => b.dateKey === ended)
  let ringAdded = false
  if (!hasItems) {
    next = { ...next, rings: next.rings + 1 }
    ringAdded = true
  }
  next = collapseHistory(next)

  return {
    state: next,
    report: { apples, rainbow, bloomedFlowers, lapsedBubbles, newOverdue, ringAdded, newToday },
  }
}
