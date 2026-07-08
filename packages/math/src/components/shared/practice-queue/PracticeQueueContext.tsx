'use client'

import { useCallback, useEffect, useMemo, useRef, useState, createContext, useContext, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useImmersive, STORAGE_KEYS } from '@rosie/core'
import { useMathSolved } from '@rosie/math/hooks/useMathSolved'
import { useMathWrong } from '@rosie/math/hooks/useMathWrong'
import {
  buildPracticeQueue,
  initialIndexForProblem,
} from '@rosie/math/utils/build-practice-queue'
import type {
  PracticeQueueItem,
  PracticeQueuePhase,
  PracticeQueueStartOpts,
} from '@rosie/math/utils/practice-queue-types'
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
  end: () => void
  restart: () => void
  onAnswerCorrect: () => void
  onAnswerWrong: () => void
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

  const end = useCallback(() => {
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
    },
    [user, solveCount, setIsImmersive],
  )

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

  const onAnswerCorrect = useCallback(async () => {
    const item = items[currentIndex]
    if (!item) return

    try {
      await handleSolve(item.problem.id)
      void markResolved(item.problem.id)
    } catch {
      // Sync failure must not block advancing to the next problem.
    }

    setSessionCorrect((n) => n + 1)

    if (currentIndex >= items.length - 1) {
      setPhase('celebration')
      return
    }
    setCurrentIndex((i) => i + 1)
  }, [items, currentIndex, handleSolve, markResolved])

  const handleExit = useCallback(() => {
    const href = returnHref
    end()
    router.push(href)
  }, [end, router, returnHref])

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
      end: handleExit,
      restart,
      onAnswerCorrect,
      onAnswerWrong,
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
      handleExit,
      restart,
      onAnswerCorrect,
      onAnswerWrong,
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
          onAnswerCorrect={onAnswerCorrect}
          onAnswerWrong={onAnswerWrong}
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
