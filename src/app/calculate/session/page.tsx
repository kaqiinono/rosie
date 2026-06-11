'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useCalculateSettings } from '@/hooks/useCalculateSettings'
import { useCalculateLevelState } from '@/hooks/useCalculateLevelState'
import { generateQuestions, generateDailySession, generateMistakesSession } from '@/utils/calculate-generator'
import { supabase } from '@/lib/supabase'
import { scoreQuestion, isTierPassed } from '@/utils/calculate-scoring'
import { updateTheta } from '@/utils/calculate-irt'
import { detectErrorTag, diagnoseBlank } from '@/utils/calculate-mastery'
import { saveSessionRecord, saveMistakeRecords, updateMistakeProgress } from '@/utils/calculate-persist'
import { TIER_CONFIG, getTreeForLevel } from '@/utils/calculate-trees'
import type { CalculateQuestion, LevelId, Tier, QuestionResult } from '@/utils/calculate-types'
import NumberPad from '@/components/calculate/NumberPad'
import ChoiceGrid from '@/components/calculate/ChoiceGrid'
import VerticalCalc from '@/components/calculate/VerticalCalc'
import NumberLine from '@/components/calculate/NumberLine'
import FractionVis from '@/components/calculate/FractionVis'
import StepSolve from '@/components/calculate/StepSolve'
import EquationFill from '@/components/calculate/EquationFill'
import DivisionVertical from '@/components/calculate/DivisionVertical'
import QuestionDisplay from '@/components/calculate/QuestionDisplay'
import FeedbackOverlay from '@/components/calculate/FeedbackOverlay'
import StreakIndicator from '@/components/calculate/StreakIndicator'
import CircularTimer from '@/components/calculate/CircularTimer'
import SessionSummary from '@/components/calculate/SessionSummary'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Phase = 'answering' | 'feedback' | 'summary'

