'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { QuizQuestion } from '@/utils/type'

export interface QuizRunnerOptions {
  question: QuizQuestion | null
  onCommit: (correct: boolean) => void
  onAdvance: () => void
  autoAdvanceMs?: number
}

export interface QuizRunnerState {
  answered: boolean
  selected: string | null
  spellOk: boolean | null
  wasCorrect: boolean | null
  showPassageHint: boolean
  openPassageHint: () => void
  closePassageHint: () => void
  showHelp: boolean
  openHelp: () => void
  closeHelp: () => void
  handleMCAnswer: (chosen: string) => void
  handleSpellSubmit: (val: string) => void
  requestAdvance: () => void
}

export function useQuizRunner({
  question,
  onCommit,
  onAdvance,
  autoAdvanceMs = 600,
}: QuizRunnerOptions): QuizRunnerState {
  const [answered, setAnswered] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [spellOk, setSpellOk] = useState<boolean | null>(null)
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null)
  const [showPassageHint, setShowPassageHint] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const [prevQuestion, setPrevQuestion] = useState(question)
  if (prevQuestion !== question) {
    setPrevQuestion(question)
    setAnswered(false)
    setSelected(null)
    setSpellOk(null)
    setWasCorrect(null)
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

  useEffect(() => {
    if (answered && wasCorrect === true) {
      const t = setTimeout(() => onAdvanceRef.current(), autoAdvanceMs)
      return () => clearTimeout(t)
    }
  }, [answered, wasCorrect, autoAdvanceMs])

  const handleMCAnswer = useCallback(
    (chosen: string) => {
      if (answered || !question) return
      const correct = chosen === question.word.word
      setAnswered(true)
      setSelected(chosen)
      setWasCorrect(correct)
      onCommitRef.current(correct)
    },
    [answered, question],
  )

  const handleSpellSubmit = useCallback(
    (val: string) => {
      if (answered || !question) return
      const correct = val.trim().toLowerCase() === question.word.word.toLowerCase()
      setAnswered(true)
      setSpellOk(correct)
      setWasCorrect(correct)
      onCommitRef.current(correct)
    },
    [answered, question],
  )

  const requestAdvance = useCallback(() => {
    onAdvanceRef.current()
  }, [])

  const openPassageHint = useCallback(() => setShowPassageHint(true), [])
  const closePassageHint = useCallback(() => setShowPassageHint(false), [])
  const openHelp = useCallback(() => setShowHelp(true), [])
  const closeHelp = useCallback(() => setShowHelp(false), [])

  return {
    answered,
    selected,
    spellOk,
    wasCorrect,
    showPassageHint,
    openPassageHint,
    closePassageHint,
    showHelp,
    openHelp,
    closeHelp,
    handleMCAnswer,
    handleSpellSubmit,
    requestAdvance,
  }
}
