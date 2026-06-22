'use client'

import type { WordEntry, WordMasteryMap } from '@rosie/core'
import { wordKey } from '../../utils/english-helpers'
import FlashCard from './FlashCard'

interface CardsGridProps {
  words: WordEntry[]
  flippedSet: Set<number>
  onFlip: (index: number) => void
  masteryMap?: WordMasteryMap
  dualMode?: boolean
}

export default function CardsGrid({ words, flippedSet, onFlip, masteryMap, dualMode }: CardsGridProps) {
  if (!words.length) {
    return (
      <div className="col-span-full py-12 text-center text-[var(--wm-text-dim)]">
        <div className="mb-2.5 text-[2.5rem]">🔍</div>
        <div>
          没有找到匹配的单词
          <br />
          <small className="text-[1.125rem] opacity-60">请选择 Unit 或 Lesson</small>
        </div>
      </div>
    )
  }

  // Dual-mode cards show front + back side-by-side, so each tile needs roughly
  // double the width to stay legible. Bump the minmax floor accordingly.
  const gridCols = dualMode
    ? 'grid-cols-[repeat(auto-fill,minmax(560px,1fr))] max-md:grid-cols-1'
    : 'grid-cols-[repeat(auto-fill,minmax(280px,1fr))] max-sm:grid-cols-1'

  return (
    <div className={`grid gap-4 ${gridCols}`}>
      {words.map((v, i) => (
        <FlashCard
          key={`${v.word}-${i}`}
          entry={v}
          flipped={flippedSet.has(i)}
          onFlip={() => onFlip(i)}
          index={i}
          masteryInfo={masteryMap?.[wordKey(v)]}
          dualMode={dualMode}
        />
      ))}
    </div>
  )
}