function parseFraction(s: string): number | null {
  const m = s.match(/^(-?\d+)\/(-?\d+)$/)
  if (m) {
    const den = parseInt(m[2])
    if (den === 0) return null
    return parseInt(m[1]) / den
  }
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function isAnswerCorrect(userAnswer: string, correctAnswer: string): boolean {
  if (userAnswer === correctAnswer) return true
  const u = parseFraction(userAnswer)
  const c = parseFraction(correctAnswer)
  if (u === null || c === null) return false
  return Math.abs(u - c) < 1e-6
}

function isWithinTolerance(userAnswer: string, correctAnswer: string, tolerance: number): boolean {
  const u = parseFraction(userAnswer)
  const c = parseFraction(correctAnswer)
  if (u === null || c === null) return false
  if (c === 0) return Math.abs(u) <= tolerance
  return Math.abs(u - c) / Math.abs(c) <= tolerance
}

export default function SessionPage() {
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') ?? 'level'
  const levelId = searchParams.get('level') as LevelId | null
  const tier = (searchParams.get('tier') ?? 'beginner') as Tier

  const { user } = useAuth()
  const { settings, update: updateSettings } = useCalculateSettings(user)
  const { updateTier } = useCalculateLevelState(user)

  const [currentIdx, setCurrentIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('answering')
  const [inputValue, setInputValue] = useState('')
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)
  const [results, setResults] = useState<QuestionResult[]>([])
  const [totalStars, setTotalStars] = useState(0)
  const [lastStars, setLastStars] = useState(0)
  const [lastMultiplier, setLastMultiplier] = useState(1)
  const sessionStartRef = useRef('')
  const [elapsedSec, setElapsedSec] = useState(0)
  const thetaRef = useRef(0.4)
  const persistedRef = useRef(false)
  const [consecutiveWrong, setConsecutiveWrong] = useState(0)
  const [showEncouragement, setShowEncouragement] = useState(false)

  const timerTotal = 8000
  const [timerRemaining, setTimerRemaining] = useState(8000)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const treeId = useMemo(
    () => (levelId ? getTreeForLevel(levelId)?.id : undefined),
    [levelId],
  )

  const theta = useMemo(
    () => (treeId ? (settings.thetaPerTree[treeId] ?? 0.4) : 0.4),
    [treeId, settings.thetaPerTree],
  )

  useEffect(() => {
    thetaRef.current = theta
  }, [theta])

  const syncQuestions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    if (mode === 'daily') {
      return generateDailySession(settings.unlockedLevels, theta, settings.dailyTarget, [], today)
    }
    if (mode === 'level' && levelId) {
      const cfg = TIER_CONFIG[tier]
      return generateQuestions({
        levelId,
        theta,
        count: cfg.questionCount,
        topicStates: [],
        today,
        tier,
      })
    }
    return null
  }, [mode, levelId, tier, theta, settings.unlockedLevels, settings.dailyTarget])

  const [mistakeQuestions, setMistakeQuestions] = useState<CalculateQuestion[] | null>(null)

  useEffect(() => {
    if (mode !== 'mistakes' || !user) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('calculate_mistakes')
        .select('level_id')
        .eq('user_id', user.id)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(30)
      if (cancelled) return
      const levelIds = (data ?? []).map((r) => r.level_id as LevelId)
      setMistakeQuestions(generateMistakesSession(levelIds, theta, 15))
    })()
    return () => {
      cancelled = true
    }
  }, [mode, user, theta])

  const questions = useMemo(
    () => (mode === 'mistakes' ? (mistakeQuestions ?? []) : (syncQuestions ?? [])),
    [mode, mistakeQuestions, syncQuestions],
  )

  useEffect(() => {
    sessionStartRef.current = new Date().toISOString()
  }, [])

  useEffect(() => {
    if (phase !== 'answering') return
    let remaining = timerTotal
    const id = setInterval(() => {
      remaining -= 100
      if (remaining <= 0) {
        remaining = 0
        clearInterval(id)
      }
      setTimerRemaining(remaining)
    }, 100)
    timerRef.current = id
    return () => {
      clearInterval(id)
      setTimerRemaining(timerTotal)
    }
  }, [phase, currentIdx])

  const currentQ = questions[currentIdx]
  const isChoice = currentQ?.type === 'choice'
  const isVertical = currentQ?.type === 'vertical'
  const isNumberLine = currentQ?.type === 'number_line'
  const isStepSolve = currentQ?.type === 'step_solve' || (currentQ?.steps?.length ?? 0) > 0
  const isEquationFill = currentQ?.type === 'equation_fill'
  const isDivisionVertical = isVertical && currentQ?.display?.includes('÷') === true
  const isFractionVis =
    currentQ?.type === 'fraction_vis' ||
    (!isChoice && !isStepSolve && currentQ?.answer?.includes('/') === true)

  const verticalParams = useMemo(() => {
    if (!currentQ || currentQ.type !== 'vertical') return null
    const m = currentQ.display.match(/^(\d+)\s*([+\-×])\s*(\d+)/)
    if (!m) return null
    return { a: parseInt(m[1]), b: parseInt(m[3]), op: m[2] as '+' | '-' | '×' }
  }, [currentQ])

  const divisionParams = useMemo(() => {
    if (!currentQ || !currentQ.display.includes('÷')) return null
    const m = currentQ.display.match(/^(\d+)\s*÷\s*(\d+)/)
    if (!m) return null
    return { dividend: parseInt(m[1]), divisor: parseInt(m[2]) }
  }, [currentQ])

  const equationFillParams = useMemo(() => {
    if (!currentQ || currentQ.type !== 'equation_fill') return null
    const template = currentQ.display.replace(/\s*=\s*\?\s*$/, '')
    const hasOpHole = /\d+\s*\?\s*\d+/.test(currentQ.display)
    return {
      template: currentQ.display,
      answer: currentQ.answer,
      kind: hasOpHole ? ('operator' as const) : ('number' as const),
    }
  }, [currentQ])

  const numberLineParams = useMemo(() => {
    if (!currentQ || currentQ.type !== 'number_line') return null
    const rangeMatch = currentQ.display.match(/在\s*(-?\d+(?:\.\d+)?)~(-?\d+(?:\.\d+)?)/)
    const targetNum = parseFloat(currentQ.answer)
    if (!rangeMatch || isNaN(targetNum)) return null
    const min = parseFloat(rangeMatch[1])
    const max = parseFloat(rangeMatch[2])
    const range = max - min
    const step = range >= 20 ? 5 : range >= 10 ? 2 : 1
    return { min, max, step, target: targetNum }
  }, [currentQ])

  const fractionVisParams = useMemo(() => {
    if (!currentQ) return null
    if (currentQ.type !== 'fraction_vis' && !currentQ.answer.includes('/')) return null
    const matches = Array.from(currentQ.display.matchAll(/(\d+)\/(\d+)/g))
    if (matches.length < 1) return null
    const operands = matches.map((m) => ({ num: parseInt(m[1]), den: parseInt(m[2]) }))
    const opMatch = currentQ.display.match(/[+\−\-×÷]/)
    const op = (opMatch?.[0] ?? '+') as '+' | '−' | '-' | '×' | '÷'
    return { operands, op }
  }, [currentQ])

  const handleAnswer = useCallback(
    (answer: string) => {
      if (!currentQ || phase !== 'answering') return
      if (timerRef.current) clearInterval(timerRef.current)

      const isEstimation = currentQ.levelId === 'NS-3' && !isChoice
      const correct = isEstimation
        ? isWithinTolerance(answer, currentQ.answer, 0.15)
        : isAnswerCorrect(answer, currentQ.answer)
      const withinTime = settings.focusMode ? false : timerRemaining > 0
      const newStreak = correct ? streak + 1 : 0
      const { stars, streakMultiplier } = scoreQuestion(correct, currentQ.starsBase, withinTime, newStreak)

      setStreak(newStreak)
      setMaxStreak(Math.max(maxStreak, newStreak))
      setTotalStars((prev) => prev + stars)
      setLastStars(stars)
      setLastMultiplier(streakMultiplier)

      thetaRef.current = updateTheta(thetaRef.current, currentQ.difficulty, correct)

      const newConsecutiveWrong = correct ? 0 : consecutiveWrong + 1
      setConsecutiveWrong(newConsecutiveWrong)
      if (newConsecutiveWrong === 3) {
        setShowEncouragement(true)
      }

      const result: QuestionResult = {
        questionId: currentQ.id,
        levelId: currentQ.levelId,
        correct,
        userAnswer: answer,
        timeMs: timerTotal - timerRemaining,
        variant: currentQ.variant,
        errorTag: null,
        distractorType: null,
      }

      if (!correct) {
        if (isChoice && currentQ.options) {
          const chosen = currentQ.options.find((o) => o.value === answer)
          if (chosen?.distractorType) {
            result.distractorType = chosen.distractorType
          }
          result.errorTag = detectErrorTag(result.distractorType)
        } else {
          const userNum = parseFloat(answer)
          const correctNum = parseFloat(currentQ.answer)
          if (!isNaN(userNum) && !isNaN(correctNum)) {
            result.errorTag = diagnoseBlank(userNum, correctNum, currentQ.levelId)
          } else {
            result.errorTag = 'careless'
          }
        }
      }

      setResults((prev) => [...prev, result])
      setPhase('feedback')
    },
    [currentQ, phase, streak, maxStreak, timerRemaining, isChoice, consecutiveWrong, settings.focusMode],
  )

  const handleNext = useCallback(() => {
    if (currentIdx + 1 >= questions.length) {
      setElapsedSec(Math.round((Date.now() - new Date(sessionStartRef.current).getTime()) / 1000))
      setPhase('summary')
      return
    }
    setCurrentIdx((i) => i + 1)
    setInputValue('')
    setSelectedChoice(null)
    setPhase('answering')
  }, [currentIdx, questions.length])

  useEffect(() => {
    if (phase !== 'summary' || persistedRef.current || !user) return
    persistedRef.current = true

    const persist = async () => {
      const today = new Date().toISOString().slice(0, 10)
      const correctCount = results.filter((r) => r.correct).length
      const accuracy = results.length > 0 ? correctCount / results.length : 0

      await saveSessionRecord({
        userId: user.id,
        date: today,
        mode: mode as 'daily' | 'level' | 'mistakes',
        levelId,
        tier: mode === 'level' ? tier : null,
        results,
        timeSpentSec: elapsedSec,
        starsEarned: totalStars,
        maxStreak,
        startedAt: sessionStartRef.current,
      })

      await saveMistakeRecords(user.id, results, questions)

      if (mode === 'mistakes') {
        const correctLevelIds = Array.from(
          new Set(results.filter((r) => r.correct).map((r) => r.levelId)),
        )
        await updateMistakeProgress(user.id, correctLevelIds)
      }

      if (mode === 'level' && levelId) {
        const cfg = TIER_CONFIG[tier]
        const passed = isTierPassed(correctCount, results.length, cfg.passRate)
        await updateTier(levelId, tier, passed ? 'passed' : 'practicing', accuracy)
      }

      if (treeId) {
        updateSettings({
          thetaPerTree: {
            ...settings.thetaPerTree,
            [treeId]: thetaRef.current,
          },
        })
      }
    }

    void persist()
  }, [phase, user, results, questions, mode, levelId, tier, elapsedSec, totalStars, maxStreak, treeId, settings.thetaPerTree, updateSettings, updateTier])

  const handleDigit = useCallback(
    (d: string) => setInputValue((prev) => (prev.length < 8 ? prev + d : prev)),
    [],
  )
  const handleDelete = useCallback(() => setInputValue((prev) => prev.slice(0, -1)), [])
  const handleConfirm = useCallback(() => {
    if (inputValue) handleAnswer(inputValue)
  }, [inputValue, handleAnswer])
  const handleChoice = useCallback(
    (opt: { value: string }) => {
      setSelectedChoice(opt.value)
      handleAnswer(opt.value)
    },
    [handleAnswer],
  )
  const handleVerticalSubmit = useCallback(
    (r: { correct: boolean; userResult: number[] }) => {
      handleAnswer(r.userResult.join(''))
    },
    [handleAnswer],
  )
  const handleNumberLineSubmit = useCallback(
    (value: number) => {
      handleAnswer(Number.isInteger(value) ? String(value) : value.toString())
    },
    [handleAnswer],
  )
  const handleFractionSubmit = useCallback(
    (num: number, den: number) => {
      handleAnswer(`${num}/${den}`)
    },
    [handleAnswer],
  )
  const handleStepSubmit = useCallback(
    (r: { finalAnswer: string }) => {
      handleAnswer(r.finalAnswer)
    },
    [handleAnswer],
  )
  const handleEquationSubmit = useCallback(
    (userAnswer: string) => {
      handleAnswer(userAnswer)
    },
    [handleAnswer],
  )
  const handleDivisionSubmit = useCallback(
    (r: { quotient: number[] }) => {
      handleAnswer(r.quotient.join(''))
    },
    [handleAnswer],
  )

  if (questions.length === 0) {
    if (mode === 'mistakes') {
      return (
        <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 text-center">
          <div className="mb-3 text-5xl">🎉</div>
          <p className="mb-4 text-white/70">还没有需要复习的错题</p>
          <Link
            href="/calculate"
            className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-500"
          >
            返回首页
          </Link>
        </div>
      )
    }
    return (
      <div className="flex min-h-screen items-center justify-center text-white/60">
        加载中...
      </div>
    )
  }

  if (phase === 'summary') {
    const correctCount = results.filter((r) => r.correct).length
    const errorSummary: Record<string, number> = {}
    for (const r of results) {
      if (r.errorTag) {
        errorSummary[r.errorTag] = (errorSummary[r.errorTag] ?? 0) + 1
      } else if (r.distractorType) {
        errorSummary[r.distractorType] = (errorSummary[r.distractorType] ?? 0) + 1
      }
    }
    return (
      <div className="mx-auto max-w-lg px-4 pt-6">
        <SessionSummary
          correctCount={correctCount}
          totalCount={questions.length}
          starsEarned={totalStars}
          timeSpentSec={elapsedSec}
          maxStreak={maxStreak}
          errorSummary={errorSummary}
          onRetry={() => window.location.reload()}
          onExit={() => window.location.assign('/calculate')}
        />
        <div className="mt-4 px-4">
          <Link
            href="/calculate/report"
            className="block rounded-xl border border-white/20 bg-white/[0.04] py-3 text-center text-sm font-medium text-white/80 hover:bg-white/[0.08]"
          >
            查看详细报告 →
          </Link>
        </div>
      </div>
    )
  }

  const correctAnswer = phase === 'feedback' ? currentQ.answer : null
  const lastResult = results[results.length - 1]

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 pt-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <Link href="/calculate" className="text-white/60 hover:text-white text-sm">
          ◀
        </Link>
        <div className="text-xs text-white/50">
          第 {currentIdx + 1}/{questions.length} 题
        </div>
        <div className="text-xs text-amber-400">⭐ {totalStars}</div>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Streak + Timer */}
      <div className="mb-6 flex items-center justify-between">
        <StreakIndicator streak={streak} />
        {TIER_CONFIG[tier].hasTimeLimit && !settings.focusMode && (
          <CircularTimer totalMs={timerTotal} remainingMs={timerRemaining} />
        )}
      </div>

      {/* Question */}
      <QuestionDisplay
        display={currentQ.display}
        hint={currentQ.hint}
        questionNumber={currentIdx + 1}
        totalQuestions={questions.length}
      />

      {/* Answer area */}
      <div className="mt-auto pb-6">
        {isChoice && currentQ.options ? (
          <ChoiceGrid
            options={currentQ.options}
            onSelect={handleChoice}
            selectedValue={selectedChoice}
            correctValue={correctAnswer}
            showResult={phase === 'feedback'}
            disabled={phase === 'feedback'}
          />
        ) : isStepSolve && currentQ.steps ? (
          <StepSolve
            steps={currentQ.steps}
            onSubmit={handleStepSubmit}
            disabled={phase === 'feedback'}
          />
        ) : isDivisionVertical && divisionParams ? (
          <DivisionVertical
            dividend={divisionParams.dividend}
            divisor={divisionParams.divisor}
            onSubmit={handleDivisionSubmit}
            disabled={phase === 'feedback'}
          />
        ) : isEquationFill && equationFillParams ? (
          <EquationFill
            template={equationFillParams.template}
            answer={equationFillParams.answer}
            kind={equationFillParams.kind}
            onSubmit={handleEquationSubmit}
            disabled={phase === 'feedback'}
          />
        ) : isVertical && verticalParams ? (
          <VerticalCalc
            a={verticalParams.a}
            b={verticalParams.b}
            op={verticalParams.op}
            onSubmit={handleVerticalSubmit}
            disabled={phase === 'feedback'}
          />
        ) : isNumberLine && numberLineParams ? (
          <NumberLine
            min={numberLineParams.min}
            max={numberLineParams.max}
            step={numberLineParams.step}
            target={numberLineParams.target}
            onSubmit={handleNumberLineSubmit}
            disabled={phase === 'feedback'}
          />
        ) : isFractionVis && fractionVisParams ? (
          <FractionVis
            operands={fractionVisParams.operands}
            op={fractionVisParams.op}
            onSubmit={handleFractionSubmit}
            disabled={phase === 'feedback'}
          />
        ) : (
          <>
            <div className="mb-4 flex items-center justify-center">
              <div className="min-h-[48px] min-w-[120px] rounded-xl border-2 border-white/20 bg-white/[0.05] px-4 py-2 text-center text-2xl font-bold text-white">
                {inputValue || '...'}
              </div>
            </div>
            <NumberPad
              onInput={handleDigit}
              onDelete={handleDelete}
              onConfirm={handleConfirm}
              disabled={phase === 'feedback'}
            />
          </>
        )}
      </div>

      {/* Feedback overlay */}
      {phase === 'feedback' && lastResult && (
        <FeedbackOverlay
          correct={lastResult.correct}
          starsEarned={lastStars}
          streakMultiplier={lastMultiplier}
          explanation={currentQ.explanation}
          userAnswer={lastResult.userAnswer}
          errorTagLabel={lastResult.distractorType ?? undefined}
          onNext={handleNext}
        />
      )}

      {/* Encouragement dialog on 3 consecutive wrong */}
      {showEncouragement && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="mx-6 w-full max-w-sm rounded-2xl bg-[#1a1830] p-6 text-center">
            <div className="mb-3 text-4xl">💪</div>
            <p className="mb-2 text-lg font-bold text-white">别灰心，要不要看看解题思路？</p>
            <p className="mb-5 text-sm text-white/50">
              连续 {consecutiveWrong} 题答错了，放慢脚步也没关系
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowEncouragement(false)}
                className="rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-500"
              >
                继续加油 →
              </button>
              <button
                onClick={() => window.location.assign('/calculate')}
                className="rounded-xl bg-white/10 py-3 font-bold text-white/70 hover:bg-white/15"
              >
                今天先到这里
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
