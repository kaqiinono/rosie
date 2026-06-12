'use client'

/**
 * Shared answering-loop logic for any calc practice surface.
 * Handles: question progression, input, attempts, streak, star accumulation, per-question timing.
 * Callers supply questions + soundEnabled + per-question time limit; callers own persistence.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { playSfx } from '@/components/calc/audio'
import { checkAnswer } from '@/utils/calc-answer'
import type { CalcQuestion } from '@/utils/type'

export interface QuestionResult {
  /** Stars awarded (0 when second-attempt correct or wrong) */
  stars: number
  /** Streak bonus included in `stars` */
  bonus: number
  firstTry: boolean
  finallyCorrect: boolean
  signature: string
  /** Time spent on this question from display to first submission, in ms. */
  timeMs: number
  /** Whether the first attempt landed within the configured time limit. */
  withinLimit: boolean
}

export type SessionFeedback = 'correct' | 'retry' | 'wrong' | null

export interface UseCalcSessionReturn {
  idx: number
  currentQ: CalcQuestion | null
  input: string
  setInput: (v: string) => void
  feedback: SessionFeedback
  streak: number
  maxStreak: number
  starsTotal: number
  lastResult: { stars: number; bonus: number } | null
  done: boolean
  progress: number
  results: QuestionResult[]
  handleSubmit: () => void
}

export interface UseCalcSessionOptions {
  /** Returns the time limit in ms for a given question. If omitted, withinLimit is always true. */
  getTimeLimitMs?: (q: CalcQuestion) => number
}

export function useCalcSession(
  questions: CalcQuestion[],
  soundEnabled: boolean,
  onDone?: () => void,
  options?: UseCalcSessionOptions,
): UseCalcSessionReturn {
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState('')
  const [attemptsForCurrent, setAttemptsForCurrent] = useState(0)
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)
  const [starsTotal, setStarsTotal] = useState(0)
  const [feedback, setFeedback] = useState<SessionFeedback>(null)
  const [lastResult, setLastResult] = useState<{ stars: number; bonus: number } | null>(null)
  const [done, setDone] = useState(false)
  const [results, setResults] = useState<QuestionResult[]>([])
  const questionStartRef = useRef<number>(0)
  const firstAttemptTimeRef = useRef<number | null>(null)

  const currentQ = questions[idx] ?? null
  const progress = questions.length > 0 ? Math.round((idx / questions.length) * 100) : 0

  // Reset the question-start timestamp whenever the current question changes.
  useEffect(() => {
    if (currentQ && attemptsForCurrent === 0) {
      questionStartRef.current = performance.now()
      firstAttemptTimeRef.current = null
    }
  }, [currentQ, attemptsForCurrent])

  const advance = useCallback(() => {
    setFeedback(null)
    setInput('')
    setAttemptsForCurrent(0)
    if (idx + 1 >= questions.length) {
      setDone(true)
      onDone?.()
    } else {
      setIdx((i) => i + 1)
      setLastResult(null)
    }
  }, [idx, questions.length, onDone])

  const handleSubmit = useCallback(() => {
    if (!currentQ || done || feedback) return
    const val = Number(input)
    if (!Number.isFinite(val) || input === '') return

    const now = performance.now()
    if (firstAttemptTimeRef.current === null) firstAttemptTimeRef.current = now
    const elapsed = Math.round(firstAttemptTimeRef.current - questionStartRef.current)
    const limit = options?.getTimeLimitMs?.(currentQ)
    const withinLimit = typeof limit === 'number' && limit > 0 ? elapsed <= limit : true

    if (checkAnswer(input, currentQ.answer)) {
      const isFirst = attemptsForCurrent === 0
      const bonus = streak >= 10 ? 2 : streak >= 5 ? 1 : 0
      const stars = isFirst ? currentQ.coinBase + bonus : 0

      if (isFirst) {
        setStarsTotal((t) => t + stars)
        const next = streak + 1
        setStreak(next)
        setMaxStreak((m) => Math.max(m, next))
        setLastResult({ stars, bonus })
      }

      setResults((prev) => [
        ...prev,
        {
          stars,
          bonus: isFirst ? bonus : 0,
          firstTry: isFirst,
          finallyCorrect: true,
          signature: currentQ.signature,
          timeMs: elapsed,
          withinLimit: isFirst ? withinLimit : false,
        },
      ])

      setFeedback('correct')
      playSfx('correct', soundEnabled)
      window.setTimeout(advance, 700)
    } else if (attemptsForCurrent === 0) {
      setFeedback('retry')
      setStreak(0)
      playSfx('retry', soundEnabled)
      window.setTimeout(() => {
        setFeedback(null)
        setInput('')
        setAttemptsForCurrent(1)
      }, 700)
    } else {
      setFeedback('wrong')
      setStreak(0)
      playSfx('wrong', soundEnabled)
      setResults((prev) => [
        ...prev,
        {
          stars: 0,
          bonus: 0,
          firstTry: false,
          finallyCorrect: false,
          signature: currentQ.signature,
          timeMs: elapsed,
          withinLimit: false,
        },
      ])
      window.setTimeout(advance, 1200)
    }
  }, [currentQ, done, feedback, input, attemptsForCurrent, streak, advance, soundEnabled, options])

  return {
    idx,
    currentQ,
    input,
    setInput,
    feedback,
    streak,
    maxStreak,
    starsTotal,
    lastResult,
    done,
    progress,
    results,
    handleSubmit,
  }
}
