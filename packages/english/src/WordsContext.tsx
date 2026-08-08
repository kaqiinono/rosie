'use client'

import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { User } from '@supabase/supabase-js'
import type { WordEntry, WordMasteryMap } from '@rosie/core'
import type { SpellButtonStyle } from './components/words/SpellTiles'
import type { MasteryLevel } from '@rosie/core'
import { getWordMasteryLevel } from '@rosie/core'
import { useAuth } from '@rosie/core'
import { STORAGE_KEYS } from '@rosie/core'
import { useWordData, useStageIndex } from './hooks/useWordData'
import { useWordMastery } from './hooks/useWordMastery'
import { useEnglishWrong } from './hooks/useEnglishWrong'
import { getFilteredWords, getAllStages, getAllUnits, wordKey } from './utils/english-helpers'

interface WordsContextValue {
  user: User | null
  vocab: WordEntry[]
  isVocabLoading: boolean
  /** Every textbook (stage) that exists in the word library. */
  availableStages: string[]
  /** lesson key (`unit::lesson`) → stage; resolves cross-textbook entries. */
  lessonStage: Record<string, string>
  upsertByStage: (words: WordEntry[]) => Promise<void>
  masteryMap: WordMasteryMap
  recordBatch: (results: { entry: WordEntry; correct: boolean }[]) => void
  recordRecallAttempt: (entry: WordEntry, correct: boolean) => void
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
  practiceTypes: ('A' | 'B' | 'C' | 'D')[]
  setPracticeTypes: Dispatch<SetStateAction<('A' | 'B' | 'C' | 'D')[]>>
  previewCards: boolean
  setPreviewCards: Dispatch<SetStateAction<boolean>>
  /** Type-C 拼写题字母池按钮样式（共享，跨练习入口） */
  practiceButtonStyle: SpellButtonStyle
  setPracticeButtonStyle: Dispatch<SetStateAction<SpellButtonStyle>>
}

const WordsContext = createContext<WordsContextValue | null>(null)

/**
 * `vocabScope="stage"` loads only the active textbook (per-stage request +
 * cache, switched from the header); `"all"` keeps the legacy full library
 * (admin editors, etc.).
 *
 * Stage-scoped mode is intentionally single-textbook: 难词本 / 计划练习 only
 * see the active book. availableStages[0] is the newest (compareStages).
 */
export function WordsProvider({
  children,
  vocabScope = 'all',
}: {
  children: React.ReactNode
  vocabScope?: 'stage' | 'all'
}) {
  const { user } = useAuth()
  const stageMode = vocabScope === 'stage'

  const [selStage, setSelStageState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.ENGLISH_SEL_STAGE) ?? ''
    } catch { /* ignore */ }
    return ''
  })
  const [selUnitsRaw, setSelUnitsRaw] = useState<Set<string>>(() => {
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
  const [practiceTypes, setPracticeTypes] = useState<('A' | 'B' | 'C' | 'D')[]>(['A', 'B'])
  const [previewCards, setPreviewCards] = useState(false)
  const [practiceButtonStyle, setPracticeButtonStyle] = useState<SpellButtonStyle>('candy')

  const stageIndex = useStageIndex(stageMode ? user : null)

  // In stage mode, prefer the index (no full vocab). In all mode, derive from vocab.
  const indexStages = stageIndex.stages

  // Optimistic: if the user already has a saved textbook, fetch it before the
  // stage index arrives. Once the index loads, invalid picks snap to latest.
  const stageForFetch =
    stageMode && selStage && (indexStages.length === 0 || indexStages.includes(selStage))
      ? selStage
      : null

  const { vocab, upsertByStage, isLoading: isVocabLoading } = useWordData(
    user,
    stageMode ? { stage: stageForFetch } : undefined,
  )

  const availableStages = useMemo(
    () => (stageMode ? indexStages : getAllStages(vocab)),
    [stageMode, indexStages, vocab],
  )

  // Snap invalid/missing pick to the newest textbook during render
  // (avoids setState-in-effect). availableStages[0] is latest via compareStages.
  if (availableStages.length > 0 && (!selStage || !availableStages.includes(selStage))) {
    const latest = availableStages[0]
    setSelStageState(latest)
    try {
      localStorage.setItem(STORAGE_KEYS.ENGLISH_SEL_STAGE, latest)
    } catch { /* ignore */ }
  }

  const { masteryMap, recordBatch: recordBatchRaw, recordRecallAttempt: recordRecallRaw } = useWordMastery(user)
  const { addWrong, markResolved } = useEnglishWrong(user)

  const syncWrongWord = useCallback((entry: WordEntry, correct: boolean) => {
    const k = wordKey(entry)
    if (correct) void markResolved(k)
    else void addWrong(k)
  }, [addWrong, markResolved])

  const recordBatch = useCallback((results: { entry: WordEntry; correct: boolean }[]) => {
    recordBatchRaw(results)
    for (const r of results) syncWrongWord(r.entry, r.correct)
  }, [recordBatchRaw, syncWrongWord])

  const recordRecallAttempt = useCallback((entry: WordEntry, correct: boolean) => {
    recordRecallRaw(entry, correct)
    syncWrongWord(entry, correct)
  }, [recordRecallRaw, syncWrongWord])

  const setSelStage = (stage: string) => {
    setSelStageState(stage)
    localStorage.setItem(STORAGE_KEYS.ENGLISH_SEL_STAGE, stage)
    const units = getAllUnits(vocab, stage)
    setSelUnitsRaw(units.length ? new Set([units[0]]) : new Set())
    setSelLessons(new Set())
    // Word picks belong to the previous textbook.
    setSelWords(new Set())
  }

  const lessonStage = useMemo(() => {
    if (stageMode) return stageIndex.lessonStage
    const map: Record<string, string> = {}
    for (const v of vocab) {
      const key = `${v.unit}::${v.lesson}`
      if (!(key in map) && v.stage) map[key] = v.stage
    }
    return map
  }, [stageMode, stageIndex.lessonStage, vocab])

  const stageUnits = useMemo(() => getAllUnits(vocab, selStage), [vocab, selStage])

  /** 无选中或选中项不属于当前 Stage 时，回退到第一个 Unit。 */
  const selUnits = useMemo(() => {
    if (!stageUnits.length) return selUnitsRaw
    if (selUnitsRaw.size === 0) return new Set([stageUnits[0]])
    if ([...selUnitsRaw].every((u) => stageUnits.includes(u))) return selUnitsRaw
    return new Set([stageUnits[0]])
  }, [selUnitsRaw, stageUnits])

  const setSelUnits: Dispatch<SetStateAction<Set<string>>> = (action) => {
    setSelUnitsRaw(action)
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ENGLISH_SEL_UNITS, JSON.stringify([...selUnitsRaw]))
  }, [selUnitsRaw])

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
      user, vocab, isVocabLoading, availableStages, lessonStage, upsertByStage,
      masteryMap, recordBatch, recordRecallAttempt,
      selStage, setSelStage,
      selUnits, setSelUnits,
      selLessons, setSelLessons,
      selWords, setSelWords,
      masteryFilter, setMasteryFilter,
      filteredWords,
      practiceTypes, setPracticeTypes,
      previewCards, setPreviewCards,
      practiceButtonStyle, setPracticeButtonStyle,
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
