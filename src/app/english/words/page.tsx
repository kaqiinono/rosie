'use client'

import { useState, useMemo, useCallback } from 'react'
import type { WordEntry } from '@/utils/type'
import { STORAGE_KEYS } from '@/utils/constant'
import { SAMPLE_WORDS } from '@/utils/english-data'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { getFilteredWords, getAllUnits, getAllLessons, shuffle, buildQuizQuestions } from '@/utils/english-helpers'
import AppHeader from '@/components/english/words/AppHeader'
import FilterBar from '@/components/english/words/FilterBar'
import PhonicsLegend from '@/components/english/words/PhonicsLegend'
import CardsGrid from '@/components/english/words/CardsGrid'
import PracticeSetup from '@/components/english/words/PracticeSetup'
import QuizCard from '@/components/english/words/QuizCard'
import QuizResults from '@/components/english/words/QuizResults'
import DailyPractice from '@/components/english/words/DailyPractice'
import ImportModal from '@/components/english/words/ImportModal'
import ImmersiveMode from '@/components/english/words/ImmersiveMode'

type TabId = 'cards' | 'practice' | 'daily'
type QuizPhase = 'setup' | 'active' | 'results'

export default function EnglishWordsPage() {
  const [vocab, setVocab] = useLocalStorage<WordEntry[]>(STORAGE_KEYS.WORD_DATA, SAMPLE_WORDS)
  const [activeTab, setActiveTab] = useState<TabId>('cards')

  const [selUnits, setSelUnits] = useState<Set<string>>(new Set(['Unit 1']))
  const [selLessons, setSelLessons] = useState<Set<string>>(new Set(['Lesson 1']))
  const [selWords, setSelWords] = useState<Set<string>>(new Set())

  const [flippedSet, setFlippedSet] = useState<Set<number>>(new Set())
  const [allFlipped, setAllFlipped] = useState(false)

  const [quizPhase, setQuizPhase] = useState<QuizPhase>('setup')
  const [quizQuestions, setQuizQuestions] = useState<{ word: WordEntry; type: 'A' | 'B' | 'C' }[]>([])
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizScore, setQuizScore] = useState(0)
  const [practiceTypes, setPracticeTypes] = useState<('A' | 'B' | 'C')[]>(['A', 'B'])

  const [importOpen, setImportOpen] = useState(false)
  const [immersiveOpen, setImmersiveOpen] = useState(false)
  const [immersiveMode, setImmersiveMode] = useState<'vocab' | 'practice'>('vocab')

  const filteredWords = useMemo(
      () => getFilteredWords(vocab, selUnits, selLessons, selWords),
      [vocab, selUnits, selLessons, selWords]
  )

  const scopeLabel = useMemo(() => {
    const units = selUnits.size ? [...selUnits].join(', ') : '全部Unit'
    const lessons = selLessons.size ? [...selLessons].join(', ') : '全部Lesson'
    return `${units} / ${lessons}（${filteredWords.length}词）`
  }, [selUnits, selLessons, filteredWords.length])

  const toggleUnit = useCallback((unit: string) => {
    setSelUnits(prev => {
      const next = new Set(prev)
      next.has(unit) ? next.delete(unit) : next.add(unit)
      const validLessons = new Set(getAllLessons(vocab, next))
      setSelLessons(old => new Set([...old].filter(l => validLessons.has(l))))
      setSelWords(new Set())
      return next
    })
    resetCards()
  }, [vocab])

  const toggleLesson = useCallback((lesson: string) => {
    setSelLessons(prev => {
      const next = new Set(prev)
      next.has(lesson) ? next.delete(lesson) : next.add(lesson)
      setSelWords(new Set())
      return next
    })
    resetCards()
  }, [])

  const toggleWord = useCallback((word: string) => {
    setSelWords(prev => {
      const next = new Set(prev)
      next.has(word) ? next.delete(word) : next.add(word)
      return next
    })
    resetCards()
  }, [])

  const clearWords = useCallback(() => {
    setSelWords(new Set())
    resetCards()
  }, [])

  const resetCards = useCallback(() => {
    setFlippedSet(new Set())
    setAllFlipped(false)
  }, [])

  const flipCard = useCallback((index: number) => {
    setFlippedSet(prev => {
      const next = new Set(prev)
      next.has(index) ? next.delete(index) : next.add(index)
      return next
    })
  }, [])

  const flipAll = useCallback(() => {
    const newFlipped = !allFlipped
    setAllFlipped(newFlipped)
    if (newFlipped) {
      setFlippedSet(new Set(filteredWords.map((_, i) => i)))
    } else {
      setFlippedSet(new Set())
    }
  }, [allFlipped, filteredWords])

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab)
    if (tab === 'practice') setQuizPhase('setup')
  }, [])

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
  }, [filteredWords])

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

  const handleImport = useCallback((words: WordEntry[]) => {
    setVocab(words)
    setSelUnits(new Set())
    setSelLessons(new Set())
    setSelWords(new Set())
    resetCards()
  }, [setVocab, resetCards])

  const handleExport = useCallback(async () => {
    const xlsx = await import('xlsx')
    const { utils, writeFile } = xlsx.default || xlsx
    const wb = utils.book_new()
    const headers = ['Unit', 'Lesson', '单词 (word)', '释义 (explanation)', '音标 (ipa)', '例句 (example)']
    const rows = [headers, ...vocab.map(v => [v.unit, v.lesson, v.word, v.explanation, v.ipa || '', v.example || ''])]
    const ws = utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 45 }, { wch: 18 }, { wch: 50 }]
    utils.book_append_sheet(wb, ws, '单词数据')
    writeFile(wb, 'RosieFun_词库.xlsx')
  }, [vocab])

  const enterImmersive = useCallback(() => {
    if (!filteredWords.length) {
      alert('请先筛选单词！')
      return
    }
    setImmersiveMode(activeTab === 'practice' ? 'practice' : 'vocab')
    setImmersiveOpen(true)
  }, [filteredWords, activeTab])

  return (
      <div className="min-h-screen font-nunito" style={{ background: 'var(--wm-bg)', color: 'var(--wm-text)' }}>
        <div className="fixed inset-0 pointer-events-none z-0" style={{
          background: 'radial-gradient(ellipse at 15% 25%, rgba(233,69,96,.07) 0, transparent 55%), radial-gradient(ellipse at 85% 75%, rgba(96,165,250,.07) 0, transparent 55%)'
        }} />

        <AppHeader
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onImport={() => setImportOpen(true)}
            onExport={handleExport}
            onImmersive={enterImmersive}
        />

        {activeTab === 'cards' && (
            <>
              <FilterBar
                  vocab={vocab}
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
              />
              <div className="max-w-[1280px] mx-auto px-4 py-5 relative z-[1]">
                <PhonicsLegend />
                <CardsGrid
                    words={filteredWords}
                    flippedSet={flippedSet}
                    onFlip={flipCard}
                />
              </div>
            </>
        )}

        {activeTab === 'practice' && (
            <div className="max-w-[1280px] mx-auto px-4 py-5 relative z-[1]">
              {quizPhase === 'setup' && (
                  <PracticeSetup
                      scopeLabel={scopeLabel}
                      onStart={startPractice}
                  />
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
        )}

        {activeTab === 'daily' && (
            <DailyPractice vocab={vocab} />
        )}

        <ImportModal
            open={importOpen}
            onClose={() => setImportOpen(false)}
            onImport={handleImport}
        />

        <ImmersiveMode
            open={immersiveOpen}
            words={filteredWords}
            allWords={vocab}
            mode={immersiveMode}
            practiceTypes={practiceTypes}
            onClose={() => setImmersiveOpen(false)}
        />
      </div>
  )
}
