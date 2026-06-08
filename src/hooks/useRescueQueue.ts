'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import type {
  QuizQuestion,
  RescueQueueItem,
  WordEntry,
  QuizType,
} from '@/utils/type'
import { interleaveOrderedQuizSlots } from '@/utils/english-helpers'
import { MONSTERS } from '@/components/english/words/monsters'

export interface RescueBatches {
  /** 主轮中段穿插：半对词同题型补练 1 次 */
  halfBatch: QuizQuestion[]
  /** 主轮末尾追加：被吃词阶梯补练 = flashcard + A + 原题型 */
  eatenBatch: QuizQuestion[]
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

export function useRescueQueue(): UseRescueQueueApi {
  const [items, setItems] = useState<RescueQueueItem[]>([])
  const seqRef = useRef(0)

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

  const clear = useCallback(() => setItems([]), [])

  const retryList = useMemo(
    () => items.filter((i) => i.severity === 'half'),
    [items],
  )
  const eatenList = useMemo(
    () => items.filter((i) => i.severity === 'eaten'),
    [items],
  )

  const buildBatches = useCallback((seed: number): RescueBatches => {
    // halfBatch: each still-pending half word -> 1 question, original type
    const halfActive = items.filter(
      (i) => i.severity === 'half' && i.stage === 'pending',
    )
    const halfGroups: QuizQuestion[][] = halfActive.map((i) => [{
      word: i.entry,
      type: i.originalType,
      revealedHalf: i.originalType === 'C' ? Math.ceil(i.entry.word.length / 2) : undefined,
      rescueRole: 'reinforce-half',
    }])
    const halfBatch = halfGroups.length
      ? interleaveOrderedQuizSlots(halfGroups, seed, 3)
      : []

    // eatenBatch: ordered by enqueuedAtMs, each word -> 3 steps (flashcard + A + originalType)
    const eatenActive = items
      .filter((i) => i.severity === 'eaten' && i.stage === 'pending')
      .sort((a, b) => a.enqueuedAtMs - b.enqueuedAtMs)
    const eatenBatch: QuizQuestion[] = []
    for (const it of eatenActive) {
      eatenBatch.push({ word: it.entry, type: 'A', rescueRole: 'flashcard' })
      eatenBatch.push({ word: it.entry, type: 'A', rescueRole: 'reinforce-step1' })
      eatenBatch.push({
        word: it.entry,
        type: it.originalType,
        rescueRole: 'reinforce-step2',
      })
    }

    return { halfBatch, eatenBatch }
  }, [items])

  return {
    retryList, eatenList,
    enqueueHalf, enqueueEaten, advance,
    isInQueue, buildBatches, clear,
  }
}
