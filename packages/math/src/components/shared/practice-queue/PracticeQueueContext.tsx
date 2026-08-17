'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useImmersive, STORAGE_KEYS, todayStr, usePracticePendingLifecycle } from '@rosie/core'
import { useMathPracticeStats } from '@rosie/math-kit/hooks/useMathPracticeStats'
import { useMathWeeklyPlan } from '@rosie/math-kit/hooks/useMathWeeklyPlan'
import {
  buildPracticeQueue,
  deferQueueItem,
  initialIndexForProblem,
} from '@rosie/math/utils/build-practice-queue'
import type {
  PracticeQueueItem,
  PracticeQueuePhase,
  PracticeQueueStartOpts,
} from '@rosie/math-kit/utils/practice-queue-types'
import {
  clearMathPendingEverywhere,
  MATH_PENDING_KIND,
  MATH_PRACTICE_SNAPSHOT_VERSION,
  mathPendingScope,
  readMathPracticeSnapshot,
  writeMathPracticeSnapshot,
  wrapMathEnvelope,
  type MathPracticeSnapshot,
  type MathPracticeSource,
} from '@rosie/math-kit/utils/practice-queue-snapshot'
import MathPracticePortal from './MathPracticePortal'
import {
  PracticeQueueContext,
  type PracticeQueueContextValue,
  type ResumeOpts,
} from '@rosie/math-kit/components/shared/practice-queue/practice-queue-context'

