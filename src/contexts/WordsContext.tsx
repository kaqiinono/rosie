'use client'

import React, { createContext, useContext, useState, useMemo, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { User } from '@supabase/supabase-js'
import type { WordEntry, WordMasteryMap } from '@/utils/type'
import type { MasteryLevel } from '@/utils/masteryUtils'
import { getWordMasteryLevel } from '@/utils/masteryUtils'
import { useAuth } from '@/contexts/AuthContext'
import { STORAGE_KEYS } from '@/utils/constant'
import { useWordData } from '@/hooks/useWordData'
import { useWordMastery } from '@/hooks/useWordMastery'
import { getFilteredWords, wordKey } from '@/utils/english-helpers'

interface WordsContextValue {
  user: User | null
  vocab: WordEntry[]
  setVocab: (words: WordEntry[]) => Promise<void>
  upsertByStage: (words: WordEntry[]) => Promise<void>
  masteryMap: WordMasteryMap
  recordBatch: (results: { entry: WordEntry; correct: boolean }[]) => void
  // filter state
  selStage: string
  setSelStage: (stage: string) => void
  selUnits: Set<string>
  setSelUnits: Dispatch<SetStateAction<Set<string>>>
  selLessons: Set<string>
  setSelLessons: Dispatch<SetStateAction<Set<string>>>
  selWords: Set<string>
  setSelWords: Dispatch<SetStateAction<Set<string>>>
  masteryFilter: MasteryLevel | null
  setMasteryFilter: Dispatch<SetStateAction<MasteryLevel | null>>
  filteredWords: WordEntry[]
  // practice types (shared for immersive mode)
  practiceTypes: ('A' | 'B' | 'C')[]
  setPracticeTypes: Dispatch<SetStateAction<('A' | 'B' | 'C')[]>>
  previewCards: boolean
  setPreviewCards: Dispatch<SetStateAction<boolean>>
}

const WordsContext = createContext<WordsContextValue | null>(null)

export function WordsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { vocab, setVocab, upsertByStage } = useWordData(user)
  const { masteryMap, recordBatch } = useWordMastery(user)

  const [selStage, setSelStageState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ENGLISH_SEL_STAGE)
      if (saved) return saved
    } catch { /* ignore */ }
    return '4A'
  })
  const [selUnits, setSelUnits] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ENGLISH_SEL_UNITS)
      if (saved) return new Set(JSON.parse(saved) as string[])
    } catch { /* ignore */ }
    return new Set()
  })
  const [selLessons, setSelLessons] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ENGLISH_SEL_LESSONS)
      if (saved) return new Set(JSON.parse(saved) as string[])
    } catch { /* ignore */ }
    return new Set()
  })
  const [selWords, setSelWords] = useState<Set<string>>(new Set())
  const [masteryFilter, setMasteryFilter] = useState<MasteryLevel | null>(null)
  const [practiceTypes, setPracticeTypes] = useState<('A' | 'B' | 'C')[]>(['A', 'B'])
  const [previewCards, setPreviewCards] = useState(false)

  const setSelStage = (stage: string) => {
    setSelStageState(stage)
    localStorage.setItem(STORAGE_KEYS.ENGLISH_SEL_STAGE, stage)
    setSelUnits(new Set())
    setSelLessons(new Set())
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ENGLISH_SEL_UNITS, JSON.stringify([...selUnits]))
  }, [selUnits])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ENGLISH_SEL_LESSONS, JSON.stringify([...selLessons]))
  }, [selLessons])

  const filteredWords = useMemo(() => {
    const base = getFilteredWords(vocab, selStage, selUnits, selLessons, selWords)
    if (masteryFilter === null) return base
    return base.filter(v => getWordMasteryLevel(masteryMap[wordKey(v)]?.correct ?? 0) === masteryFilter)
  }, [vocab, selStage, selUnits, selLessons, selWords, masteryFilter, masteryMap])

  return (
    <WordsContext.Provider value={{
      user, vocab, setVocab, upsertByStage,
      masteryMap, recordBatch,
      selStage, setSelStage,
      selUnits, setSelUnits,
      selLessons, setSelLessons,
      selWords, setSelWords,
      masteryFilter, setMasteryFilter,
      filteredWords,
      practiceTypes, setPracticeTypes,
      previewCards, setPreviewCards,
    }}>
      {children}
    </WordsContext.Provider>
  )
}

export function useWordsContext() {
  const ctx = useContext(WordsContext)
  if (!ctx) throw new Error('useWordsContext must be used within WordsProvider')
  return ctx
}
