'use client'

import React, { createContext, useContext, useState, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { User } from '@supabase/supabase-js'
import type { WordEntry, WordMasteryMap } from '@/utils/type'
import type { MasteryLevel } from '@/utils/masteryUtils'
import { getMasteryLevel } from '@/utils/masteryUtils'
import { useAuth } from '@/contexts/AuthContext'
import { useWordData } from '@/hooks/useWordData'
import { useWordMastery } from '@/hooks/useWordMastery'
import { getFilteredWords, wordKey } from '@/utils/english-helpers'

interface WordsContextValue {
  user: User | null
  vocab: WordEntry[]
  setVocab: (words: WordEntry[]) => Promise<void>
  masteryMap: WordMasteryMap
  recordBatch: (results: { entry: WordEntry; correct: boolean }[]) => void
  // filter state
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
}

const WordsContext = createContext<WordsContextValue | null>(null)

export function WordsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { vocab, setVocab } = useWordData(user)
  const { masteryMap, recordBatch } = useWordMastery(user)

  const [selUnits, setSelUnits] = useState<Set<string>>(new Set(['Unit 1']))
  const [selLessons, setSelLessons] = useState<Set<string>>(new Set(['Lesson 1']))
  const [selWords, setSelWords] = useState<Set<string>>(new Set())
  const [masteryFilter, setMasteryFilter] = useState<MasteryLevel | null>(null)
  const [practiceTypes, setPracticeTypes] = useState<('A' | 'B' | 'C')[]>(['A', 'B'])

  const filteredWords = useMemo(() => {
    const base = getFilteredWords(vocab, selUnits, selLessons, selWords)
    if (masteryFilter === null) return base
    return base.filter(v => getMasteryLevel(masteryMap[wordKey(v)]?.correct ?? 0) === masteryFilter)
  }, [vocab, selUnits, selLessons, selWords, masteryFilter, masteryMap])

  return (
    <WordsContext.Provider value={{
      user, vocab, setVocab,
      masteryMap, recordBatch,
      selUnits, setSelUnits,
      selLessons, setSelLessons,
      selWords, setSelWords,
      masteryFilter, setMasteryFilter,
      filteredWords,
      practiceTypes, setPracticeTypes,
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
