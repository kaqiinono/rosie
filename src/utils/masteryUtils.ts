import type { WordMasteryInfo } from './type'

// --- Ebbinghaus spaced repetition intervals ---

export const NORMAL_INTERVALS = [1, 3, 7, 14, 30, 60, 90] // stage 0-6; stage 7 = graduated
export const HARD_INTERVALS = [1, 2, 4, 7, 14, 30, 60, 90] // stage 0-7; stage 8 = graduated

export const GRADUATED_STAGE_NORMAL = 7
export const GRADUATED_STAGE_HARD = 8

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function ensureStageInit(info: WordMasteryInfo, today: string): WordMasteryInfo {
  if (info.stage !== undefined) return info
  const correct = info.correct ?? 0
  const incorrect = info.incorrect ?? 0
  const stage = correct >= 5 ? 3 : correct >= 3 ? 2 : correct >= 1 ? 1 : 0
  const isHard = incorrect >= 2 || incorrect > correct
  const intervals = isHard ? HARD_INTERVALS : NORMAL_INTERVALS
  const baseDate = info.lastSeen || today
  return {
    ...info,
    stage,
    isHard,
    nextReviewDate: addDays(baseDate, intervals[stage] ?? 1),
  }
}

export function advanceStage(info: WordMasteryInfo, today: string): WordMasteryInfo {
  const initialized = ensureStageInit(info, today)
  const intervals = initialized.isHard ? HARD_INTERVALS : NORMAL_INTERVALS
  const maxStage = initialized.isHard ? GRADUATED_STAGE_HARD : GRADUATED_STAGE_NORMAL
  const newStage = Math.min((initialized.stage ?? 0) + 1, maxStage)
  return {
    ...initialized,
    stage: newStage,
    nextReviewDate: newStage >= maxStage ? undefined : addDays(today, intervals[newStage] ?? 90),
  }
}

export function regressStage(info: WordMasteryInfo, today: string): WordMasteryInfo {
  const initialized = ensureStageInit(info, today)
  const stage = initialized.stage ?? 0
  let newStage: number
  if (stage <= 1) newStage = 0
  else if (stage <= 4) newStage = 1
  else newStage = 3
  return {
    ...initialized,
    stage: newStage,
    isHard: true,
    nextReviewDate: addDays(today, newStage <= 1 ? 1 : HARD_INTERVALS[newStage]),
  }
}

export function isGraduated(info: WordMasteryInfo): boolean {
  if (info.stage === undefined) return false
  const maxStage = info.isHard ? GRADUATED_STAGE_HARD : GRADUATED_STAGE_NORMAL
  return info.stage >= maxStage
}

// --- Existing mastery UI utilities ---

export const MASTERY_THRESHOLD = 3

export type MasteryLevel = 0 | 1 | 2 | 3

export function getMasteryLevel(count: number): MasteryLevel {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  return 3
}

export const MASTERY_BORDER: Record<MasteryLevel, string> = {
  0: 'border-transparent',
  1: 'border-amber-300',
  2: 'border-blue-300',
  3: 'border-app-green',
}

export const MASTERY_BADGE_BG: Record<MasteryLevel, string> = {
  0: 'bg-app-blue-light text-app-blue-dark',
  1: 'bg-amber-100 text-amber-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-app-green-light text-app-green-dark',
}

export const MASTERY_ICON: Record<MasteryLevel, string> = {
  0: '›',
  1: '🥚',
  2: '🐛',
  3: '🦋',
}

// 30-level icon system — based on cumulative correct-answer count
export function getMasteryIconLevel(count: number): number {
  if (count <= 0) return 0
  return Math.min(count, 30)
}

export function getCreatureCounts(level: number): {
  eggs: number
  caterpillars: number
  butterflies: number
} {
  if (level <= 0)  return { eggs: 0,             caterpillars: 0,            butterflies: 0        }
  if (level <= 10) return { eggs: level,          caterpillars: 0,            butterflies: 0        }
  if (level <= 20) return { eggs: 10-(level-10),  caterpillars: level-10,     butterflies: 0        }
  return                   { eggs: 0,             caterpillars: 10-(level-20), butterflies: level-20 }
}
