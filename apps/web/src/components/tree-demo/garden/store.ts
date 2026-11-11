// 原型的内存状态仓库。动作同步修改状态并返回「发生了什么」，界面据此放特效。
// 不用 React 的 reducer，是因为严格模式会重复调用 reducer，随机结算会不一致。

import {
  BUBBLE_MAX,
  CORE_SUBJECTS,
  COMBO_EVERY,
  COMBO_WINDOW_MS,
  FLOWER_MAX_STAGE,
  GOAL_POPS,
  GOAL_WATER_BONUS,
  MAGIC_COST,
  SUBJECTS,
  addDaysKey,
  assignSlots,
  bubbleCandidates,
  capacityOf,
  collapseHistory,
  dayLoad,
  flowersOfBud,
  settleDay,
  uid,
  type Apple,
  type Bud,
  type CoreSubject,
  type Flower,
  type GardenState,
  type Settings,
  type SettleReport,
  type SubjectKey,
} from './model'
import { createSeed } from './seed'

type Listener = () => void

export interface PopResult {
  bud: Bud
  flowers: Flower[]
  sunGain: number
  waterGain: number
  combo: number
  comboWater: boolean
  goalReached: boolean
  streakDay: number | null
}

export type MoveResult = 'ok' | 'full' | 'blocked'

export class GardenStore {
  private state: GardenState
  private readonly listeners = new Set<Listener>()
  private readonly rng: () => number

  constructor(initial: GardenState = createSeed(), rng: () => number = Math.random) {
    this.state = initial
    this.rng = rng
  }

  getState = (): GardenState => this.state

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private commit(next: GardenState): void {
    const collapsed = collapseHistory(next)
    this.state = { ...collapsed, bubbleSlots: assignSlots(collapsed.bubbleSlots, collapsed.bubbles) }
    for (const l of this.listeners) l()
  }

  private diary(state: GardenState, icon: string, text: string): GardenState {
    const entry = { id: uid('d'), t: Date.now(), icon, text }
    return { ...state, diary: [entry, ...state.diary].slice(0, 80) }
  }

  reset(): void {
    this.commit(createSeed())
  }

  setSettings(patch: Partial<Settings>): void {
    this.commit({ ...this.state, settings: { ...this.state.settings, ...patch } })
  }

  // ---------- 放学了 / 泡泡 ----------
  /** 点「放学了」：泡泡出现，先自动飞出最多 4 个 */
  startAfterSchool(): number {
    const s = this.state
    const room = BUBBLE_MAX - s.bubbles.length
    const picked = bubbleCandidates(s).slice(0, Math.max(0, room))
    const next = { ...s, afterSchool: true, bubbles: [...s.bubbles, ...picked.map((b) => b.id)] }
    this.commit(next)
    return picked.length
  }

  canAddBubble(budId: string): boolean {
    const s = this.state
    if (!s.afterSchool || s.bubbles.length >= BUBBLE_MAX) return false
    return bubbleCandidates(s).some((b) => b.id === budId)
  }

  addBubble(budId: string): boolean {
    if (!this.canAddBubble(budId)) return false
    this.commit({ ...this.state, bubbles: [...this.state.bubbles, budId] })
    return true
  }

  removeBubble(budId: string): void {
    this.commit({ ...this.state, bubbles: this.state.bubbles.filter((id) => id !== budId) })
  }

  pop(budId: string): PopResult | null {
    const s = this.state
    const bud = s.buds.find((b) => b.id === budId)
    if (!bud || !s.bubbles.includes(budId)) return null
    const count = flowersOfBud(bud)
    const makeup = bud.overdue
    const flowers: Flower[] = Array.from({ length: count }, () => ({
      id: uid('f'),
      subject: bud.subject,
      name: bud.name,
      dateKey: s.today,
      stage: 0,
      makeup,
    }))
    const sunGain = count * 2
    const waterGain = 1 + (count >= 3 ? 1 : 0)

    const now = Date.now()
    const combo = now - s.lastPopAt < COMBO_WINDOW_MS ? s.combo + 1 : 1
    const comboWater = combo > 1 && combo % COMBO_EVERY === 0
    const popsToday = s.popsToday + 1
    const goalReached = popsToday >= GOAL_POPS && !s.goalGiven
    let streak = s.streak
    let streakDay: number | null = null
    if (s.lastPopDay !== s.today) {
      streak = s.lastPopDay === addDaysKey(s.today, -1) ? s.streak + 1 : 1
      streakDay = streak
    }

    let next: GardenState = {
      ...s,
      buds: s.buds.filter((b) => b.id !== budId),
      bubbles: s.bubbles.filter((id) => id !== budId),
      flowers: [...s.flowers, ...flowers],
      sun: s.sun + sunGain,
      water: s.water + waterGain + (comboWater ? 1 : 0) + (goalReached ? GOAL_WATER_BONUS : 0),
      combo,
      lastPopAt: now,
      popsToday,
      goalGiven: s.goalGiven || goalReached,
      totalPops: s.totalPops + 1,
      streak,
      lastPopDay: s.today,
    }
    next = this.diary(next, '🫧', `戳破了「${bud.name}」，开出 ${count} 朵${SUBJECTS[bud.subject].label}花`)
    this.commit(next)
    return { bud, flowers, sunGain, waterGain, combo, comboWater, goalReached, streakDay }
  }

