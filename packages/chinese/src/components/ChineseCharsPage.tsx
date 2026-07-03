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
  writeCharsCardPreview,
  writeCharsFilter,
} from '../utils/chinese-chars-filter-storage'
import { getChineseBook } from '../utils/chinese-books'
import ChineseCharsFilterBar from './chars/ChineseCharsFilterBar'
import ChineseCharsContentPreview from './chars/ChineseCharsContentPreview'
import ChineseCharsCardsGrid from './chars/ChineseCharsCardsGrid'
import ChineseWordsCardsGrid from './chars/ChineseWordsCardsGrid'
import { buildWordCardItems } from '../utils/chinese-pinyin-write-helpers'
import { chineseRoute } from '../utils/chinese-routes'

export default function ChineseCharsPage() {
  const router = useRouter()
  const { lessons, lessonGroups, charByKey, isCharDataLoading, charDataError, isCharDataReady, bookSlug } =
    useChineseContext()
  const book = getChineseBook(bookSlug)

  const [selUnits, setSelUnits] = useState<Set<number>>(new Set())
  const [selLessons, setSelLessons] = useState<Set<string>>(new Set())
  const skipPersistRef = useRef(true)
  const [selDisplayType, setSelDisplayType] = useState<'library' | 'cards' | 'all'>('library')
  const [cardPreviewEnabled, setCardPreviewEnabled] = useState(true)
  const [quizTypes, setQuizTypes] = useState<Set<CharQuizType>>(new Set(ALL_CHAR_QUIZ_TYPES))
  const [flippedSet, setFlippedSet] = useState<Set<number>>(new Set())
  const [wordFlippedSet, setWordFlippedSet] = useState<Set<number>>(new Set())

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
  const wordCards = useMemo(
    () => buildWordCardItems(filtered, lessons, bookSlug),
    [filtered, lessons, bookSlug],
  )

  const contentCount = useMemo(() => {
    const plan = buildPracticeSessionPlan(filtered, charByKey, quizTypes, lessons, bookSlug)
    return (
      plan.cards.length +
      plan.phraseItems.length +
      plan.poems.length +
      plan.accumulationItems.length +
      plan.passageItems.length +
      plan.pinyinWriteItems.length
    )
  }, [filtered, charByKey, quizTypes, lessons, bookSlug])

  useEffect(() => {
    if (!isCharDataReady || lessons.length === 0) return

    skipPersistRef.current = true
    const saved = readCharsFilter(bookSlug)
    const resolved = resolveCharsFilter(saved, lessons)
    setSelUnits(resolved.units)
    setSelLessons(resolved.lessons)
    setCardPreviewEnabled(saved?.cardPreview !== false)
    if (!saved) {
      writeCharsFilter(bookSlug, resolved.units, resolved.lessons, true)
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
    setWordFlippedSet(new Set())
  }, [lessons])

  const toggleLesson = useCallback((lessonKey: string) => {
    setSelLessons((prev) => {
      const next = new Set(prev)
      if (next.has(lessonKey)) next.delete(lessonKey)
      else next.add(lessonKey)
      return next
    })
    setFlippedSet(new Set())
    setWordFlippedSet(new Set())
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

  const toggleCardPreview = useCallback(() => {
    setCardPreviewEnabled((prev) => {
      const next = !prev
      writeCharsCardPreview(bookSlug, next)
      return next
    })
  }, [bookSlug])

  const flipCard = useCallback((index: number) => {
    setFlippedSet((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const allFlipped = cards.length > 0 && flippedSet.size === cards.length
  const allWordsFlipped = wordCards.length > 0 && wordFlippedSet.size === wordCards.length

  const toggleAllFlipped = useCallback(() => {
    setFlippedSet(() => {
      if (allFlipped) return new Set()
      return new Set(cards.map((_, index) => index))
    })
  }, [allFlipped, cards])

  const toggleAllWordsFlipped = useCallback(() => {
    setWordFlippedSet(() => {
      if (allWordsFlipped) return new Set()
      return new Set(wordCards.map((_, index) => index))
    })
  }, [allWordsFlipped, wordCards])

  const flipWordCard = useCallback((index: number) => {
    setWordFlippedSet((prev) => {
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
    if (!cardPreviewEnabled) params.set('cardPreview', '0')
    router.push(`/chinese/chars/practice?${params.toString()}`)
  }, [router, selUnits, selLessons, quizTypes, cardPreviewEnabled])

  const openPrint = useCallback(
    (type: 'words' | 'chars' | 'all') => {
      const params = new URLSearchParams({ type })
      if (selUnits.size > 0) params.set('units', [...selUnits].sort((a, b) => a - b).join(','))
      if (selLessons.size > 0) params.set('lessons', [...selLessons].join(','))
      window.open(`${chineseRoute(bookSlug, 'chars/print')}?${params.toString()}`, '_blank')
    },
    [bookSlug, selUnits, selLessons],
  )

  const canPrint = cards.length > 0 || wordCards.length > 0

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
        onPrintAll={() => openPrint('all')}
        cardPreviewEnabled={cardPreviewEnabled}
        onToggleCardPreview={toggleCardPreview}
        canStart={filtered.length > 0}
        canPrint={canPrint}
      />

      <div className="mx-auto max-w-[1280px] px-4 py-5">
        <div className="mb-4">
          <div>
            <h1 className="text-xl font-extrabold text-stone-900">生字库</h1>
            <p className="mt-0.5 text-sm text-amber-900/50">
              {cardPreviewEnabled
                ? '先选单元和课文，浏览卡片后开始练习'
                : '先选单元和课文，开始练习后将直接进入测验'}
            </p>
          </div>
        </div>

        {(selDisplayType === 'library' || selDisplayType === 'all') && (
          <ChineseCharsContentPreview blocks={contentBlocks} />
        )}

        {(selDisplayType === 'cards' || selDisplayType === 'all') &&
          cardPreviewEnabled &&
          cards.length > 0 && (
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold tracking-wide text-amber-900/55 uppercase">
                生字卡片
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openPrint('chars')}
                  className="cursor-pointer rounded-lg border-[1.5px] border-amber-200/80 bg-white/80 px-3 py-1 text-xs font-bold text-amber-900/55 transition hover:border-emerald-300"
                >
                  打印
                </button>
                <button
                  type="button"
                  onClick={toggleAllFlipped}
                  className="cursor-pointer rounded-lg border-[1.5px] border-amber-200/80 bg-white/80 px-3 py-1 text-xs font-bold text-amber-900/55 transition hover:border-emerald-300"
                >
                  {allFlipped ? '全部正面' : '全部翻面'}
                </button>
              </div>
            </div>
            <ChineseCharsCardsGrid
              cards={cards}
              charByKey={charByKey}
              flippedSet={flippedSet}
              onFlip={flipCard}
            />
          </section>
        )}

        {(selDisplayType === 'cards' || selDisplayType === 'all') &&
          cardPreviewEnabled &&
          wordCards.length > 0 && (
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold tracking-wide text-teal-800/55 uppercase">
                词语卡片
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openPrint('words')}
                  className="cursor-pointer rounded-lg border-[1.5px] border-teal-200/80 bg-white/80 px-3 py-1 text-xs font-bold text-teal-900/55 transition hover:border-emerald-300"
                >
                  打印
                </button>
                <button
                  type="button"
                  onClick={toggleAllWordsFlipped}
                  className="cursor-pointer rounded-lg border-[1.5px] border-teal-200/80 bg-white/80 px-3 py-1 text-xs font-bold text-teal-900/55 transition hover:border-emerald-300"
                >
                  {allWordsFlipped ? '全部正面' : '全部翻面'}
                </button>
              </div>
            </div>
            <ChineseWordsCardsGrid
              words={wordCards}
              flippedSet={wordFlippedSet}
              onFlip={flipWordCard}
            />
          </section>
        )}
      </div>
    </>
  )
}
