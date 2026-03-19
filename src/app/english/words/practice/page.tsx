'use client'

import { useState, useMemo, useCallback } from 'react'
import { useWordsContext } from '@/contexts/WordsContext'
import { shuffle, buildQuizQuestions, getAllLessons } from '@/utils/english-helpers'
import type { WordEntry } from '@/utils/type'
import FilterBar from '@/components/english/words/FilterBar'
import PracticeSetup from '@/components/english/words/PracticeSetup'
import QuizCard from '@/components/english/words/QuizCard'
import QuizResults from '@/components/english/words/QuizResults'

type QuizPhase = 'setup' | 'active' | 'results'

export default function PracticePage() {
  const {
    vocab, filteredWords,
    selUnits, setSelUnits,
    selLessons, setSelLessons,
    selWords, setSelWords,
    masteryFilter, setMasteryFilter,
    masteryMap,
    setPracticeTypes,
  } = useWordsContext()

  const [quizPhase, setQuizPhase] = useState<QuizPhase>('setup')
  const [quizQuestions, setQuizQuestions] = useState<{ word: WordEntry; type: 'A' | 'B' | 'C' }[]>([])
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizScore, setQuizScore] = useState(0)

  const scopeLabel = useMemo(() => {
    const units = selUnits.size ? [...selUnits].join(', ') : '全部Unit'
    const lessons = selLessons.size ? [...selLessons].join(', ') : '全部Lesson'
    return `${units} / ${lessons}（${filteredWords.length}词）`
  }, [selUnits, selLessons, filteredWords.length])

  const startPractice = useCallback((types: ('A' | 'B' | 'C')[]) => {
    if (!filteredWords.length) {
      alert('请先选择单词范围！')
      return
    }
    setPracticeTypes(types)
    const qs = buildQuizQuestions(filteredWords, types)
    setQuizQuestions(qs)
    setQuizIndex(0)
    setQuizScore(0)
    setQuizPhase('active')
  }, [filteredWords, setPracticeTypes])

  const handleQuizAnswer = useCallback((correct: boolean) => {
    if (correct) setQuizScore(s => s + 1)
  }, [])

  const handleQuizNext = useCallback(() => {
    const next = quizIndex + 1
    if (next >= quizQuestions.length) {
      setQuizPhase('results')
    } else {
      setQuizIndex(next)
    }
  }, [quizIndex, quizQuestions.length])

  const quizOptions = useMemo(() => {
    if (!quizQuestions[quizIndex]) return []
    const q = quizQuestions[quizIndex]
    let pool = filteredWords.filter(v => v.lesson === q.word.lesson && v.word !== q.word.word)
    if (pool.length < 3) pool = filteredWords.filter(v => v.word !== q.word.word)
    return shuffle([q.word, ...shuffle(pool, Date.now() + quizIndex).slice(0, 3)], Date.now() + quizIndex + 10)
  }, [quizQuestions, quizIndex, filteredWords])

  const toggleUnit = useCallback((unit: string) => {
    setSelUnits(prev => {
      const next = new Set(prev)
      next.has(unit) ? next.delete(unit) : next.add(unit)
      const validLessons = new Set(getAllLessons(vocab, next))
      setSelLessons(old => new Set([...old].filter(l => validLessons.has(l))))
      setSelWords(new Set())
      return next
    })
    setQuizPhase('setup')
  }, [vocab, setSelUnits, setSelLessons, setSelWords])

  const toggleLesson = useCallback((lesson: string) => {
    setSelLessons(prev => {
      const next = new Set(prev)
      next.has(lesson) ? next.delete(lesson) : next.add(lesson)
      setSelWords(new Set())
      return next
    })
    setQuizPhase('setup')
  }, [setSelLessons, setSelWords])

  const toggleWord = useCallback((word: string) => {
    setSelWords(prev => {
      const next = new Set(prev)
      next.has(word) ? next.delete(word) : next.add(word)
      return next
    })
    setQuizPhase('setup')
  }, [setSelWords])

  return (
    <>
      <FilterBar
        vocab={vocab}
        selUnits={selUnits}
        selLessons={selLessons}
        selWords={selWords}
        filteredCount={filteredWords.length}
        allFlipped={false}
        onToggleUnit={toggleUnit}
        onToggleLesson={toggleLesson}
        onToggleWord={toggleWord}
        onClearWords={() => { setSelWords(new Set()); setQuizPhase('setup') }}
        onFlipAll={() => {}}
        masteryFilter={masteryFilter}
        onMasteryFilter={setMasteryFilter}
        masteryMap={masteryMap}
      />
      <div className="max-w-[1280px] mx-auto px-4 py-5 relative z-[1]">
        {quizPhase === 'setup' && (
          <PracticeSetup scopeLabel={scopeLabel} onStart={startPractice} />
        )}
        {quizPhase === 'active' && quizQuestions[quizIndex] && (
          <QuizCard
            question={quizQuestions[quizIndex]}
            options={quizOptions}
            currentIndex={quizIndex}
            totalCount={quizQuestions.length}
            score={quizScore}
            onAnswer={handleQuizAnswer}
            onNext={handleQuizNext}
          />
        )}
        {quizPhase === 'results' && (
          <QuizResults
            score={quizScore}
            total={quizQuestions.length}
            onRetry={() => setQuizPhase('setup')}
          />
        )}
      </div>
    </>
  )
}
