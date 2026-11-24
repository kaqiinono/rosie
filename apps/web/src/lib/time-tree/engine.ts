import { flowerBudget, flowerQuestionProgress, nextFlowerSession, weeklyHomeworkStart } from './flowers'
import {
  completionReward,
  defaultTomatoPrices,
  homeworkTomatoReward,
  isEarly,
  isTomatoDoubleEligible,
  tomatoPrices,
  tomatoWallet,
} from './rewards'
import { awardDailyRainbow, harvestSteps } from './harvest'
import { cycleAvailableFrom, cycleBubbleIds, homeworkCycleKey, isClosedHomeworkCycle } from './cycleHomework'
import { CORE_SUBJECTS } from '@/components/tree-demo/garden/model'
import {
  SUN_MAGIC_COST,
  canGrowWithSun,
  dayOf,
  defaultRules,
  isExhaustedPendingStep,
  isInstantHomework,
  isMustDo,
  lifeWishThreshold,
  shift,
  type TreeAction,
  type TreeData,
  type WorkStep,
} from './types'

export class TreeConflict extends Error {}
function requireState(ok: unknown, message: string): asserts ok {
  if (!ok) throw new TreeConflict(message)
}

function walletForTomatoPurchase(tree: TreeData, expectedPrice: number, price: number) {
  requireState(expectedPrice === price, '番茄兑换价格已更新，请查看后重试。')
  const wallet = tree.tomatoWallet ??= tomatoWallet(tree)
  requireState(wallet.earned - wallet.spent >= price, `可用番茄不足 ${price} 颗。`)
  return wallet
}

export function newTree(day: string): TreeData {
  return {
    today: day,
    firstDay: day,
    afterSchool: false,
    steps: [],
    apples: [],
    stones: { chinese: 0, math: 0, english: 0, life: 0 },
    remainder: { chinese: 0, math: 0, english: 0 },
    appleCount: 0,
    rules: defaultRules,
    ruleHistory: [{ day, rules: defaultRules }],
    upcoming: null,
    sun: 0,
    water: 0,
    tomatoWallet: { earned: 0, spent: 0 },
    streak: 0,
    lastDoneDay: null,
    goalAwardedOn: null,
    diary: [],
    exchanges: [],
    boxReady: false,
    lastBox: null,
    prize: null,
  }
}

const GOAL_WATER = 2

function remember(tree: TreeData, icon: string, text: string, at: string): void {
  const note = { id: crypto.randomUUID(), t: at, icon, text }
  tree.diary = [note, ...(tree.diary ?? [])].slice(0, 80)
}

function markDoneToday(tree: TreeData): void {
  if (tree.lastDoneDay === tree.today) return
  tree.streak = tree.lastDoneDay === shift(tree.today, -1) ? (tree.streak ?? 0) + 1 : 1
  tree.lastDoneDay = tree.today
}

function awardGoal(tree: TreeData, at: string): void {
  if (tree.goalAwardedOn === tree.today) return
  const must = tree.steps.filter((s) => s.planned === tree.today && !s.skipped && isMustDo(s.priority) &&
    !weeklyHomeworkStart(s) && !isExhaustedPendingStep(tree, s))
  if (!must.length || must.some((s) => !s.end)) return
  tree.water += GOAL_WATER
  tree.goalAwardedOn = tree.today
  remember(tree, '🎯', '今天要做的都完成啦，奖励水滴 +2', at)
}

export function awardCompletedDay(tree: TreeData, step: WorkStep, at: string): void {
  awardGoal(tree, at)
  if (awardDailyRainbow(tree, step)) {
    remember(tree, '🌈', '今天的学习任务全部完成！最后一颗苹果变成彩虹果，自选一种学科宝石。', at)
  }
}

function onCompleted(tree: TreeData, step: WorkStep, at: string): void {
  const makeup = !!step.planned && step.planned < tree.today
  remember(tree, makeup ? '🍂' : '🌸', `${step.flowers && !step.flowers.complete ? '本次收工' : makeup ? '补做完成' : '做完了'}「${step.name}」`, at)
  markDoneToday(tree)
  awardCompletedDay(tree, step, at)
}

