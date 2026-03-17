'use client'

import type { WordEntry } from '@/utils/type'
import { Search } from 'lucide-react'
import FlashCard from './FlashCard'

interface CardsGridProps {
  words: WordEntry[]
  flippedSet: Set<number>
  onFlip: (index: number) => void
}

export default function CardsGrid({ words, flippedSet, onFlip }: CardsGridProps) {
  if (!words.length) {
    return (
      <div className="text-center py-12 text-[var(--wm-text-dim)] col-span-full">
        <Search className="h-10 w-10 mx-auto mb-2.5 opacity-40" />
        <div>
          没有找到匹配的单词
          <br />
          <small className="text-[.8rem] opacity-60">请选择 Unit 或 Lesson</small>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] max-sm:grid-cols-1 gap-4">
      {words.map((v, i) => (
        <FlashCard
          key={`${v.word}-${i}`}
          entry={v}
          flipped={flippedSet.has(i)}
          onFlip={() => onFlip(i)}
          index={i}
        />
      ))}
    </div>
  )
}
