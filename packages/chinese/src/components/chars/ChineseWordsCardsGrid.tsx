'use client'

import type { WordCardItem } from '../../utils/chinese-pinyin-write-helpers'
import WordFlashCard from './WordFlashCard'

interface ChineseWordsCardsGridProps {
  words: WordCardItem[]
  flippedSet: Set<number>
  onFlip: (index: number) => void
}

export default function ChineseWordsCardsGrid({
  words,
  flippedSet,
  onFlip,
}: ChineseWordsCardsGridProps) {
  if (words.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-amber-900/45">当前筛选下暂无词语卡片</p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {words.map((word, index) => (
        <WordFlashCard
          key={`${word.lessonKey}::${word.word}`}
          data={word}
          flipped={flippedSet.has(index)}
          onFlip={() => onFlip(index)}
          index={index}
        />
      ))}
    </div>
  )
}
