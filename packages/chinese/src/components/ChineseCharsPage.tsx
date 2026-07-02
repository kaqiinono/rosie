'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useChineseContext } from '../context/ChineseContext'
import {
  ALL_CHAR_QUIZ_TYPES,
  buildCharCardItems,
  buildLessonContentBlocks,
  buildPracticeSessionPlan,
  filterLessons,
  getLessonsForUnits,
  getUnitOptions,
  serializeQuizTypes,
  type CharQuizType,
} from '../utils/chinese-chars-session-helpers'
import {
  readCharsFilter,
  resolveCharsFilter,
  writeCharsFilter,
} from '../utils/chinese-chars-filter-storage'
import { getChineseBook } from '../utils/chinese-books'
import ChineseCharsFilterBar from './chars/ChineseCharsFilterBar'
import ChineseCharsContentPreview from './chars/ChineseCharsContentPreview'
import ChineseCharsCardsGrid from './chars/ChineseCharsCardsGrid'

export default function ChineseCharsPage() {
  const router = useRouter()
  const { lessons, lessonGroups, charByKey, isCharDataLoading, charDataError, isCharDataReady, bookSlug } =
    useChineseContext()
  const book = getChineseBook(bookSlug)

  const [selUnits, setSelUnits] = useState<Set<number>>(new Set())
  const [selLessons, setSelLessons] = useState<Set<string>>(new Set())
  const skipPersistRef = useRef(true)
  const [selDisplayType, setSelDisplayType] = useState<'library' | 'cards' | 'all'>('library')
  const [quizTypes, setQuizTypes] = useState<Set<CharQuizType>>(new Set(ALL_CHAR_QUIZ_TYPES))
  const [flippedSet, setFlippedSet] = useState<Set<number>>(new Set())

  const units = useMemo(() => getUnitOptions(book?.units ?? []), [book?.units])
  const visibleLessons = useMemo(
    () => getLessonsForUnits(lessons, selUnits),
    [lessons, selUnits],
  )

  const filtered = useMemo(
    () => filterLessons(lessons, lessonGroups, selUnits, selLessons),
    [lessons, lessonGroups, selUnits, selLessons],
  )

  const contentBlocks = useMemo(
    () => buildLessonContentBlocks(filtered, charByKey, lessons, bookSlug),
    [filtered, charByKey, lessons, bookSlug],
  )

  const cards = useMemo(() => buildCharCardItems(filtered, lessons, bookSlug), [filtered, lessons, bookSlug])

  const contentCount = useMemo(() => {
    const plan = buildPracticeSessionPlan(filtered, charByKey, quizTypes, lessons, bookSlug)
    return (
      plan.cards.length +
      plan.phraseItems.length +
      plan.poems.length +
      plan.accumulationItems.length +
      plan.passageItems.length
    )
  }, [filtered, charByKey, quizTypes, lessons, bookSlug])

  useEffect(() => {
    if (!isCharDataReady || lessons.length === 0) return

    skipPersistRef.current = true
    const saved = readCharsFilter(bookSlug)
    const resolved = resolveCharsFilter(saved, lessons)
    setSelUnits(resolved.units)
    setSelLessons(resolved.lessons)
    if (!saved) {
      writeCharsFilter(bookSlug, resolved.units, resolved.lessons)
    }
  }, [isCharDataReady, lessons, bookSlug])

  useEffect(() => {
    if (skipPersistRef.current) {
      skipPersistRef.current = false
      return
    }
    writeCharsFilter(bookSlug, selUnits, selLessons)
  }, [bookSlug, selUnits, selLessons])

  const toggleUnit = useCallback((unit: number) => {
    setSelUnits((prev) => {
      const next = new Set(prev)
      if (next.has(unit)) {
        next.delete(unit)
        setSelLessons((old) => {
          const lessonUnit = new Map(lessons.map((l) => [l.lessonKey, l.unit]))
          return new Set([...old].filter((key) => lessonUnit.get(key) !== unit))
        })
      } else {
        next.add(unit)
      }
      return next
    })
    setFlippedSet(new Set())
  }, [lessons])

  const toggleLesson = useCallback((lessonKey: string) => {
    setSelLessons((prev) => {
      const next = new Set(prev)
      if (next.has(lessonKey)) next.delete(lessonKey)
      else next.add(lessonKey)
      return next
    })
    setFlippedSet(new Set())
  }, [])

  const toggleQuizType = useCallback((type: CharQuizType) => {
    setQuizTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        if (next.size <= 1) return prev
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

  const selectDisplayType = useCallback((type: 'library' | 'cards' | 'all') => {
    setSelDisplayType(type)
  }, [])

  const flipCard = useCallback((index: number) => {
    setFlippedSet((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const allFlipped = cards.length > 0 && flippedSet.size === cards.length

  const toggleAllFlipped = useCallback(() => {
    setFlippedSet(() => {
      if (allFlipped) return new Set()
      return new Set(cards.map((_, index) => index))
    })
  }, [allFlipped, cards])

  const startPractice = useCallback(() => {
    const params = new URLSearchParams()
    if (selUnits.size > 0) params.set('units', [...selUnits].sort((a, b) => a - b).join(','))
    if (selLessons.size > 0) params.set('lessons', [...selLessons].join(','))
    params.set('types', serializeQuizTypes(quizTypes))
    router.push(`/chinese/chars/practice?${params.toString()}`)
  }, [router, selUnits, selLessons, quizTypes])

  if (isCharDataLoading && !isCharDataReady) {
    return <p className="p-6 text-center text-sm text-amber-900/50">加载字库中…</p>
  }

  if (!isCharDataReady) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center text-sm text-stone-600">
        <p>字库尚未加载。请在 Supabase 执行灌库脚本。</p>
        {charDataError && <p className="mt-2 text-rose-600">{charDataError}</p>}
      </div>
    )
  }

  return (
    <>
      <ChineseCharsFilterBar
        units={units}
        lessons={visibleLessons}
        selUnits={selUnits}
        selLessons={selLessons}
        selDisplayType={selDisplayType}
        quizTypes={quizTypes}
        contentCount={contentCount}
        onToggleUnit={toggleUnit}
        onToggleLesson={toggleLesson}
        onSelectDisplayType={selectDisplayType}
        onToggleQuizType={toggleQuizType}
        onStartPractice={startPractice}
        canStart={filtered.length > 0}
      />

      <div className="mx-auto max-w-[1280px] px-4 py-5">
        <div className="mb-4">
          <div>
            <h1 className="text-xl font-extrabold text-stone-900">生字库</h1>
            <p className="mt-0.5 text-sm text-amber-900/50">先选单元和课文，浏览卡片后开始练习</p>
          </div>
        </div>

        {(selDisplayType === 'library' || selDisplayType === 'all') && (
          <ChineseCharsContentPreview blocks={contentBlocks} />
        )}

        {(selDisplayType === 'cards' || selDisplayType === 'all') && cards.length > 0 && (
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold tracking-wide text-amber-900/55 uppercase">
                生字卡片
              </h2>
              <button
                type="button"
                onClick={toggleAllFlipped}
                className="cursor-pointer rounded-lg border-[1.5px] border-amber-200/80 bg-white/80 px-3 py-1 text-xs font-bold text-amber-900/55 transition hover:border-emerald-300"
              >
                {allFlipped ? '全部正面' : '全部翻面'}
              </button>
            </div>
            <ChineseCharsCardsGrid
              cards={cards}
              charByKey={charByKey}
              flippedSet={flippedSet}
              onFlip={flipCard}
            />
          </section>
        )}
      </div>
    </>
  )
}