/** 今天还没做完的，以及正在做的，全部飞成泡泡。过期还没开始的留在枯萎箱。 */
export function placeTodayBubbles(tree: TreeData): void {
  const cycleIds = cycleBubbleIds(tree)
  const previousCycleSlots = new Map<string, number>()
  for (const step of tree.steps) {
    const key = homeworkCycleKey(step)
    if (key && step.slot !== null) previousCycleSlots.set(key, step.slot)
  }
  const visible = tree.steps.filter((s) => {
    if (s.skipped || isExhaustedPendingStep(tree, s)) return false
    if (homeworkCycleKey(s)) return cycleIds.has(s.id)
    if (s.start && !s.end) return true
    if (s.end && !s.popped && dayOf(s.end) === tree.today) return true
    if (s.planned !== tree.today) return false
    return !s.end || !s.popped
  })
  const ids = new Set(visible.map((s) => s.id))
  for (const step of tree.steps) if (!ids.has(step.id)) step.slot = null
  const used = new Set<number>()
  for (const step of visible) {
    if (step.slot !== null && !used.has(step.slot)) used.add(step.slot)
    else step.slot = null
  }
  for (const step of visible) {
    const key = homeworkCycleKey(step)
    const prior = key && previousCycleSlots.get(key)
    if (step.slot === null && typeof prior === 'number' && !used.has(prior)) {
      step.slot = prior
      used.add(prior)
    }
  }
  let slot = 0
  const ordered = [...visible].sort(
    (a, b) => a.priority.localeCompare(b.priority) || a.deadline.localeCompare(b.deadline) || a.id.localeCompare(b.id),
  )
  for (const step of ordered) {
    if (step.slot !== null) continue
    while (used.has(slot)) slot += 1
    step.slot = slot
    used.add(slot)
    slot += 1
  }
}

function fill(tree: TreeData) {
  placeTodayBubbles(tree)
}

export function roll(tree: TreeData, today: string) {
  tree.tomatoWallet ??= tomatoWallet(tree)
  const expired = new Set<string>()
  const retain = (step: WorkStep) => {
    if (step.subject !== 'life' || step.end || step.scheduled === today) return true
    expired.add(step.occurrence)
    return false
  }
  tree.steps = tree.steps.filter(retain)
  tree.weekendExcludedSteps = tree.weekendExcludedSteps?.filter(retain)
  for (const step of tree.steps) {
    if (!step.start && !step.end && isClosedHomeworkCycle(step, today)) expired.add(step.occurrence)
  }
  for (const progress of Object.values(tree.practiceProgress ?? {})) {
    if (progress.activeOccurrence && expired.has(progress.activeOccurrence)) progress.activeOccurrence = null
  }
  if (tree.upcoming && tree.upcoming.day <= today) {
    tree.ruleHistory.push(tree.upcoming)
    tree.rules = tree.upcoming.rules
    tree.upcoming = null
  }
  if (today > tree.today) {
    tree.afterSchool = false
    for (const s of tree.steps) if ((!s.start || s.end) && !homeworkCycleKey(s)) s.slot = null
    tree.today = today
  }
  const due = tree.steps.filter((s) => s.end && !s.settled && dayOf(s.end) < today)
  harvestSteps(tree, due)
}

function awardTomatoes(tree: TreeData, step: WorkStep, early: boolean) {
  const wallet = tree.tomatoWallet ??= tomatoWallet(tree)
  const earned = homeworkTomatoReward(step.minutes, early)
  step.tomatoes = earned
  wallet.earned += earned
}

