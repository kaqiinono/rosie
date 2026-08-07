// Clean context definition + consumer hooks for the math practice queue,
// split out of PracticeQueueContext.tsx so that consumers (FilterPanel,
// useStartPracticeQueue, ...) do NOT depend on the heavy Provider, which imports
// build-practice-queue (content-dependent). This file imports only React + kit
// types, so it lives in @rosie/math-kit. The Provider stays in @rosie/math and
// imports the context object + types from here.

import { createContext, useContext } from 'react'
import type {
  PracticeQueueItem,
  PracticeQueuePhase,
  PracticeQueueStartOpts,
} from '@rosie/math-kit/utils/practice-queue-types'
import type {
  MathPracticeQueueItemRef,
  MathPracticeSource,
} from '@rosie/math-kit/utils/practice-queue-snapshot'
import type { MathSkipReason } from '@rosie/math-kit/utils/math-skip-reasons'

export type ResumeOpts = {
  items: PracticeQueueItem[]
  currentIndex: number
  sessionCorrect: number
  phase: PracticeQueuePhase
  source: MathPracticeSource
  returnHref: string
  title: string
  immersive: boolean
  checkRemaining?: PracticeQueueStartOpts['checkRemaining']
}

export type PracticeQueueContextValue = {
  isActive: boolean
  phase: PracticeQueuePhase
  items: PracticeQueueItem[]
  currentIndex: number
  sessionCorrect: number
  immersive: boolean
  source: MathPracticeSource | null
  returnHref: string
  title: string
  currentItem: PracticeQueueItem | null
  start: (opts: PracticeQueueStartOpts) => void
  /** Restore a previously snapshotted queue (same-tab mid-exit resume). */
  resume: (opts: ResumeOpts) => void
  /** Read pending snapshot refs without clearing (caller rehydrates Problems). */
  peekPendingSnapshot: (source: MathPracticeSource) => {
    items: MathPracticeQueueItemRef[]
    currentIndex: number
    sessionCorrect: number
    phase: PracticeQueuePhase
    source: MathPracticeSource
    returnHref: string
    title: string
    immersive: boolean
  } | null
  end: () => void
  /** Flush cloud pending then exit to returnHref (answering phase). */
  stash: () => void
  flushCloudNow: () => Promise<boolean>
  restart: () => void
  onAnswerCorrect: () => void
  onAnswerWrong: () => void
  /** Advance without marking correct (e.g. after 不会 + review 题解). */
  onAdvance: () => void
  onSkip: (reason: MathSkipReason, note?: string) => void
  setImmersive: (value: boolean) => void
  toggleImmersive: () => void
}

export const PracticeQueueContext = createContext<PracticeQueueContextValue | null>(null)

export function usePracticeQueue(): PracticeQueueContextValue {
  const ctx = useContext(PracticeQueueContext)
  if (!ctx) {
    throw new Error('usePracticeQueue must be used within PracticeQueueProvider')
  }
  return ctx
}

export function usePracticeQueueOptional(): PracticeQueueContextValue | null {
  return useContext(PracticeQueueContext)
}
