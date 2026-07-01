'use client'

import { useCallback, useMemo, useState } from 'react'
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
import ChineseCharsFilterBar from './chars/ChineseCharsFilterBar'
import ChineseCharsContentPreview from './chars/ChineseCharsContentPreview'
import ChineseCharsCardsGrid from './chars/ChineseCharsCardsGrid'

export default function ChineseCharsPage() {
  const router = useRouter()
  const { lessons, lessonGroups, charByKey, isCharDataLoading, charDataError, isCharDataReady } =
    useChineseContext()

  const [selUnits, setSelUnits] = useState<Set<number>>(new Set())
  const [selLessons, setSelLessons] = useState<Set<string>>(new Set())
  const [quizTypes, setQuizTypes] = useState<Set<CharQuizType>>(new Set(ALL_CHAR_QUIZ_TYPES))
  const [flippedSet, setFlippedSet] = useState<Set<number>>(new Set())
  const [dualMode, setDualMode] = useState(false)

  const units = useMemo(() => getUnitOptions(), [])
  const visibleLessons = useMemo(
    () => getLessonsForUnits(lessons, selUnits),
    [lessons, selUnits],
  )

  const filtered = useMemo(
    () => filterLessons(lessons, lessonGroups, selUnits, selLessons),
    [lessons, lessonGroups, selUnits, selLessons],
  )

  const contentBlocks = useMemo(
    () => buildLessonContentBlocks(filtered, charByKey, lessons),
    [filtered, charByKey, lessons],
  )

  const cards = useMemo(() => buildCharCardItems(filtered, lessons), [filtered, lessons])

  const contentCount = useMemo(() => {
    const plan = buildPracticeSessionPlan(filtered, charByKey, quizTypes, lessons)
    return (
      plan.cards.length +
      plan.phraseItems.length +
      plan.poems.length +
      plan.accumulationItems.length +
      plan.passageItems.length
    )
  }, [filtered, charByKey, quizTypes, lessons])

  const toggleUnit = useCallback((unit: number) => {
    setSelUnits((prev) => {
      const next = new Set(prev)
      if (next.has(unit)) {
        next.delete(unit)
        setSelLessons((old) => new Set([...old].filter((k) => !k.startsWith(`u${unit}-`))))
      } else {
        next.add(unit)
      }
      return next
    })
    setFlippedSet(new Set())
  }, [])

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

  const flipCard = useCallback((index: number) => {
    setFlippedSet((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

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
        quizTypes={quizTypes}
        contentCount={contentCount}
        onToggleUnit={toggleUnit}
        onToggleLesson={toggleLesson}
        onToggleQuizType={toggleQuizType}
        onStartPractice={startPractice}
        canStart={filtered.length > 0}
      />

      <div className="mx-auto max-w-[1280px] px-4 py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-extrabold text-stone-900">生字库</h1>
            <p className="mt-0.5 text-sm text-amber-900/50">先选单元和课文，浏览卡片后开始练习</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDualMode((v) => !v)
              setFlippedSet(new Set())
            }}
            className={`cursor-pointer rounded-lg border-[1.5px] px-3.5 py-1.5 text-sm font-bold transition ${
              dualMode
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-amber-200/80 bg-white/80 text-amber-900/55 hover:border-emerald-300'
            }`}
          >
            {dualMode ? '退出双面' : '双面模式'}
          </button>
        </div>

        <ChineseCharsContentPreview blocks={contentBlocks} />

        {cards.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-sm font-extrabold tracking-wide text-amber-900/55 uppercase">
              生字卡片
            </h2>
            <ChineseCharsCardsGrid
              cards={cards}
              charByKey={charByKey}
              flippedSet={flippedSet}
              onFlip={flipCard}
              dualMode={dualMode}
            />
          </section>
        )}
      </div>
    </>
  )
}
