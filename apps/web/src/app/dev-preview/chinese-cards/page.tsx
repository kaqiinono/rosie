'use client'

import { useState } from 'react'
import { CharFlashCard } from '@rosie/chinese'

const MOCK_CARDS: Parameters<typeof CharFlashCard>[0]['data'][] = [
  {
    char: '霜',
    pinyin: 'shuāng',
    unit: 1,
    unitLessonNo: 1,
    bookLessonNo: 1,
    lessonTitle: '春夏秋冬',
    radical: '雨',
    radicalName: '雨',
    structure: '上下',
    strokeCount: 17,
    phrases: [],
  },
  {
    char: '霜',
    pinyin: 'shuāng',
    unit: 1,
    unitLessonNo: 1,
    bookLessonNo: 1,
    lessonTitle: '春夏秋冬',
    radical: '雨',
    radicalName: '雨',
    structure: '上下',
    strokeCount: 17,
    phrases: ['霜降', '风霜', '霜冻'],
  },
]

export default function ChineseCardsPreview() {
  const [flippedSet, setFlippedSet] = useState<Set<number>>(new Set([0, 1]))

  const flip = (i: number) =>
    setFlippedSet((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/80 to-orange-50/40 p-8 font-nunito">
      <h2 className="mb-3 text-sm font-extrabold text-amber-900/60">
        背面：无词语（左） / 有词语（右）
      </h2>
      <div className="grid grid-cols-2 gap-4" style={{ maxWidth: 500 }}>
        {MOCK_CARDS.map((c, i) => (
          <CharFlashCard key={i} data={c} flipped={flippedSet.has(i)} onFlip={() => flip(i)} index={i} />
        ))}
      </div>
    </div>
  )
}