  // ---------- 浇水 / 阳光 ----------
  waterFlower(flowerId: string): 'ok' | 'no-water' | 'full' | 'missing' {
    const s = this.state
    const f = s.flowers.find((x) => x.id === flowerId)
    if (!f) return 'missing'
    if (f.stage >= FLOWER_MAX_STAGE) return 'full'
    if (s.water < 1) return 'no-water'
    this.commit({
      ...s,
      water: s.water - 1,
      flowers: s.flowers.map((x) => (x.id === flowerId ? { ...x, stage: x.stage + 1 } : x)),
    })
    return 'ok'
  }

  /** 阳光魔法：所有还没盛开的花阶段加 1，返回受影响的花 id */
  castMagic(): { ok: boolean; reason?: 'sun' | 'none'; ids: string[] } {
    const s = this.state
    if (s.sun < MAGIC_COST) return { ok: false, reason: 'sun', ids: [] }
    const ids = s.flowers.filter((f) => f.stage < FLOWER_MAX_STAGE).map((f) => f.id)
    if (ids.length === 0) return { ok: false, reason: 'none', ids }
    let next: GardenState = {
      ...s,
      sun: s.sun - MAGIC_COST,
      flowers: s.flowers.map((f) => (ids.includes(f.id) ? { ...f, stage: f.stage + 1 } : f)),
    }
    next = this.diary(next, '✨', `施展了阳光魔法，${ids.length} 朵花一起长大`)
    this.commit(next)
    return { ok: true, ids }
  }

  // ---------- 挪花苞 ----------
  /** 把花苞挪到某一天（dateKey）或「先不做」（null）。空中的泡泡不能挪。 */
  moveBud(budId: string, dateKey: string | null): MoveResult {
    const s = this.state
    const b = s.buds.find((x) => x.id === budId)
    if (!b || s.bubbles.includes(budId)) return 'blocked'
    if (dateKey !== null) {
      if (dateKey < s.today || dateKey > addDaysKey(s.today, 6)) return 'blocked'
      const alreadyThere = b.dateKey === dateKey && !b.overdue
      if (!alreadyThere && dayLoad(s, dateKey) + flowersOfBud(b) > capacityOf(dateKey)) return 'full'
    }
    this.commit({
      ...s,
      buds: s.buds.map((x) => (x.id === budId ? { ...x, dateKey, overdue: false } : x)),
    })
    return 'ok'
  }

  // ---------- 0 点 ----------
  simulateMidnight(): SettleReport {
    const { state, report } = settleDay(this.state, this.rng)
    const parts = [`${report.apples.length} 个苹果`]
    if (report.rainbow > 0) parts.push(`${report.rainbow} 个彩虹果`)
    this.commit(this.diary(state, '🌙', `过了 0 点，结出 ${parts.join('，')}`))
    return report
  }

  // ---------- 摘果 / 兑换 ----------
  /** 摘普通苹果：直接掉同色石头。彩虹果返回 rainbow，等孩子选堆。 */
  pickApple(appleId: string): { apple: Apple; rainbow: boolean } | null {
    const s = this.state
    const apple = s.apples.find((a) => a.id === appleId)
    if (!apple) return null
    const rest = s.apples.filter((a) => a.id !== appleId)
    if (apple.kind === 'rainbow') {
      this.commit({ ...s, apples: rest })
      return { apple, rainbow: true }
    }
    const kind: SubjectKey = apple.kind
    let next: GardenState = {
      ...s,
      apples: rest,
      stones: { ...s.stones, [kind]: s.stones[kind] + 1 },
      stoneTotal: kind === 'life' ? s.stoneTotal : s.stoneTotal + 1,
    }
    next = this.diary(next, '🍎', `摘下了 1 个${SUBJECTS[kind].label}苹果，落下一颗${SUBJECTS[kind].stone}`)
    this.commit(next)
    return { apple, rainbow: false }
  }

  /** 彩虹石算进孩子指定的一堆 */
  assignRainbow(subject: CoreSubject): void {
    const s = this.state
    let next: GardenState = {
      ...s,
      stones: { ...s.stones, [subject]: s.stones[subject] + 1 },
      stoneTotal: s.stoneTotal + 1,
    }
    next = this.diary(next, '🌈', `彩虹石放进了${SUBJECTS[subject].label}那一堆`)
    this.commit(next)
  }

  canExchange(): boolean {
    const { stones, settings } = this.state
    return CORE_SUBJECTS.every((c) => stones[c] >= settings.n)
  }

  exchange(): boolean {
    if (!this.canExchange()) return false
    const s = this.state
    const n = s.settings.n
    const stones = { ...s.stones }
    for (const c of CORE_SUBJECTS) stones[c] -= n
    let next: GardenState = { ...s, stones, exchanges: s.exchanges + 1 }
    next = this.diary(next, '🎁', `红、黄、蓝各 ${n} 颗换了一份心愿，去找爸爸妈妈兑现`)
    this.commit(next)
    return true
  }
}
