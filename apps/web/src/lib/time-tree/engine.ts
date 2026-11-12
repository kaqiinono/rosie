import { CORE_SUBJECTS, capacityOf } from '@/components/tree-demo/garden/model'
import {
  dayOf,
  defaultRules,
  elapsed,
  shift,
  type TreeAction,
  type TreeData,
  type WorkStep,
} from './types'

export class TreeConflict extends Error {}
function requireState(ok: unknown, message: string): asserts ok {
  if (!ok) throw new TreeConflict(message)
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
    magicDay: null,
    exchanges: [],
    boxReady: false,
    lastBox: null,
    prize: null,
  }
}

function fill(tree: TreeData) {
  if (!tree.afterSchool) return
  const slots = new Set(tree.steps.map((s) => s.slot))
  const candidates = tree.steps.filter(
    (s) =>
      s.slot === null &&
      !s.popped &&
      !s.skipped &&
      s.planned &&
      s.planned <= tree.today &&
      s.returned !== tree.today,
  )
  candidates.sort(
    (a, b) =>
      Number(!a.start) - Number(!b.start) ||
      Number(a.planned !== tree.today) - Number(b.planned !== tree.today) ||
      a.priority.localeCompare(b.priority) ||
      a.deadline.localeCompare(b.deadline) ||
      a.id.localeCompare(b.id),
  )
  for (let i = 0; i < 4; i++) {
    if (slots.has(i)) continue
    const next = candidates.shift()
    if (!next) break
    next.slot = i
  }
}

export function roll(tree: TreeData, today: string) {
  if (tree.upcoming && tree.upcoming.day <= today) {
    tree.ruleHistory.push(tree.upcoming)
    tree.rules = tree.upcoming.rules
    tree.upcoming = null
  }
  if (today > tree.today) {
    tree.afterSchool = false
    for (const s of tree.steps) if (!s.start || s.end) s.slot = null
    tree.today = today
  }
  const due = tree.steps.filter((s) => s.end && !s.settled && dayOf(s.end) < today)
  due.sort(
    (a, b) =>
      dayOf(a.end!).localeCompare(dayOf(b.end!)) ||
      CORE_SUBJECTS.findIndex((k) => k === a.subject) -
        CORE_SUBJECTS.findIndex((k) => k === b.subject) ||
      a.id.localeCompare(b.id),
  )
  for (const s of due) {
    const dateKey = dayOf(s.end!)
    s.settled = s.popped = true
    s.slot = null
    if (s.subject === 'life') {
      if (s.stages.length) tree.apples.push({ id: crypto.randomUUID(), kind: 'life', dateKey })
      continue
    }
    const rules =
      [...tree.ruleHistory].reverse().find((r) => r.day <= dateKey)?.rules ?? defaultRules
    tree.remainder[s.subject] += s.stages.length
    while (tree.remainder[s.subject] >= rules[s.subject]) {
      tree.remainder[s.subject] -= rules[s.subject]
      tree.appleCount++
      tree.apples.push({
        id: crypto.randomUUID(),
        kind: tree.appleCount % 12 === 0 ? 'rainbow' : s.subject,
        from: s.subject,
        dateKey,
      })
    }
  }
}

function finish(tree: TreeData, s: WorkStep, end: string) {
  if (s.end) return
  requireState(s.start, '请先开始做。')
  s.end = end
  s.popped = s.slot === null
  if (elapsed(s.start, end) > s.minutes) return
  const day = dayOf(end)
  const others = tree.steps.filter(
    (p) =>
      p !== s && p.end && p.start && dayOf(p.end) === day && elapsed(p.start, p.end) <= p.minutes,
  )
  const totalSun = others.reduce((sum, p) => sum + p.sun, 0)
  s.sun = Math.max(0, Math.min(s.stages.length, 10 - totalSun, 20 - tree.sun))
  const n = others.length + 1
  s.water = Math.min(n > 5 ? 0 : n === 3 ? 2 : 1, 12 - tree.water)
  tree.sun += s.sun
  tree.water += s.water
}

export function act(tree: TreeData, action: TreeAction, now: string) {
  const { kind, id } = action
  const day = tree.today
  if (kind === 'sync') return
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
    tree.upcoming = { day: shift(day, 1), rules: r }
    return
  }
  if (kind === 'exchange') {
    const last = tree.exchanges.at(-1)
    requireState(!last || day >= shift(last, 7), '距上次兑换还未满七天。')
    requireState(
      CORE_SUBJECTS.every((k) => tree.stones[k] >= tree.rules.wish),
      '三色宝石还没攒齐。',
    )
    CORE_SUBJECTS.forEach((k) => {
      tree.stones[k] -= tree.rules.wish
    })
    tree.exchanges.push(day)
    return
  }
  if (kind === 'openBox' || kind === 'acceptBox') {
    requireState(tree.boxReady, '还没有待开启的盲盒。')
    if (kind === 'acceptBox') {
      requireState(tree.prize && id === tree.prize.ticket, '请重新打开当前盲盒。')
      tree.boxReady = false
      tree.lastBox = day
      tree.prize = null
    }
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
    return
  }
  if (kind === 'magic') {
    const flowers = tree.steps.filter(
      (s) => s.end && s.popped && !s.settled && s.stages.some((stage) => stage < 3),
    )
    requireState(
      tree.magicDay !== day && tree.sun >= 8 && flowers.length,
      '今天暂时无法施展阳光魔法。',
    )
    tree.magicDay = day
    tree.sun -= 8
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
      break
    }
    case 'completeUntimed':
      if (s.end) return
      requireState(!s.start, '正在计时，请使用「完成了」。')
      requireState((s.planned ?? s.scheduled) <= day, '请在作业当天完成。')
      s.end = day
      s.popped = s.slot === null
      break
    case 'start': {
      if (s.start || s.end) return
      requireState(s.planned && s.planned <= day, '请先把作业安排到今天。')
      requireState(!tree.steps.some((other) => other.start && !other.end), '请先处理正在做的作业。')
      s.start = now
      s.returned = null
      if (tree.afterSchool && s.slot === null) {
        // An off-tree start must be visible even when all four slots await popping.
        const replace =
          tree.steps.find((other) => other.slot !== null && !other.start) ??
          tree.steps.find((other) => other.slot !== null && other.end)
        if (replace && tree.steps.filter((other) => other.slot !== null).length >= 4) {
          s.slot = replace.slot
          replace.slot = null
        }
        fill(tree)
      }
      break
    }
    case 'finish':
      finish(tree, s, now)
      break
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
      s.audit.push({ at: now, previousStart: s.start, previousEnd: s.end })
      s.start = new Date(start).toISOString()
      finish(tree, s, new Date(end).toISOString())
      roll(tree, day)
      break
    }
    case 'pop':
      requireState(s.end, '请先记录完成时间。')
      s.popped = true
      s.slot = null
      fill(tree)
      break
    case 'return':
    case 'move': {
      requireState(!s.start && !s.end, '已开始或完成的作业不能改期。')
      if (kind === 'move') {
        const target = action.day
        requireState(
          target === null ||
            (target &&
              target >= day &&
              target <= shift(day, 6) &&
              /^\d{4}-\d{2}-\d{2}$/.test(target)),
          '请选择七天内的日期。',
        )
        if (target) {
          const load = tree.steps
            .filter((p) => p !== s && !p.skipped && p.planned === target)
            .reduce((n, p) => n + p.stages.length, 0)
          requireState(load + s.stages.length <= capacityOf(target), '这天的叶区已经排满了。')
        }
        s.planned = target
      }
      s.returned = kind === 'return' ? day : null
      s.slot = null
      fill(tree)
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
