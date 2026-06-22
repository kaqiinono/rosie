'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  QuizQuestion,
  RescueQueueItem,
  WordEntry,
  QuizType,
} from '@rosie/core'
import { interleaveOrderedQuizSlots } from '../utils/english-helpers'
import { MONSTERS } from '../components/words/monsters'
import { STORAGE_KEYS } from '@rosie/core'

export interface RescueBatches {
  /** Eaten words to review (manual carousel) before practice begins. */
  reviewWords: WordEntry[]
  /**
   * Interleaved practice: half words (1 question) + eaten words (A recognition →
   * original type), cross-mixed so the same word's questions never sit adjacent.
   */
  practice: QuizQuestion[]
}

export interface UseRescueQueueApi {
  retryList: RescueQueueItem[]
  eatenList: RescueQueueItem[]
  enqueueHalf(entry: WordEntry, type: QuizType, wordKey: string): void
  enqueueEaten(entry: WordEntry, type: QuizType, wordKey: string): { monsterIdx: number }
  advance(wordKey: string, outcome: 'correct' | 'wrong'): void
  isInQueue(wordKey: string): boolean
  buildBatches(seed: number): RescueBatches
  clear(): void
}

export interface UseRescueQueueArgs { planId: string; dateKey: string }

export function useRescueQueue({ planId, dateKey }: UseRescueQueueArgs): UseRescueQueueApi {
  const [items, setItems] = useState<RescueQueueItem[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.RESCUE_QUEUE)
      if (!raw) return []
      const parsed = JSON.parse(raw) as { planId: string; dateKey: string; items: RescueQueueItem[] }
      if (parsed.planId !== planId || parsed.dateKey !== dateKey) return []
      return parsed.items
    } catch { return [] }
  })
  const seqRef = useRef(0)

  // Debounced localStorage write (200ms) whenever items/planId/dateKey change
  const writeTimerRef = useRef<number | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (writeTimerRef.current) window.clearTimeout(writeTimerRef.current)
    writeTimerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEYS.RESCUE_QUEUE, JSON.stringify({ planId, dateKey, items }))
      } catch {}
    }, 200)
    return () => { if (writeTimerRef.current) window.clearTimeout(writeTimerRef.current) }
  }, [items, planId, dateKey])

  // Reset to empty when planId/dateKey changes — done during render (the
  // React-recommended pattern) rather than in an effect, to avoid a
  // setState-in-effect cascade.
  const [prevKey, setPrevKey] = useState(`${planId}::${dateKey}`)
  const curKey = `${planId}::${dateKey}`
  if (prevKey !== curKey) {
    setPrevKey(curKey)
    setItems([])
  }

  const enqueueHalf = useCallback((entry: WordEntry, type: QuizType, wordKey: string) => {
    const ts = ++seqRef.current
    setItems((prev) => {
      if (prev.some((i) => i.wordKey === wordKey)) return prev
      return [...prev, {
        wordKey, entry, severity: 'half',
        originalType: type, stage: 'pending',
        enqueuedAtMs: ts,
      }]
    })
  }, [])

  const enqueueEaten = useCallback((entry: WordEntry, type: QuizType, wordKey: string) => {
    const existing = items.find(
      (i) => i.wordKey === wordKey && i.severity === 'eaten',
    )
    if (existing) {
      // Already eaten — return existing monsterIdx, no state change.
      return { monsterIdx: existing.monsterIdx ?? 0 }
    }
    const monsterIdx = Math.floor(Math.random() * MONSTERS.length)
    const ts = ++seqRef.current
    setItems((prev) => {
      // Defensive re-check inside the updater for strict-mode safety.
      if (prev.some((i) => i.wordKey === wordKey && i.severity === 'eaten')) {
        return prev
      }
      // 同 wordKey 已是 half 时升级为 eaten
      const without = prev.filter((i) => i.wordKey !== wordKey)
      return [...without, {
        wordKey, entry, severity: 'eaten',
        originalType: type, stage: 'pending', monsterIdx,
        enqueuedAtMs: ts,
      }]
    })
    return { monsterIdx }
  }, [items])

  const advance = useCallback((wordKey: string, outcome: 'correct' | 'wrong') => {
    setItems((prev) => prev.map((it) => {
      if (it.wordKey !== wordKey) return it
      if (it.severity === 'half') {
        return { ...it, stage: outcome === 'correct' ? 'consolidated' : 'still_half' }
      }
      // eaten ladder: pending → flashcard_done → reinforce1_done → saved | lost
      if (it.stage === 'pending') return { ...it, stage: 'flashcard_done' }
      if (it.stage === 'flashcard_done') {
        return { ...it, stage: outcome === 'correct' ? 'reinforce1_done' : 'lost' }
      }
      if (it.stage === 'reinforce1_done') {
        return { ...it, stage: outcome === 'correct' ? 'saved' : 'lost' }
      }
      return it
    }))
  }, [])

  const isInQueue = useCallback(
    (wordKey: string) => items.some((i) => i.wordKey === wordKey),
    [items],
  )

  const clear = useCallback(() => {
    setItems([])
    try { if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEYS.RESCUE_QUEUE) } catch {}
  }, [])

  const retryList = useMemo(
    () => items.filter((i) => i.severity === 'half'),
    [items],
  )
  const eatenList = useMemo(
    () => items.filter((i) => i.severity === 'eaten'),
    [items],
  )

  const buildBatches = useCallback((seed: number): RescueBatches => {
    const halfActive = items.filter((i) => i.severity === 'half' && i.stage === 'pending')
    const eatenActive = items
      .filter((i) => i.severity === 'eaten' && i.stage === 'pending')
      .sort((a, b) => a.enqueuedAtMs - b.enqueuedAtMs)

    // One group per word. interleaveOrderedQuizSlots keeps each word's questions
    // in order (A recognition before original type) AND spaces them ≥ minGap apart,
    // so the same word's two question types never sit adjacent (交叉练习).
    const halfGroups: QuizQuestion[][] = halfActive.map((i) => [
      {
        word: i.entry,
        type: i.originalType,
        revealedHalf: i.originalType === 'C' ? Math.ceil(i.entry.word.length / 2) : undefined,
        rescueRole: 'reinforce-half',
      },
    ])
    const eatenGroups: QuizQuestion[][] = eatenActive.map((it) => [
      { word: it.entry, type: 'A', rescueRole: 'reinforce-step1' },
      { word: it.entry, type: it.originalType, rescueRole: 'reinforce-step2' },
    ])

    const groups = [...halfGroups, ...eatenGroups]
    const practice = groups.length ? interleaveOrderedQuizSlots(groups, seed, 2) : []
    const reviewWords = eatenActive.map((it) => it.entry)

    return { reviewWords, practice }
  }, [items])

  return {
    retryList, eatenList,
    enqueueHalf, enqueueEaten, advance,
    isInQueue, buildBatches, clear,
  }
}