function finish(tree: TreeData, s: WorkStep, end: string, offline = false) {
  if (s.end) return
  requireState(s.start, '请先开始做。')
  s.end = end
  s.popped = s.slot === null
  const early = !offline && isEarly(s)
  Object.assign(s, completionReward(tree, s, dayOf(end), early))
  if (!s.audit.length && s.minutes > 0) awardTomatoes(tree, s, isTomatoDoubleEligible(s))
  tree.sun += s.sun
  tree.water += s.water
  onCompleted(tree, s, end)
}

function collectFlowers(tree: TreeData, step: WorkStep, action: TreeAction, end: string, now: string) {
  const progress = step.flowers!
  const { elapsedMs, slots, suggested } = flowerBudget(step, Date.parse(end))
  const requestedCompletion = action.kind === 'record' ? false : action.flowerSelection?.complete
  requireState(typeof requestedCompletion === 'boolean', '请选择保存进度或完成作业。')
  const questions = flowerQuestionProgress(step)
  const complete = questions ? questions.done === questions.total : requestedCompletion
  const position = Math.max(progress.collected, complete ? slots : suggested)
  const added = position - progress.collected
  Object.assign(progress, { complete, elapsedMs, collected: position })
  step.end = step.start ? end : dayOf(end)
  step.stages = Array.from({ length: added }, () => 0)
  step.popped = true
  if (!homeworkCycleKey(step)) step.slot = null
  step.sun = added
  step.water = added ? completionReward(tree, step, dayOf(end), false).water : 0
  if (complete && step.start && step.minutes > 0 && action.kind === 'collectFlowers') {
    awardTomatoes(tree, step, isTomatoDoubleEligible(step))
  }
  tree.sun += step.sun
  tree.water += step.water
  if (!complete) {
    const sequence = weeklyHomeworkStart(step) ? tree.steps.filter(item => item.occurrence === step.occurrence).length : 0
    tree.steps.push(nextFlowerSession(step, tree.today, sequence))
  }
  onCompleted(tree, step, now)
  fill(tree)
}

