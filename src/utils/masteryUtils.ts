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
