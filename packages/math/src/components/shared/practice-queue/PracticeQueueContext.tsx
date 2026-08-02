'use client'

import { useCallback, useEffect, useMemo, useRef, useState, createContext, useContext, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useImmersive, STORAGE_KEYS, todayStr, usePracticePendingLifecycle } from '@rosie/core'
import { useMathSolved } from '@rosie/math/hooks/useMathSolved'
import { useMathWrong } from '@rosie/math/hooks/useMathWrong'
import { useMathSkipped } from '@rosie/math/hooks/useMathSkipped'
import type { MathSkipReason } from '@rosie/math/utils/math-skip-reasons'
import {
  buildPracticeQueue,
  initialIndexForProblem,
} from '@rosie/math/utils/build-practice-queue'
import type {
  PracticeQueueItem,
  PracticeQueuePhase,
  PracticeQueueStartOpts,
} from '@rosie/math/utils/practice-queue-types'
import {
  clearMathPendingEverywhere,
  MATH_PENDING_KIND,
  MATH_PENDING_SCOPE,
  readMathPracticeSnapshot,
  writeMathPracticeSnapshot,
  wrapMathEnvelope,
  type MathPracticeQueueItemRef,
  type MathPracticeSnapshot,
} from '@rosie/math/utils/practice-queue-snapshot'
import MathPracticePortal from './MathPracticePortal'

type PracticeQueueContextValue = {
  isActive: boolean
  phase: PracticeQueuePhase
  items: PracticeQueueItem[]
  currentIndex: number
  sessionCorrect: number
  immersive: boolean
  returnHref: string
  title: string
  currentItem: PracticeQueueItem | null
  start: (opts: PracticeQueueStartOpts) => void
  /** Restore a previously snapshotted queue (same-tab mid-exit resume). */
  resume: (opts: {
    items: PracticeQueueItem[]
    currentIndex: number
    sessionCorrect: number
    phase: PracticeQueuePhase
    returnHref: string
    title: string
    immersive: boolean
  }) => void
  /** Read pending snapshot refs without clearing (caller rehydrates Problems). */
  peekPendingSnapshot: () => {
    items: MathPracticeQueueItemRef[]
    currentIndex: number
    sessionCorrect: number
    phase: PracticeQueuePhase
    returnHref: string
    title: string
    immersive: boolean
  } | null
  end: () => void
  /** Flush cloud pending then exit to returnHref (answering phase). */
  stash: () => void
  flushCloudNow: () => Promise<void>
  restart: () => void
  onAnswerCorrect: () => void
  onAnswerWrong: () => void
  /** Advance without marking correct (e.g. after 不会 + review 题解). */
  onAdvance: () => void
  onSkip: (reason: MathSkipReason, note?: string) => void
  setImmersive: (value: boolean) => void
  toggleImmersive: () => void
}

const PracticeQueueContext = createContext<PracticeQueueContextValue | null>(null)

function readImmersivePref(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(STORAGE_KEYS.MATH_PRACTICE_IMMERSIVE) === '1'
}

function writeImmersivePref(value: boolean) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEYS.MATH_PRACTICE_IMMERSIVE, value ? '1' : '0')
}

