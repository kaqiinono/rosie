'use client'

import type { CharCardItem } from '../../utils/chinese-chars-session-helpers'
import type { ChineseCharProfile } from '../../types/chineseCharData'
import CharFlashCard, { type CharFlashCardData } from './CharFlashCard'

interface ChineseCharsCardsGridProps {
  cards: CharCardItem[]
  charByKey: Map<string, ChineseCharProfile>
  flippedSet: Set<number>
  onFlip: (index: number) => void
}

function toFlashData(
  card: CharCardItem,
  profile: ChineseCharProfile | undefined,
): CharFlashCardData {
  return {
    char: card.char,
    pinyin: card.pinyin || profile?.pinyin || '',
    unit: card.unit,
    unitLessonNo: card.unitLessonNo,
    bookLessonNo: card.bookLessonNo,
    lessonTitle: card.lessonTitle,
    radical: profile?.radical,
    radicalName: profile?.radicalName,
    structure: profile?.structure,
    phrases: profile?.phrases,
    strokeCount: profile?.strokeCount,
  }
}

export default function ChineseCharsCardsGrid({
  cards,
  charByKey,
  flippedSet,
  onFlip,
}: ChineseCharsCardsGridProps) {
  if (cards.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-amber-900/45">当前筛选下暂无生字卡片</p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {cards.map((card, index) => (
        <CharFlashCard
          key={`${card.lessonKey}::${card.charKey}`}
          data={toFlashData(card, charByKey.get(card.charKey))}
          flipped={flippedSet.has(index)}
          onFlip={() => onFlip(index)}
          index={index}
        />
      ))}
    </div>
  )
}
