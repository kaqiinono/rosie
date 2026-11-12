import Image from 'next/image'
import { Headphones } from 'lucide-react'

const assets = {
  calculator: 'calculator-1-flat',
  wordCards: 'card-game-diamond-flat',
  plan: 'calendar-check-flat',
  learn: 'pencil-square-flat',
  focus: 'book-1-flat',
  readAloud: 'volume-level-high-flat',
  print: 'printer-flat',
} as const

export type LearningIconName = keyof typeof assets | 'listen' | 'pause'

/** Decorative icon for a labeled action. The enclosing control owns the accessible name. */
export function LearningIcon({ name, size = 20 }: { name: LearningIconName; size?: number }) {
  if (name === 'listen') return <Headphones aria-hidden size={size} />

  if (name === 'pause') {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <rect x="5" y="3" width="5" height="18" rx="2" />
        <rect x="14" y="3" width="5" height="18" rx="2" />
      </svg>
    )
  }

  return (
    <Image
      src={`/icons/plump/${assets[name]}.svg`}
      alt=""
      width={size}
      height={size}
      unoptimized
    />
  )
}