export function act(tree: TreeData, action: TreeAction, now: string) {
  const { kind, id } = action
  const day = tree.today
  if (kind === 'sync') return
  if (kind === 'addCrown') {
    requireState(action.day === day, '只能给今天添加皇冠泡泡。')
    const name = typeof action.name === 'string' ? action.name.trim() : ''
    requireState(name && name.length <= 120, '请输入 1 到 120 个字的小目标。')
    requireState(typeof id === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id), '无效的泡泡编号。')
    const occurrence = `crown/${day}/${id}`
    if (tree.steps.some(step => step.occurrence === occurrence)) return
    tree.steps.push({
      id: occurrence + '/0', occurrence, crown: true, name, notes: '', practice: null,
      subject: 'life', priority: 'P2', minutes: 0, scheduled: day, planned: day, deadline: day,
      start: null, end: null, settled: false, popped: false, slot: null,
      returned: null, sun: 0, water: 0, stages: [0], audit: [],
    })
    fill(tree)
    return
  }
  if (kind === 'saveNotes') {
    requireState(Array.isArray(action.notes), '无效的作业备注。')
    const steps = new Map(tree.steps.map((step) => [step.id, step]))
    const updates = action.notes.map((note) => {
      requireState(note && typeof note.value === 'string', '无效的作业备注。')
      const step = steps.get(note.id)
      requireState(step, '找不到这项作业，请重新打开备注。')
      const value = note.value.trim()
      const current = step.planNote ?? ''
      requireState(current === note.previous || current === value, '备注已在其他设备修改，请重新打开备注。')
      return { step, value }
    })
    for (const { step, value } of updates) {
      if (value) step.planNote = value
      else delete step.planNote
    }
    return
  }
  if (kind === 'school') {
    tree.afterSchool = true
    fill(tree)
    return
  }
  if (kind === 'settings') {
    const r = action.rules
    requireState(
      r &&
        [...CORE_SUBJECTS, 'wish' as const].every(
          (k) => Number.isInteger(r[k]) && r[k] >= 1 && r[k] <= 20,
        ),
      '阈值须为 1–20 的整数。',
    )
    const prices = r.tomatoPrices === undefined ? tomatoPrices(tree.upcoming?.rules ?? tree.rules) : r.tomatoPrices
    requireState(
      prices && prices.gems && [prices.box, ...CORE_SUBJECTS.map(color => prices.gems[color])]
        .every(price => Number.isSafeInteger(price) && price > 0),
      '番茄兑换价格须为大于 0 的整数。',
    )
    const wishLife = r.wishLife === undefined ? lifeWishThreshold(tree.upcoming?.rules ?? tree.rules) : r.wishLife
    requireState(Number.isSafeInteger(wishLife) && wishLife > 0, '绿松石兑换门槛须为正整数。')
    tree.upcoming = { day: shift(day, 1), rules: { ...r, wishLife, tomatoPrices: prices } }
    return
  }
  if (kind === 'exchange') {
    const last = tree.exchanges.at(-1)
    requireState(!last || day >= shift(last, 7), '距上次兑换还未满七天。')
    requireState(
      CORE_SUBJECTS.every((k) => tree.stones[k] >= tree.rules.wish),
      '三色宝石还没攒齐。',
    )
    const wishLife = lifeWishThreshold(tree.rules)
    requireState(tree.stones.life >= wishLife, `还差 ${wishLife - tree.stones.life} 颗绿松石。`)
    CORE_SUBJECTS.forEach((k) => {
      tree.stones[k] -= tree.rules.wish
    })
    tree.stones.life -= wishLife
    tree.exchanges.push(day)
    return
  }
  if (kind === 'exchangeTomatoes') {
    const color = action.color
    requireState(color && CORE_SUBJECTS.includes(color), '请选择一颗宝石。')
    const price = tomatoPrices(tree.rules).gems[color]
    const wallet = walletForTomatoPurchase(tree, action.tomatoPrice ?? defaultTomatoPrices.gems[color], price)
    wallet.spent += price
    tree.stones[color]++
    const spends = tree.tomatoSpends ??= []
    spends.unshift({ id: crypto.randomUUID(), t: now, kind: 'gem', color, amount: price })
    return
  }
  if (kind === 'openTomatoBox') {
    requireState(!tree.prize, '请先收下上一次抽中的奖励。')
    requireState(!tree.boxReady, '请先使用普通盲盒机会。')
    walletForTomatoPurchase(tree, action.tomatoPrice ?? defaultTomatoPrices.box, tomatoPrices(tree.rules).box)
    return
  }
  if (kind === 'openBox') {
    requireState(!tree.prize, '请先收下上一次抽中的奖励。')
    requireState(tree.boxReady, '还没有待开启的盲盒。')
    return
  }
  if (kind === 'acceptBox') {
    requireState(tree.prize && id === tree.prize.ticket, '请重新打开当前盲盒。')
    if (tree.prize.source !== 'tomato') {
      requireState(tree.boxReady, '还没有待开启的盲盒。')
      tree.boxReady = false
      tree.lastBox = day
    }
    tree.prize = null
    return
  }
  if (kind === 'pick') {
    const apple = tree.apples.find((a) => a.id === id)
    if (!apple) return
    const color = apple.kind === 'rainbow' ? action.color : apple.kind
    requireState(
      color && (apple.kind !== 'rainbow' || CORE_SUBJECTS.some((k) => k === color)),
      '请选择宝石颜色。',
    )
    tree.stones[color]++
    if (apple.kind === 'rainbow' && (!tree.lastBox || day >= shift(tree.lastBox, 7)))
      tree.boxReady = true
    tree.apples = tree.apples.filter((a) => a.id !== id)
    remember(tree, apple.kind === 'rainbow' ? '🌈' : '🍎', apple.kind === 'rainbow' ? '摘下了彩虹果' : '摘下了一颗果子', now)
    return
  }
  if (kind === 'magic') {
    const flowers = tree.steps.filter(canGrowWithSun)
    requireState(flowers.length, '暂无可催开的花')
    requireState(tree.sun >= SUN_MAGIC_COST, `还差 ${SUN_MAGIC_COST - tree.sun} 个阳光`)
    tree.sun -= SUN_MAGIC_COST
    flowers.forEach((s) => {
      s.stages = s.stages.map((stage) => Math.min(3, stage + 1))
    })
    return
  }
  const [stepId, flowerIndex] = (id ?? '').split('#')
  const s = tree.steps.find((step) => step.id === stepId)
  requireState(s, '找不到这项作业，请刷新。')
  if (s.skipped && kind === 'skip') return
  requireState(!s.skipped, '本次作业不用做。')
  requireState(!isExhaustedPendingStep(tree, s), '这项作业的练习内容已用完，请在作业设置中选择新的开始项。')
  if (homeworkCycleKey(s) && !s.end) {
    const canFinishRunning = s.start && ['stop', 'finish', 'collectFlowers', 'answerHomeworkQuestion'].includes(kind)
    requireState(!isClosedHomeworkCycle(s, day) || canFinishRunning, '这个周期已结束。')
    if (!s.start && ['start', 'preparePractice', 'pop', 'completeUntimed', 'collectFlowers'].includes(kind))
      requireState(!!s.planned && cycleAvailableFrom(s) <= day, `下次 ${cycleAvailableFrom(s).slice(5).replace('-', '/')} 可做。`)
    if (kind === 'record' && action.start && !Number.isNaN(Date.parse(action.start)))
      requireState(dayOf(action.start) >= s.scheduled, '补录时间须在本次作业的原排期或以后。')
  }
  if (s.flowers) {
    requireState(!['completeUntimed', 'finish'].includes(kind), '请在花朵旁完成本次作业。')
    if (!s.end && s.flowers.availableFrom && s.flowers.availableFrom > day)
      requireState(!['start', 'collectFlowers', 'record', 'answerHomeworkQuestion'].includes(kind), '今天已收工，明天继续。')
    if (kind === 'answerHomeworkQuestion') {
      requireState(!s.end && s.start, '请先开始本次作业。')
      const problem = action.problemId
      requireState(problem && flowerQuestionProgress(s)?.ids.has(problem), '题目不属于这份作业。')
      const answered = s.flowers.answered ??= []
      if (!answered.includes(problem)) answered.push(problem)
      return
    }
  }
  if (kind === 'collectFlowers') {
    requireState(s.flowers, '本作业未启用分次收花。')
    if (s.end) return
    collectFlowers(tree, s, action, now, now)
    return
  }
  if (s.subject === 'life' && !s.end) {
    requireState(s.scheduled === day, '生活泡泡只在当天有效。')
    requireState(!['start', 'finish', 'record', 'move', 'nextDay', 'return', 'preparePractice'].includes(kind), '生活泡泡点击即可完成，无需计时或改期。')
    if (kind === 'pop' || kind === 'completeUntimed') {
      s.start = null
      s.end = day
      s.stages = [0]
      s.popped = true
      s.slot = null
      Object.assign(s, completionReward(tree, s, day, false))
      tree.sun += s.sun
      tree.water += s.water
      onCompleted(tree, s, now)
      fill(tree)
      return
    }
  }
  const instant = isInstantHomework(s)
  if (instant && !s.end)
    requireState(kind !== 'start' && kind !== 'record', '0 分钟作业点击泡泡即可完成。')
  switch (kind) {
    case 'skip': {
      requireState(!s.start && !s.end, '只有未开始的作业可以标记为「不用做」。')
      const pending = tree.steps.filter((part) => part.occurrence === s.occurrence && !part.end)
      requireState(pending.every((part) => !part.start), '这项作业正在计时。')
      for (const part of pending) {
        part.skipped = true
        part.slot = null
      }
      fill(tree)
      awardGoal(tree, now)
      break
    }
    case 'pop':
    case 'completeUntimed':
      if (s.end) {
        if (kind === 'pop') {
          s.popped = true
          if (!homeworkCycleKey(s)) s.slot = null
          fill(tree)
        }
        return
      }
      if (kind === 'pop') requireState(instant, '请先记录完成时间。')
      if (instant) requireState(s.planned, '请先安排作业日期。')
      requireState(!s.start, '正在计时，请使用「完成了」。')
      s.end = day
      Object.assign(s, completionReward(tree, s, day, false))
      tree.sun += s.sun
      tree.water += s.water
      s.popped = instant || s.slot === null
      if (s.popped && !homeworkCycleKey(s)) s.slot = null
      onCompleted(tree, s, now)
      break
    case 'preparePractice':
      requireState(!s.end && !!s.planned, '请先安排作业日期。')
      break
    case 'start': {
      if (s.start || s.end) return
      requireState(s.planned, '请先安排作业日期。')
      requireState(!tree.steps.some((other) => other.start && !other.end), '请先处理正在做的作业。')
      s.start = now
      s.returned = null
      if (s.planned && s.planned < day) remember(tree, '🍂', `开始补做「${s.name}」`, now)
      fill(tree)
      break
    }
    case 'stop':
      if (!s.start || s.end) return
      requireState(s.start === action.start, '这项作业已重新开始，请查看最新计时后再停止。')
      s.start = null
      fill(tree)
      break
    case 'finish':
      finish(tree, s, now)
      if (action.popOnFinish === true) {
        s.popped = true
        if (!homeworkCycleKey(s)) s.slot = null
        fill(tree)
      }
      break
    case 'completeOffline':
    case 'record': {
      if (s.end) throw new TreeConflict('这项作业已结算。')
      const start = Date.parse(action.start ?? '')
      const end = Date.parse(action.end ?? '')
      requireState(
        Number.isFinite(start) &&
          end >= start &&
          end <= Date.parse(now) &&
          dayOf(new Date(start)) >= tree.firstDay,
        '请填写有效的实际起止时间。',
      )
      requireState(
        !tree.steps.some(
          (other) =>
            other !== s &&
            other.start &&
            Date.parse(other.start) < end &&
            (!other.end || Date.parse(other.end) > start),
        ),
        '这段时间已记录其他作业。',
      )
      if (s.flowers?.availableFrom) requireState(dayOf(new Date(start)) >= s.flowers.availableFrom,
        '补录时间须在这段作业可开始的日期或以后。')
      s.audit.push({ at: now, previousStart: s.start, previousEnd: s.end })
      s.start = new Date(start).toISOString()
      if (s.flowers) collectFlowers(tree, s, action, new Date(end).toISOString(), now)
      else finish(tree, s, new Date(end).toISOString(), kind === 'completeOffline')
      if (kind === 'completeOffline') {
        s.popped = true
        s.slot = null
        fill(tree)
      }
      roll(tree, day)
      break
    }
    case 'return':
    case 'move':
    case 'nextDay': {
      requireState(!s.start && !s.end, '已开始或完成的作业不能改期。')
      if (kind === 'nextDay') {
        const base = s.planned && s.planned > day ? s.planned : day
        s.planned = shift(base, 1)
      } else if (kind === 'move') {
        const target = action.day
        requireState(target && /^\d{4}-\d{2}-\d{2}$/.test(target) && target >= day, '请选择今天或以后的日期。')
        s.planned = target
      }
      if (homeworkCycleKey(s) && s.planned)
        requireState(s.planned >= s.scheduled && s.planned <= s.deadline, '请选择原排期到周期截止日之间的日期。')
      s.returned = kind === 'return' ? day : null
      s.slot = null
      fill(tree)
      awardGoal(tree, now)
      break
    }
    case 'water': {
      const i = Number(flowerIndex)
      requireState(
        s.end && s.popped && !s.settled && s.stages[i] < 3 && tree.water > 0,
        '这朵花暂时无法浇水。',
      )
      s.stages[i]++
      tree.water--
      break
    }
    default:
      throw new TreeConflict('未知操作。')
  }
}
