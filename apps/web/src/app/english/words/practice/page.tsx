'use client'

import { useMemo, useCallback, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useWordsContext } from '@rosie/english'
import { useImmersive } from '@rosie/core'
import { findPassage, findPassageByKey, findSentenceForWord } from '@rosie/english'
import { FilterBar } from '@rosie/english'
import { PracticeSetup } from '@rosie/english'
import type { SpellButtonStyle } from '@rosie/english'

export default function PracticePage() {
  const {
    vocab, filteredWords,
    selStage, setSelStage,
    selUnits, setSelUnits,
    selLessons, setSelLessons,
    selWords, setSelWords,
    masteryFilter, setMasteryFilter,
    masteryMap,
    setPracticeTypes,
    setPreviewCards,
    practiceButtonStyle,
    setPracticeButtonStyle,
  } = useWordsContext()
  const { setIsImmersive } = useImmersive()
  const searchParams = useSearchParams()
  const router = useRouter()

  // 3C: Context-practice entry from the reading page. When the URL carries
  // `?context=<passageKey>`, auto-filter to that lesson and launch immersive
  // Type-D practice without going through the manual PracticeSetup step.
  const contextPassageKey = searchParams.get('context')
  const autoLaunchedRef = useRef(false)
  useEffect(() => {
    if (!contextPassageKey || autoLaunchedRef.current || vocab.length === 0) return
    const passage = findPassageByKey(contextPassageKey)
    if (!passage) return
    autoLaunchedRef.current = true
    setSelUnits(new Set([passage.unit]))
    setSelLessons(new Set([`${passage.unit}::${passage.lesson}`]))
    setSelWords(new Set())
    setMasteryFilter(null)
    setPracticeTypes(['D'])
    setPreviewCards(false)
    setIsImmersive(true)
    // Drop the query so a refresh doesn't re-launch.
    router.replace('/english/words/practice')
  }, [contextPassageKey, vocab.length, setSelUnits, setSelLessons, setSelWords, setMasteryFilter, setPracticeTypes, setPreviewCards, setIsImmersive, router])

  // Type D is available whenever any filtered word's lesson has a passage
  // sentence for it — completely independent of the week-plan's ⭐ focus marker.
  const typeDAvailable = useMemo(
    () =>
      filteredWords.some((w) => {
        const passage = findPassage(w.stage, w.unit, w.lesson)
        return passage !== undefined && findSentenceForWord(passage, w.word) !== null
      }),
    [filteredWords],
  )

  const scopeLabel = useMemo(() => {
    const units = selUnits.size ? [...selUnits].join(', ') : '全部Unit'
    const lessons = selLessons.size
      ? [...new Set([...selLessons].map(k => k.split('::')[1]))].join(', ')
      : '全部Lesson'
    return `${units} / ${lessons}（${filteredWords.length}词）`
  }, [selUnits, selLessons, filteredWords.length])

  const startPractice = useCallback(
    (types: ('A' | 'B' | 'C' | 'D')[], preview: boolean, buttonStyle: SpellButtonStyle) => {
      if (!filteredWords.length) {
        alert('请先选择单词范围！')
        return
      }
      setPracticeTypes(types)
      setPreviewCards(preview)
      setPracticeButtonStyle(buttonStyle)
      setIsImmersive(true)
    },
    [filteredWords.length, setPracticeTypes, setPreviewCards, setPracticeButtonStyle, setIsImmersive],
  )

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
        selStage={selStage}
        onSetStage={setSelStage}
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
        <PracticeSetup
          scopeLabel={scopeLabel}
          onStart={startPractice}
          typeDAvailable={typeDAvailable}
          initialButtonStyle={practiceButtonStyle}
        />
      </div>
    </>
  )
}
