'use client'

import { useMemo, useCallback } from 'react'
import { useWordsContext } from '@/contexts/WordsContext'
import { useImmersive } from '@/contexts/ImmersiveContext'
import FilterBar from '@/components/english/words/FilterBar'
import PracticeSetup from '@/components/english/words/PracticeSetup'

export default function PracticePage() {
  const {
    vocab, filteredWords,
    selUnits, setSelUnits,
    selLessons, setSelLessons,
    selWords, setSelWords,
    masteryFilter, setMasteryFilter,
    masteryMap,
    setPracticeTypes,
    setPreviewCards,
  } = useWordsContext()
  const { setIsImmersive } = useImmersive()

  const scopeLabel = useMemo(() => {
    const units = selUnits.size ? [...selUnits].join(', ') : '全部Unit'
    const lessons = selLessons.size
      ? [...new Set([...selLessons].map(k => k.split('::')[1]))].join(', ')
      : '全部Lesson'
    return `${units} / ${lessons}（${filteredWords.length}词）`
  }, [selUnits, selLessons, filteredWords.length])

  const startPractice = useCallback((types: ('A' | 'B' | 'C')[], preview: boolean) => {
    if (!filteredWords.length) {
      alert('请先选择单词范围！')
      return
    }
    setPracticeTypes(types)
    setPreviewCards(preview)
    setIsImmersive(true)
  }, [filteredWords.length, setPracticeTypes, setPreviewCards, setIsImmersive])

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
  }, [setSelUnits, setSelLessons, setSelWords])

  const toggleLesson = useCallback((lesson: string) => {
    setSelLessons(prev => {
      const next = new Set(prev)
      if (next.has(lesson)) { next.delete(lesson) } else { next.add(lesson) }
      setSelWords(new Set())
      return next
    })
  }, [setSelLessons, setSelWords])

  const toggleWord = useCallback((word: string) => {
    setSelWords(prev => {
      const next = new Set(prev)
      if (next.has(word)) { next.delete(word) } else { next.add(word) }
      return next
    })
  }, [setSelWords])

  return (
    <>
      <FilterBar
        vocab={vocab}
        selUnits={selUnits}
        selLessons={selLessons}
        selWords={selWords}
        filteredCount={filteredWords.length}
        onToggleUnit={toggleUnit}
        onToggleLesson={toggleLesson}
        onToggleWord={toggleWord}
        onClearWords={() => setSelWords(new Set())}
        masteryFilter={masteryFilter}
        onMasteryFilter={setMasteryFilter}
        masteryMap={masteryMap}
      />
      <div className="max-w-[1280px] mx-auto px-4 py-5 relative z-[1]">
        <PracticeSetup scopeLabel={scopeLabel} onStart={startPractice} />
      </div>
    </>
  )
}
