import type { AdaptivePlanWordProgress } from './adaptivePlanTypes'

/** Kid-friendly growth stages for the 5 Leitner boxes. */
export const ADAPTIVE_BOX_STAGES = [
  { box: 1, emoji: '🥚', name: '蛋', shortLabel: '🥚 蛋', hint: '刚认识' },
  { box: 2, emoji: '🐛', name: '虫', shortLabel: '🐛 虫', hint: '开始熟悉' },
  { box: 3, emoji: '🦋', name: '蝴蝶', shortLabel: '🦋 蝴蝶', hint: '巩固中' },
  { box: 4, emoji: '🌸', name: '花', shortLabel: '🌸 花', hint: '较熟练' },
  { box: 5, emoji: '🌳', name: '树', shortLabel: '🌳 树', hint: '精通考核' },
] as const

export type AdaptiveBoxStage = (typeof ADAPTIVE_BOX_STAGES)[number]

export const ADAPTIVE_MASTERED_STAGE = {
  emoji: '✨',
  name: '已掌握',
  shortLabel: '✨ 已掌握',
  hint: '毕业',
} as const

export function clampAdaptiveBox(box: number | null | undefined): 1 | 2 | 3 | 4 | 5 {
  if (box == null || box < 1) return 1
  if (box > 5) return 5
  return box as 1 | 2 | 3 | 4 | 5
}

export function adaptiveBoxStage(box: number | null | undefined): AdaptiveBoxStage {
  const clamped = clampAdaptiveBox(box)
  return ADAPTIVE_BOX_STAGES[clamped - 1]!
}

/** Human label for a progress row (queue / learning / mastered). */
export function adaptiveStageLabel(row: AdaptivePlanWordProgress | undefined): string {
  if (!row) return '未知'
  if (row.status === 'MASTERED') return ADAPTIVE_MASTERED_STAGE.shortLabel
  if (row.status === 'LEARNING_PENDING') return '🐣 激活'
  if (row.status === 'NOT_STARTED') return '🥚 待启程'
  const stage = adaptiveBoxStage(row.boxIndex)
  return `${stage.shortLabel} · ${stage.hint}`
}

export function adaptiveStageSortKey(row: AdaptivePlanWordProgress): number {
  if (row.status === 'MASTERED') return 60
  if (row.status === 'LEARNING') return clampAdaptiveBox(row.boxIndex)
  if (row.status === 'LEARNING_PENDING') return 70
  return 80
}