// Context object + consumer hooks now live in the aggregator-free kit module so
// consumers don't pull in this Provider (which imports build-practice-queue).
export { usePracticeQueue, usePracticeQueueOptional } from '@rosie/math-kit/components/shared/practice-queue/practice-queue-context'
export type { PracticeQueueContextValue }

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
  const { practiceCount, lastAttemptedAt } = useMathPracticeStats(user)
  const { addDoneKey } = useMathWeeklyPlan(user)

  const [isActive, setIsActive] = useState(false)
  const [phase, setPhase] = useState<PracticeQueuePhase>('answering')
  const [items, setItems] = useState<PracticeQueueItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [immersive, setImmersiveState] = useState(false)
  const [source, setSource] = useState<MathPracticeSource | null>(null)
  const [returnHref, setReturnHref] = useState('/math')
  const [title, setTitle] = useState('练习')
  const rawPoolRef = useRef<PracticeQueueItem[]>([])
  const startOptsRef = useRef<PracticeQueueStartOpts | null>(null)
  const sourceRef = useRef<MathPracticeSource | null>(null)
  const [checkRemaining, setCheckRemaining] = useState<PracticeQueueStartOpts['checkRemaining'] | null>(null)
  // Read after awaits, where the render closure's copies are already stale.
  const currentIndexRef = useRef(currentIndex)
  const sessionCorrectRef = useRef(sessionCorrect)
  useEffect(() => {
    currentIndexRef.current = currentIndex
    sessionCorrectRef.current = sessionCorrect
  }, [currentIndex, sessionCorrect])
  useEffect(() => {
    sourceRef.current = source
  }, [source])

  const currentItem = items[currentIndex] ?? null
  const scopeKey = source ? mathPendingScope(source) : ''

  const getEnvelope = useCallback(() => {
    if (!isActive || phase !== 'answering' || items.length === 0 || !source) return null
    const snap: MathPracticeSnapshot = {
      version: MATH_PRACTICE_SNAPSHOT_VERSION,
      source,
      date: todayStr(),
      items: items.map((item) => ({
        problemId: item.problem.id,
        lessonId: item.lessonId,
        section: item.section,
        detailHref: item.detailHref,
        planAssignment: item.planAssignment,
      })),
      currentIndex,
      sessionCorrect,
      phase: 'answering',
      returnHref,
      title,
      immersive,
    }
    return wrapMathEnvelope(snap)
  }, [isActive, phase, items, currentIndex, sessionCorrect, source, returnHref, title, immersive])

  const { flushCloudNow } = usePracticePendingLifecycle<MathPracticeSnapshot>({
    enabled: isActive && phase === 'answering' && Boolean(source),
    userId: user?.id,
    kind: MATH_PENDING_KIND,
    scopeKey,
    getEnvelope,
  })

  const persistSnapshot = useCallback(
    (
      activeItems: PracticeQueueItem[],
      index: number,
      correct: number,
      nextPhase: PracticeQueuePhase,
      practiceSource: MathPracticeSource,
      href: string,
      sessionTitle: string,
      immersiveMode: boolean,
    ) => {
      if (nextPhase === 'celebration' || activeItems.length === 0) {
        void clearMathPendingEverywhere(user?.id, practiceSource)
        return
      }
      writeMathPracticeSnapshot({
        version: MATH_PRACTICE_SNAPSHOT_VERSION,
        source: practiceSource,
        date: todayStr(),
        items: activeItems.map((item) => ({
          problemId: item.problem.id,
          lessonId: item.lessonId,
          section: item.section,
          detailHref: item.detailHref,
          planAssignment: item.planAssignment,
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
    setSource(null)
    setIsImmersive(false)
    startOptsRef.current = null
    rawPoolRef.current = []
    setCheckRemaining(null)
  }, [setIsImmersive])

  const start = useCallback(
    (opts: PracticeQueueStartOpts) => {
      if (!user) return
      const queue = buildPracticeQueue(
        opts.pool,
        practiceCount,
        lastAttemptedAt,
        opts.preserveOrder,
      )
      if (queue.length === 0) return

      rawPoolRef.current = opts.pool
      startOptsRef.current = opts
      setCheckRemaining(opts.checkRemaining ?? null)
      const idx = initialIndexForProblem(queue, opts.initialProblemId)
      const immersivePref = opts.immersive ?? readImmersivePref()

      setItems(queue)
      setCurrentIndex(idx)
      setSessionCorrect(0)
      setPhase('answering')
      setSource(opts.source)
      setReturnHref(opts.returnHref)
      setTitle(opts.title ?? '练习')
      setImmersiveState(immersivePref)
      setIsActive(true)
      setIsImmersive(true)
      persistSnapshot(
        queue,
        idx,
        0,
        'answering',
        opts.source,
        opts.returnHref,
        opts.title ?? '练习',
        immersivePref,
      )
    },
    [user, practiceCount, lastAttemptedAt, setIsImmersive, persistSnapshot],
  )

  const resume = useCallback(
    (opts: ResumeOpts) => {
      if (!user || opts.items.length === 0) return
      rawPoolRef.current = opts.items
      setCheckRemaining(opts.checkRemaining ?? null)
      startOptsRef.current = {
        pool: opts.items,
        source: opts.source,
        returnHref: opts.returnHref,
        title: opts.title,
        immersive: opts.immersive,
      }
      const idx = Math.min(opts.currentIndex, opts.items.length - 1)
      setItems(opts.items)
      setCurrentIndex(idx)
      setSessionCorrect(opts.sessionCorrect)
      setPhase(opts.phase)
      setSource(opts.source)
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
        opts.source,
        opts.returnHref,
        opts.title,
        opts.immersive,
      )
    },
    [user, setIsImmersive, persistSnapshot],
  )

  const peekPendingSnapshot = useCallback((practiceSource: MathPracticeSource) => {
    const snap = readMathPracticeSnapshot(practiceSource)
    if (!snap) return null
    return {
      items: snap.items,
      currentIndex: snap.currentIndex,
      sessionCorrect: snap.sessionCorrect,
      phase: snap.phase,
      source: snap.source,
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
    const practiceSource = sourceRef.current
    if (!practiceSource) return
    if (currentIndex >= items.length - 1) {
      setPhase('celebration')
      void clearMathPendingEverywhere(user?.id, practiceSource)
      return
    }
    const nextIndex = currentIndex + 1
    setCurrentIndex(nextIndex)
    persistSnapshot(
      items,
      nextIndex,
      sessionCorrect,
      'answering',
      practiceSource,
      returnHref,
      title,
      immersive,
    )
  }, [items, currentIndex, user?.id, sessionCorrect, returnHref, title, immersive, persistSnapshot])

  const onDeferCurrent = useCallback((): 'moved' | 'only_remaining' => {
    const practiceSource = sourceRef.current
    if (!practiceSource || !items[currentIndex]) return 'only_remaining'
    const deferred = deferQueueItem(items, currentIndex)
    if (deferred.result === 'only_remaining') {
      persistSnapshot(
        items,
        currentIndex,
        sessionCorrect,
        'answering',
        practiceSource,
        returnHref,
        title,
        immersive,
      )
      return deferred.result
    }
    const nextItems = deferred.items
    setItems(nextItems)
    persistSnapshot(
      nextItems,
      currentIndex,
      sessionCorrect,
      'answering',
      practiceSource,
      returnHref,
      title,
      immersive,
    )
    return deferred.result
  }, [items, currentIndex, sessionCorrect, returnHref, title, immersive, persistSnapshot])

  const onAnswerCorrect = useCallback(async () => {
    const item = items[currentIndex]
    const practiceSource = sourceRef.current
    if (!item || !practiceSource) return
    // Index/score are captured before an await, so anything that advanced the queue
    // meanwhile (跳过, a second submit) would be silently rolled back. Bail instead.
    const indexAtEntry = currentIndex

    try {
      if (item.planAssignment) {
        await addDoneKey(
          item.planAssignment.planStart,
          item.planAssignment.date,
          item.planAssignment.assignmentId,
        )
      }
    } catch {
      // Sync failure must not block advancing to the next problem.
    }

    if (currentIndexRef.current !== indexAtEntry) return

    const nextCorrect = sessionCorrectRef.current + 1
    setSessionCorrect(nextCorrect)

    if (indexAtEntry >= items.length - 1) {
      setPhase('celebration')
      void clearMathPendingEverywhere(user?.id, practiceSource)
      return
    }
    const nextIndex = indexAtEntry + 1
    setCurrentIndex(nextIndex)
    persistSnapshot(
      items,
      nextIndex,
      nextCorrect,
      'answering',
      practiceSource,
      returnHref,
      title,
      immersive,
    )
  }, [
    items,
    currentIndex,
    user?.id,
    addDoneKey,
    returnHref,
    title,
    immersive,
    persistSnapshot,
  ])

  /**
   * Exit and 暂存 behave identically: snapshot, best-effort cloud push, leave.
   * `flushCloudNow` never rejects, so a network failure can't strand the child here.
   */
  const handleExit = useCallback(() => {
    void (async () => {
      const practiceSource = sourceRef.current
      if (isActive && phase === 'answering' && items.length > 0 && practiceSource) {
        persistSnapshot(
          items,
          currentIndex,
          sessionCorrect,
          phase,
          practiceSource,
          returnHref,
          title,
          immersive,
        )
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
      source,
      returnHref,
      title,
      currentItem,
      start,
      resume,
      peekPendingSnapshot,
      end: handleExit,
      stash: handleExit,
      flushCloudNow,
      restart,
      onAnswerCorrect,
      onAnswerWrong,
      onAdvance,
      onDeferCurrent,
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
      source,
      returnHref,
      title,
      currentItem,
      start,
      resume,
      peekPendingSnapshot,
      handleExit,
      flushCloudNow,
      restart,
      onAnswerCorrect,
      onAnswerWrong,
      onAdvance,
      onDeferCurrent,
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
          onStash={handleExit}
          onAnswerCorrect={onAnswerCorrect}
          onAnswerWrong={onAnswerWrong}
          onAdvance={onAdvance}
          onDeferCurrent={onDeferCurrent}
          onRestart={restart}
          onToggleImmersive={toggleImmersive}
          onSetImmersive={setImmersive}
          checkRemaining={checkRemaining ?? undefined}
        />
      )}
    </PracticeQueueContext.Provider>
  )
}
