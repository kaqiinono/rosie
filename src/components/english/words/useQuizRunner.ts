'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { QuizQuestion } from '@/utils/type'

export type QuizAttempt = 'first' | 'retry' | 'done'

export interface QuizCommitInfo {
  finalCorrect: boolean
  usedRetry: boolean
}

export interface QuizRunnerOptions {
  question: QuizQuestion | null
  /** 单次最终结论（含 retry/补练）回传给 session */
  onCommit: (info: QuizCommitInfo) => void
  /** 用户按"下一题"或自动 advance 时调用 */
  onAdvance: () => void
  /** 答对自动 advance 间隔 */
  autoAdvanceMs?: number
  /** 此题是否允许 retry（默认 true；闪现卡等 rescueRole 应传 false） */
  allowRetry?: boolean
}

export interface QuizRunnerState {
  attempt: QuizAttempt
  answered: boolean
  selected: string | null
  spellOk: boolean | null
  wasCorrect: boolean | null
  /** 用户已尝试过的错选项集合，用于在 UI 上置灰 */
  wrongChoices: Set<string>
  showPassageHint: boolean
  openPassageHint: () => void
  closePassageHint: () => void
  showHelp: boolean
  openHelp: () => void
  closeHelp: () => void
  handleMCAnswer: (chosen: string) => void
  handleSpellSubmit: (val: string) => void
  /** SpellTiles 调；reset 输入区给第二次拼 */
  acknowledgeSpellRetry: () => void
  requestAdvance: () => void
}

export function useQuizRunner({
  question,
  onCommit,
  onAdvance,
  autoAdvanceMs = 600,
  allowRetry = true,
}: QuizRunnerOptions): QuizRunnerState {
  const [attempt, setAttempt] = useState<QuizAttempt>('first')
  const [selected, setSelected] = useState<string | null>(null)
  const [spellOk, setSpellOk] = useState<boolean | null>(null)
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null)
  const [wrongChoices, setWrongChoices] = useState<Set<string>>(new Set())
  const [showPassageHint, setShowPassageHint] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const [prevQuestion, setPrevQuestion] = useState(question)
  if (prevQuestion !== question) {
    setPrevQuestion(question)
    setAttempt('first')
    setSelected(null)
    setSpellOk(null)
    setWasCorrect(null)
    setWrongChoices(new Set())
    setShowPassageHint(false)
    setShowHelp(false)
  }

  const onCommitRef = useRef(onCommit)
  const onAdvanceRef = useRef(onAdvance)
  useEffect(() => {
    onCommitRef.current = onCommit
  }, [onCommit])
  useEffect(() => {
    onAdvanceRef.current = onAdvance
  }, [onAdvance])

  const answered = attempt === 'done'

  useEffect(() => {
    if (answered && wasCorrect === true) {
      const t = setTimeout(() => onAdvanceRef.current(), autoAdvanceMs)
      return () => clearTimeout(t)
    }
  }, [answered, wasCorrect, autoAdvanceMs])

  const finish = useCallback((finalCorrect: boolean, usedRetry: boolean) => {
    setAttempt('done')
    setWasCorrect(finalCorrect)
    onCommitRef.current({ finalCorrect, usedRetry })
  }, [])

  const handleMCAnswer = useCallback(
    (chosen: string) => {
      if (!question || attempt === 'done') return
      const correct = chosen === question.word.word
      setSelected(chosen)
      if (correct) {
        finish(true, attempt === 'retry')
        return
      }
      if (attempt === 'first' && allowRetry) {
        setWrongChoices((s) => new Set(s).add(chosen))
        setAttempt('retry')
        return
      }
      setWrongChoices((s) => new Set(s).add(chosen))
      finish(false, attempt === 'retry' || !allowRetry)
    },
    [attempt, question, allowRetry, finish],
  )

  const handleSpellSubmit = useCallback(
    (val: string) => {
      if (!question || attempt === 'done') return
      const correct = val.trim().toLowerCase() === question.word.word.toLowerCase()
      setSpellOk(correct)
      if (correct) {
        finish(true, attempt === 'retry')
        return
      }
      if (attempt === 'first' && allowRetry) {
        setAttempt('retry')
        return
      }
      finish(false, attempt === 'retry' || !allowRetry)
    },
    [attempt, question, allowRetry, finish],
  )

  const acknowledgeSpellRetry = useCallback(() => {
    setSpellOk(null)
  }, [])

  const requestAdvance = useCallback(() => {
    onAdvanceRef.current()
  }, [])

  const openPassageHint = useCallback(() => setShowPassageHint(true), [])
  const closePassageHint = useCallback(() => setShowPassageHint(false), [])
  const openHelp = useCallback(() => setShowHelp(true), [])
  const closeHelp = useCallback(() => setShowHelp(false), [])

  return {
    attempt,
    answered,
    selected,
    spellOk,
    wasCorrect,
    wrongChoices,
    showPassageHint,
    openPassageHint,
    closePassageHint,
    showHelp,
    openHelp,
    closeHelp,
    handleMCAnswer,
    handleSpellSubmit,
    acknowledgeSpellRetry,
    requestAdvance,
  }
}
