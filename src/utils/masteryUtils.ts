import type { WordMasteryInfo } from './type'

// --- Ebbinghaus spaced repetition intervals ---

export const NORMAL_INTERVALS = [1, 3, 7, 14, 30, 60, 90] // stage 0-6; stage 7 = graduated
export const HARD_INTERVALS = [1, 2, 4, 7, 14, 30, 60, 90] // stage 0-7; stage 8 = graduated

export const GRADUATED_STAGE_NORMAL = 7
export const GRADUATED_STAGE_HARD = 8

// Weekly plan pass criterion: consolidate words are "stable" when stage >= this value
export const CONSOLIDATE_PASS_STAGE = 2

// Deterministic per-word jitter so words advancing on the same day don't all expire together.
// Returns 0, 1, or 2 days based on a hash of the key.
export function hashOffset(key: string, mod = 3): number {
  let h = 0
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) - h + key.charCodeAt(i)) | 0
  }
  return Math.abs(h) % mod
}

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

export function advanceStage(
  info: WordMasteryInfo,
  today: string,
  wordKey?: string,
): WordMasteryInfo {
  const initialized = ensureStageInit(info, today)
  const intervals = initialized.isHard ? HARD_INTERVALS : NORMAL_INTERVALS
  const maxStage = initialized.isHard ? GRADUATED_STAGE_HARD : GRADUATED_STAGE_NORMAL
  const newStage = Math.min((initialized.stage ?? 0) + 1, maxStage)
  const offset = wordKey ? hashOffset(wordKey, 3) : 0
  return {
    ...initialized,
    stage: newStage,
    nextReviewDate: newStage >= maxStage ? undefined : addDays(today, (intervals[newStage] ?? 90) + offset),
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

// English-specific mastery level — thresholds are higher because each practice
// session records ~9 individual correct answers per word.
export function getWordMasteryLevel(count: number): MasteryLevel {
  if (count <= 0) return 0
  if (count < 4) return 1
  if (count < 9) return 2
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
  0: '',
  1: '🥚',
  2: '🐛',
  3: '🦋',
}
