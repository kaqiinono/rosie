import { dayOf, type Rules, type TomatoPrices, type TreeData, type WorkStep } from './types'

export function blindBoxChances(tree: TreeData) {
  const wallet = tomatoWallet(tree)
  const price = tomatoPrices(tree.rules).box
  const ordinary = tree.boxReady && (!tree.prize || tree.prize.source === 'tomato') ? 1 : 0
  const paid = Math.max(0, Math.floor((wallet.earned - wallet.spent) / price))
  return { ordinary, paid, total: ordinary + paid, price }
}

const TOMATO_ROUND_MS = 5 * 60_000
export const defaultTomatoPrices: TomatoPrices = { gems: { chinese: 10, math: 10, english: 10 }, box: 100 }

export function tomatoPrices(rules: Rules) {
  return rules.tomatoPrices ?? defaultTomatoPrices
}

export function tomatoWallet(tree: TreeData) {
  return tree.tomatoWallet ?? {
    earned: tree.steps.reduce((total, step) => total + (step.end ? step.tomatoes ?? 0 : 0), 0),
    spent: 0,
  }
}

function homeworkTomatoRoundCount(minutes: number) {
  return Math.ceil(minutes * 60_000 / TOMATO_ROUND_MS)
}

export function homeworkTomatoReward(minutes: number, early: boolean) {
  return homeworkTomatoRoundCount(minutes) * (early ? 2 : 1)
}

export function homeworkTomatoProgress(step: WorkStep, now: number) {
  const budgetMs = step.minutes * 60_000
  const sessionMs = step.start ? Math.max(0, now - Date.parse(step.start)) : 0
  const previousElapsedMs = step.flowers?.elapsedMs ?? 0
  const totalElapsedMs = previousElapsedMs + sessionMs
  const elapsedMs = Math.min(budgetMs, totalElapsedMs)
  const rounds = homeworkTomatoRoundCount(step.minutes)
  const completed = elapsedMs === budgetMs ? rounds : Math.floor(elapsedMs / TOMATO_ROUND_MS)
  const round = Math.min(completed + 1, rounds)
  const roundStart = (round - 1) * TOMATO_ROUND_MS
  const roundEnd = Math.min(budgetMs, round * TOMATO_ROUND_MS)
  const ripenedAtMs = Math.min(budgetMs, completed * TOMATO_ROUND_MS)

  return {
    started: !!step.start,
    rounds,
    completed,
    round,
    justRipened: ripenedAtMs > previousElapsedMs && totalElapsedMs - ripenedAtMs < 2000,
    seconds: Math.ceil((roundEnd - elapsedMs) / 1000),
    percent: 100 * (elapsedMs - roundStart) / (roundEnd - roundStart),
  }
}

export function isEarly(step: WorkStep): boolean {
  return !step.flowers && !!step.start && !!step.end &&
    Date.parse(step.end) - Date.parse(step.start) < step.minutes * 60000
}

export function isTomatoDoubleEligible(step: WorkStep): boolean {
  const budgetMs = step.minutes * 60_000
  if (!budgetMs) return false
  const elapsedMs = step.flowers
    ? step.flowers.elapsedMs
    : step.start && step.end
      ? Date.parse(step.end) - Date.parse(step.start)
      : 0
  return elapsedMs >= budgetMs / 2 && elapsedMs < budgetMs
}

export function completionReward(tree: TreeData, step: WorkStep, day: string, early: boolean) {
  const count = tree.steps.filter((p) => p.id !== step.id && p.end && dayOf(p.end) === day).length + 1
  const baseSun = Math.max(1, step.stages.length)
  const baseWater = count === 3 ? 2 : 1
  const multiplier = early ? 2 : 1
  return { sun: baseSun * multiplier, water: baseWater * multiplier }
}