export function PracticeQueueProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { user } = useAuth()
  const { setIsImmersive } = useImmersive()
  const { solveCount, handleSolve } = useMathSolved(user)
  const { markResolved } = useMathWrong(user)
  const { addSkipped, clearSkipped } = useMathSkipped(user)

  const [isActive, setIsActive] = useState(false)
  const [phase, setPhase] = useState<PracticeQueuePhase>('answering')
  const [items, setItems] = useState<PracticeQueueItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [immersive, setImmersiveState] = useState(false)
  const [returnHref, setReturnHref] = useState('/math')
  const [title, setTitle] = useState('练习')
  const rawPoolRef = useRef<PracticeQueueItem[]>([])
  const startOptsRef = useRef<PracticeQueueStartOpts | null>(null)

  const currentItem = items[currentIndex] ?? null

  const getEnvelope = useCallback(() => {
    if (!isActive || phase !== 'answering' || items.length === 0) return null
    const snap: MathPracticeSnapshot = {
      version: 1,
      date: todayStr(),
      items: items.map((item) => ({
        problemId: item.problem.id,
        lessonId: item.lessonId,
        section: item.section,
        detailHref: item.detailHref,
      })),
      currentIndex,
      sessionCorrect,
      phase: 'answering',
      returnHref,
      title,
      immersive,
    }
    return wrapMathEnvelope(snap)
  }, [isActive, phase, items, currentIndex, sessionCorrect, returnHref, title, immersive])

  const { flushCloudNow } = usePracticePendingLifecycle<MathPracticeSnapshot>({
    enabled: isActive && phase === 'answering',
    userId: user?.id,
    kind: MATH_PENDING_KIND,
    scopeKey: MATH_PENDING_SCOPE,
    getEnvelope,
  })

  const persistSnapshot = useCallback(
    (
      activeItems: PracticeQueueItem[],
      index: number,
      correct: number,
      nextPhase: PracticeQueuePhase,
      href: string,
      sessionTitle: string,
      immersiveMode: boolean,
    ) => {
      if (nextPhase === 'celebration' || activeItems.length === 0) {
        void clearMathPendingEverywhere(user?.id)
        return
      }
      writeMathPracticeSnapshot({
        version: 1,
        date: todayStr(),
        items: activeItems.map((item) => ({
          problemId: item.problem.id,
          lessonId: item.lessonId,
          section: item.section,
          detailHref: item.detailHref,
        })),
        currentIndex: index,
        sessionCorrect: correct,
        phase: nextPhase,
        returnHref: href,
        title: sessionTitle,
        immersive: immersiveMode,
      })
    },
    [user?.id],
  )

  const tearDown = useCallback(() => {
    setIsActive(false)
    setPhase('answering')
    setItems([])
    setCurrentIndex(0)
    setSessionCorrect(0)
    setIsImmersive(false)
    startOptsRef.current = null
    rawPoolRef.current = []
  }, [setIsImmersive])

  const start = useCallback(
    (opts: PracticeQueueStartOpts) => {
      if (!user) return
      const queue = buildPracticeQueue(opts.pool, solveCount)
      if (queue.length === 0) return

      rawPoolRef.current = opts.pool
      startOptsRef.current = opts
      const idx = initialIndexForProblem(queue, opts.initialProblemId)
      const immersivePref = opts.immersive ?? readImmersivePref()

      setItems(queue)
      setCurrentIndex(idx)
      setSessionCorrect(0)
      setPhase('answering')
      setReturnHref(opts.returnHref)
      setTitle(opts.title ?? '练习')
      setImmersiveState(immersivePref)
      setIsActive(true)
      setIsImmersive(true)
      persistSnapshot(queue, idx, 0, 'answering', opts.returnHref, opts.title ?? '练习', immersivePref)
    },
    [user, solveCount, setIsImmersive, persistSnapshot],
  )

  const resume = useCallback(
    (opts: {
      items: PracticeQueueItem[]
      currentIndex: number
      sessionCorrect: number
      phase: PracticeQueuePhase
      returnHref: string
      title: string
      immersive: boolean
    }) => {
      if (!user || opts.items.length === 0) return
      rawPoolRef.current = opts.items
      startOptsRef.current = {
        pool: opts.items,
        returnHref: opts.returnHref,
        title: opts.title,
        immersive: opts.immersive,
      }
      const idx = Math.min(opts.currentIndex, opts.items.length - 1)
      setItems(opts.items)
      setCurrentIndex(idx)
      setSessionCorrect(opts.sessionCorrect)
      setPhase(opts.phase)
      setReturnHref(opts.returnHref)
      setTitle(opts.title)
      setImmersiveState(opts.immersive)
      setIsActive(true)
      setIsImmersive(true)
      persistSnapshot(
        opts.items,
        idx,
        opts.sessionCorrect,
        opts.phase,
        opts.returnHref,
        opts.title,
        opts.immersive,
      )
    },
    [user, setIsImmersive, persistSnapshot],
  )

  const peekPendingSnapshot = useCallback(() => {
    const snap = readMathPracticeSnapshot()
    if (!snap) return null
    return {
      items: snap.items,
      currentIndex: snap.currentIndex,
      sessionCorrect: snap.sessionCorrect,
      phase: snap.phase,
      returnHref: snap.returnHref,
      title: snap.title,
      immersive: snap.immersive,
    }
  }, [])

  const restart = useCallback(() => {
    const opts = startOptsRef.current
    if (!opts) return
    start(opts)
  }, [start])

  const setImmersive = useCallback((value: boolean) => {
    setImmersiveState(value)
    writeImmersivePref(value)
  }, [])

  const toggleImmersive = useCallback(() => {
    setImmersiveState((prev) => {
      const next = !prev
      writeImmersivePref(next)
      return next
    })
  }, [])

  const onAnswerWrong = useCallback(() => {
    // wrong book updated in submitPracticeAttempt
  }, [])

  const onAdvance = useCallback(() => {
    if (currentIndex >= items.length - 1) {
      setPhase('celebration')
      void clearMathPendingEverywhere(user?.id)
      return
    }
    const nextIndex = currentIndex + 1
    setCurrentIndex(nextIndex)
    persistSnapshot(items, nextIndex, sessionCorrect, 'answering', returnHref, title, immersive)
  }, [items, currentIndex, user?.id, sessionCorrect, returnHref, title, immersive, persistSnapshot])

  const onSkip = useCallback(
    (reason: MathSkipReason, note?: string) => {
      const item = items[currentIndex]
      if (!item) return
      addSkipped(item.problem.id, reason, note)
      onAdvance()
    },
    [items, currentIndex, addSkipped, onAdvance],
  )

  const onAnswerCorrect = useCallback(async () => {
    const item = items[currentIndex]
    if (!item) return

    try {
      await handleSolve(item.problem.id)
      void markResolved(item.problem.id)
      clearSkipped(item.problem.id)
    } catch {
      // Sync failure must not block advancing to the next problem.
    }

    const nextCorrect = sessionCorrect + 1
    setSessionCorrect(nextCorrect)

    if (currentIndex >= items.length - 1) {
      setPhase('celebration')
      void clearMathPendingEverywhere(user?.id)
      return
    }
    const nextIndex = currentIndex + 1
    setCurrentIndex(nextIndex)
    persistSnapshot(items, nextIndex, nextCorrect, 'answering', returnHref, title, immersive)
  }, [
    items,
    currentIndex,
    user?.id,
    handleSolve,
    markResolved,
    clearSkipped,
    sessionCorrect,
    returnHref,
    title,
    immersive,
    persistSnapshot,
  ])

  const handleExit = useCallback(() => {
    void (async () => {
      if (isActive && phase === 'answering' && items.length > 0) {
        persistSnapshot(items, currentIndex, sessionCorrect, phase, returnHref, title, immersive)
        await flushCloudNow()
      }
      const href = returnHref
      tearDown()
      router.push(href)
    })()
  }, [
    isActive,
    phase,
    items,
    currentIndex,
    sessionCorrect,
    returnHref,
    title,
    immersive,
    persistSnapshot,
    flushCloudNow,
    tearDown,
    router,
  ])

  const handleStash = useCallback(() => {
    void (async () => {
      if (isActive && phase === 'answering' && items.length > 0) {
        persistSnapshot(items, currentIndex, sessionCorrect, phase, returnHref, title, immersive)
        await flushCloudNow()
      }
      const href = returnHref
      tearDown()
      router.push(href)
    })()
  }, [
    isActive,
    phase,
    items,
    currentIndex,
    sessionCorrect,
    returnHref,
    title,
    immersive,
    persistSnapshot,
    flushCloudNow,
    tearDown,
    router,
  ])

  useEffect(() => {
    if (!isActive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isActive, handleExit])

  const value = useMemo<PracticeQueueContextValue>(
    () => ({
      isActive,
      phase,
      items,
      currentIndex,
      sessionCorrect,
      immersive,
      returnHref,
      title,
      currentItem,
      start,
      resume,
      peekPendingSnapshot,
      end: handleExit,
      stash: handleStash,
      flushCloudNow,
      restart,
      onAnswerCorrect,
      onAnswerWrong,
      onAdvance,
      onSkip,
      setImmersive,
      toggleImmersive,
    }),
    [
      isActive,
      phase,
      items,
      currentIndex,
      sessionCorrect,
      immersive,
      returnHref,
      title,
      currentItem,
      start,
      resume,
      peekPendingSnapshot,
      handleExit,
      handleStash,
      flushCloudNow,
      restart,
      onAnswerCorrect,
      onAnswerWrong,
      onAdvance,
      onSkip,
      setImmersive,
      toggleImmersive,
    ],
  )

  return (
    <PracticeQueueContext.Provider value={value}>
      {children}
      {isActive && user && (
        <MathPracticePortal
          items={items}
          currentIndex={currentIndex}
          phase={phase}
          sessionCorrect={sessionCorrect}
          immersive={immersive}
          title={title}
          returnHref={returnHref}
          onExit={handleExit}
          onStash={handleStash}
          onAnswerCorrect={onAnswerCorrect}
          onAnswerWrong={onAnswerWrong}
          onAdvance={onAdvance}
          onSkip={onSkip}
          onRestart={restart}
          onToggleImmersive={toggleImmersive}
          onSetImmersive={setImmersive}
        />
      )}
    </PracticeQueueContext.Provider>
  )
}

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
