'use client'

import { useState, useCallback } from 'react'
import { useWordsContext } from '@/contexts/WordsContext'

import FilterBar from '@/components/english/words/FilterBar'
import PhonicsLegend from '@/components/english/words/PhonicsLegend'
import CardsGrid from '@/components/english/words/CardsGrid'

export default function CardsPage() {
  const {
    vocab, filteredWords, masteryMap,
    selStage, setSelStage,
    selUnits, setSelUnits,
    selLessons, setSelLessons,
    selWords, setSelWords,
    masteryFilter, setMasteryFilter,
  } = useWordsContext()

  const [flippedSet, setFlippedSet] = useState<Set<number>>(new Set())
  const [allFlipped, setAllFlipped] = useState(false)

  const resetCards = useCallback(() => {
    setFlippedSet(new Set())
    setAllFlipped(false)
  }, [])

  const toggleUnit = useCallback((unit: string) => {
    setSelUnits(prev => {
      const next = new Set(prev)
      if (next.has(unit)) {
        next.delete(unit)
        setSelLessons(old => new Set([...old].filter(k => !k.startsWith(`${unit}::`))))
      } else {
        next.add(unit)
      }
      setSelWords(new Set())
      return next
    })
    resetCards()
  }, [setSelUnits, setSelLessons, setSelWords, resetCards])

  const toggleLesson = useCallback((lesson: string) => {
    setSelLessons(prev => {
      const next = new Set(prev)
      if (next.has(lesson)) { next.delete(lesson) } else { next.add(lesson) }
      setSelWords(new Set())
      return next
    })
    resetCards()
  }, [setSelLessons, setSelWords, resetCards])

  const toggleWord = useCallback((word: string) => {
    setSelWords(prev => {
      const next = new Set(prev)
      if (next.has(word)) { next.delete(word) } else { next.add(word) }
      return next
    })
    resetCards()
  }, [setSelWords, resetCards])

  const clearWords = useCallback(() => {
    setSelWords(new Set())
    resetCards()
  }, [setSelWords, resetCards])

  const flipCard = useCallback((index: number) => {
    setFlippedSet(prev => {
      const next = new Set(prev)
      if (next.has(index)) { next.delete(index) } else { next.add(index) }
      return next
    })
  }, [])

  const flipAll = useCallback(() => {
    const newFlipped = !allFlipped
    setAllFlipped(newFlipped)
    setFlippedSet(newFlipped ? new Set(filteredWords.map((_, i) => i)) : new Set())
  }, [allFlipped, filteredWords])

  return (
    <>
      <FilterBar
        vocab={vocab}
        selStage={selStage}
        onSetStage={setSelStage}
        selUnits={selUnits}
        selLessons={selLessons}
        selWords={selWords}
        filteredCount={filteredWords.length}
        allFlipped={allFlipped}
        onToggleUnit={toggleUnit}
        onToggleLesson={toggleLesson}
        onToggleWord={toggleWord}
        onClearWords={clearWords}
        onFlipAll={flipAll}
        masteryFilter={masteryFilter}
        onMasteryFilter={setMasteryFilter}
        masteryMap={masteryMap}
      />
      <div className="max-w-[1280px] mx-auto px-4 py-5 relative z-[1]">
        <PhonicsLegend />
        <CardsGrid
          words={filteredWords}
          flippedSet={flippedSet}
          onFlip={flipCard}
          masteryMap={masteryMap}
        />
      </div>
    </>
  )
}
