'use client'

import type { WordEntry, WordMasteryMap } from '@/utils/type'
import { wordKey } from '@/utils/english-helpers'
import FlashCard from './FlashCard'

interface CardsGridProps {
  words: WordEntry[]
  flippedSet: Set<number>
  onFlip: (index: number) => void
  masteryMap?: WordMasteryMap
}

export default function CardsGrid({ words, flippedSet, onFlip, masteryMap }: CardsGridProps) {
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

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 max-sm:grid-cols-1">
      {words.map((v, i) => (
        <FlashCard
          key={`${v.word}-${i}`}
          entry={v}
          flipped={flippedSet.has(i)}
          onFlip={() => onFlip(i)}
          index={i}
          masteryInfo={masteryMap?.[wordKey(v)]}
        />
      ))}
    </div>
  )
}
