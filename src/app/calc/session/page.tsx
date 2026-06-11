'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useCalcSettings } from '@/hooks/useCalcSettings'
import { useCalcWallet } from '@/hooks/useCalcWallet'
import { useStarHud } from '@/components/stars/StarHudProvider'
import { useCalcMistakes } from '@/hooks/useCalcMistakes'
import CalcAppHeader from '@/components/calc/CalcAppHeader'
import QuestionDisplay from '@/components/calc/QuestionDisplay'
import NumberPad from '@/components/calc/NumberPad'
import { type FeedbackKind } from '@/components/calc/FeedbackOverlay'
import ChallengeBanner from '@/components/calc/ChallengeBanner'
import SessionSummary from '@/components/calc/SessionSummary'
import { buildSession, calcTimeBonus, coinReward } from '@/utils/calc-helpers'
import { interleaveWrong } from '@/utils/calc-session-builder'
import { timeLimitFromSettings } from '@/utils/calc-time-limits'
import { playSfx } from '@/components/calc/audio'
import { launchConfetti } from '@/utils/confetti'
import { todayStr } from '@/utils/constant'
import type { CalcLevel, CalcMode, CalcQuestion } from '@/utils/type'

interface AttemptStat {
  signature: string
  level: CalcLevel
  isChallenge: boolean
  firstTryCorrect: boolean
  finallyCorrect: boolean
  wasMistake: boolean
  /** Time from question display to first submission, in ms. */
  timeMs: number
  /** Whether the first attempt was within the configured time limit. */
  withinLimit: boolean
}

function formatTimer(s: number) {
  if (s < 0) s = 0
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export default function CalcSessionPage() {
  const params = useSearchParams()
  const { user } = useAuth()
  const { settings, update, isLoading: settingsLoading } = useCalcSettings(user)
  const wallet = useCalcWallet(user)
  const { refresh: refreshStarHud } = useStarHud()
  const { mistakes, addMistake, recordCorrect, refresh: refreshMistakes } = useCalcMistakes(user)

  const requestedCount = useMemo(() => {
    const n = Number(params.get('count'))
    return Number.isFinite(n) && n > 0 ? n : settings.lastCount
  }, [params, settings.lastCount])

  const requestedTimeLimit = useMemo(() => {
    const n = Number(params.get('time'))
    return Number.isFinite(n) && n >= 0 ? n : settings.lastTimeLimit
  }, [params, settings.lastTimeLimit])

  const mode: CalcMode = useMemo(() => {
    const m = params.get('mode')
    return m === 'free' || m === 'mistakes' ? m : 'daily'
  }, [params])

  // ── Session state ────────────────────────────────────────────────
  const [questions, setQuestions] = useState<CalcQuestion[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState('')
  const [attemptsForCurrent, setAttemptsForCurrent] = useState(0)
  const [feedback, setFeedback] = useState<FeedbackKind>(null)
  const [revealAnswer, setRevealAnswer] = useState<number | null>(null)

  const [showChallengeBanner, setShowChallengeBanner] = useState(false)

  const [coinsTotal, setCoinsTotal] = useState(0)
  const coinsTotalRef = useRef(0)
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)
  const maxStreakRef = useRef(0)
  const [lastResult, setLastResult] = useState<{ stars: number; bonus: number } | null>(null)

  const attemptsLogRef = useRef<AttemptStat[]>([])
  // First-attempt solve time (ms) per question, in order — persisted for timing analysis.
  const questionTimesRef = useRef<number[]>([])
  const questionStartRef = useRef<number>(0)
  const [startedTsMs, setStartedTsMs] = useState<number>(0)
  const [startedAtIso, setStartedAtIso] = useState<string>('')

  const [now, setNow] = useState<number>(() => Date.now())
  const [done, setDone] = useState(false)
  const [timeBonusEarned, setTimeBonusEarned] = useState(0)
  const [finalStats, setFinalStats] = useState<{
    correct: number
    retry: number
    wrong: number
    total: number
    challenge: number
    timeSec: number
    /** Mean first-attempt solve time this session, in ms (null if no data). */
    avgMs: number | null
    /** Mean per-question time of the PREVIOUS session, in ms (null if none). */
    prevAvgMs: number | null
  } | null>(null)

  const [sessionKey, setSessionKey] = useState(0)

  // Initialize session ONCE after settings + mistakes ready, AND user is loaded
  const initRef = useRef(false)
  useEffect(() => {
    if (initRef.current) return
    if (settingsLoading) return
    if (!user) return
    initRef.current = true

    const init = () => {
      const session = buildSession(settings, requestedCount, mistakes)
      setQuestions(session)
      setStartedAtIso(new Date().toISOString())
      setStartedTsMs(Date.now())
      questionStartRef.current = performance.now()
    }
    init()
  }, [settings, settingsLoading, mistakes, requestedCount, mode, user, sessionKey])

  // Reset question-start timestamp whenever idx changes
  useEffect(() => {
    if (questions && idx < questions.length) {
      questionStartRef.current = performance.now()
    }
  }, [idx, questions])

  // Timer tick (subscribe to clock)
  useEffect(() => {
    if (done || !questions) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [done, questions])

  // Pre-question challenge banner
  useEffect(() => {
    if (!questions || idx >= questions.length) return
    if (questions[idx].isChallenge) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowChallengeBanner(true)
      playSfx('challenge', settings.soundEnabled)
      const t = setTimeout(() => setShowChallengeBanner(false), 1400)
      return () => clearTimeout(t)
    }
  }, [questions, idx, settings.soundEnabled])

  const elapsedSec = startedTsMs > 0 ? Math.floor((now - startedTsMs) / 1000) : 0
  const remainingSec = requestedTimeLimit > 0 ? Math.max(0, requestedTimeLimit - elapsedSec) : null

  // ── Finish handler ───────────────────────────────────────────────
  const finishSession = useCallback(async () => {
    if (done) return
    setDone(true)
    const finalElapsed = Math.floor((Date.now() - startedTsMs) / 1000)
    const log = attemptsLogRef.current
    const correctCount = log.filter((a) => a.firstTryCorrect).length
    const retryCount = log.filter((a) => !a.firstTryCorrect && a.finallyCorrect).length
    const wrongCount = log.filter((a) => !a.finallyCorrect).length
    const challengeCorrect = log.filter((a) => a.isChallenge && a.finallyCorrect).length

    const timeBonus = calcTimeBonus(log.length, requestedTimeLimit, finalElapsed)
    setTimeBonusEarned(timeBonus)

    // ── Timing analysis: this session's avg per-question time vs the previous session ──
    const qTimes = questionTimesRef.current
    const avgMs = qTimes.length > 0
      ? Math.round(qTimes.reduce((s, t) => s + t, 0) / qTimes.length)
      : null
    // wallet.sessions is the pre-recording list (closure captured at render) → [0] is the last session.
    const prevSession = wallet.sessions[0]
    const prevAvgMs = prevSession
      ? (prevSession.questionTimesMs && prevSession.questionTimesMs.length > 0
          ? Math.round(prevSession.questionTimesMs.reduce((s, t) => s + t, 0) / prevSession.questionTimesMs.length)
          : (prevSession.count > 0 ? Math.round((prevSession.timeSpentSec * 1000) / prevSession.count) : null))
      : null

    setFinalStats({
      correct: correctCount,
      retry: retryCount,
      wrong: wrongCount,
      total: log.length,
      challenge: challengeCorrect,
      timeSec: finalElapsed,
      avgMs,
      prevAvgMs,
    })

    const topLevel = log.reduce<CalcLevel>((max, a) => {
      const av = a.level === 'C' ? 99 : (a.level as number)
      const mv = max === 'C' ? 99 : (max as number)
      return av > mv ? a.level : max
    }, 1)

    // 1. Persist session row (unchanged)
    await wallet.recordSession({
      date: todayStr(),
      startedAt: startedAtIso,
      finishedAt: new Date().toISOString(),
      count: log.length,
      correctCount,
      retryCount,
      wrongCount,
      challengeCorrect,
      timeSpentSec: finalElapsed,
      coinsEarned: coinsTotalRef.current + timeBonus,
      mode,
      maxStreak: maxStreakRef.current,
      topLevel,
      questionTimesMs: qTimes,
    })
    // Sync the global StarHud balance so the top-left chip updates immediately.
    void refreshStarHud()

    // 2. Bump global session counter
    update({ sessionCounter: settings.sessionCounter + 1 })

    playSfx('complete', settings.soundEnabled)
    launchConfetti(30)
  }, [
    done,
    wallet,
    refreshStarHud,
    mode,
    settings.soundEnabled,
    settings.sessionCounter,
    update,
    startedTsMs,
    startedAtIso,
    requestedTimeLimit,
  ])

  // time-up
  useEffect(() => {
    if (remainingSec !== null && remainingSec <= 0 && !done && questions) {
      // finishSession internally calls setDone — lint can't trace through the promise
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void finishSession()
    }
  }, [remainingSec, done, questions, finishSession])

  // ── Submit answer ────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (!questions || done || feedback) return
    const q = questions[idx]
    const userAns = Number(input)
    if (!Number.isFinite(userAns)) return

    const isCorrect = userAns === q.answer
    const wasMistake = mistakes.some((m) => !m.resolved && m.signature === q.signature)

    // Compute per-question time + within-limit
    const elapsedMs = Math.round(performance.now() - questionStartRef.current)
    const limitMs = timeLimitFromSettings(q.level, settings)
    const withinLimit = limitMs > 0 ? elapsedMs <= limitMs : true

    // Record the first-attempt solve time once per question (the genuine think time).
    if (attemptsForCurrent === 0) questionTimesRef.current.push(elapsedMs)

    if (isCorrect) {
      const isFirstTry = attemptsForCurrent === 0
      const reward = isFirstTry ? coinReward(q, streak) : 0
      const isChallengeCorrect = q.isChallenge && isFirstTry
      const bonus = isFirstTry ? (streak >= 10 ? 2 : streak >= 5 ? 1 : 0) : 0

      if (isFirstTry && reward > 0) {
        setLastResult({ stars: reward, bonus })
      }
      setFeedback(isChallengeCorrect ? 'challenge-correct' : 'correct')
      playSfx(isChallengeCorrect ? 'streak' : 'correct', settings.soundEnabled)
      if (reward > 0) playSfx('coin', settings.soundEnabled)
      if (isChallengeCorrect) launchConfetti(20)

      coinsTotalRef.current += reward
      setCoinsTotal((c) => c + reward)
      const nextStreak = isFirstTry ? streak + 1 : 0
      setStreak(nextStreak)
      if (nextStreak > maxStreakRef.current) {
        maxStreakRef.current = nextStreak
        setMaxStreak(nextStreak)
      }

      attemptsLogRef.current.push({
        signature: q.signature,
        level: q.level,
        isChallenge: q.isChallenge,
        firstTryCorrect: isFirstTry,
        finallyCorrect: true,
        wasMistake,
        timeMs: elapsedMs,
        withinLimit: isFirstTry ? withinLimit : false,
      })

      if (wasMistake) {
        void recordCorrect(q.signature)
      }

      const advance = () => {
        setFeedback(null)
        setInput('')
        setAttemptsForCurrent(0)
        setLastResult(null)
        if (idx + 1 >= questions.length) {
          void finishSession()
        } else {
          setIdx((i) => i + 1)
        }
      }
      window.setTimeout(advance, isChallengeCorrect ? 1100 : 750)
      return
    }

    // wrong
    if (attemptsForCurrent === 0) {
      setFeedback('retry')
      setStreak(0)
      playSfx('retry', settings.soundEnabled)
      window.setTimeout(() => {
        setFeedback(null)
        setInput('')
        setAttemptsForCurrent(1)
      }, 700)
    } else {
      setFeedback('wrong')
      setRevealAnswer(q.answer)
      setStreak(0)
      playSfx('wrong', settings.soundEnabled)
      void addMistake(q)

      attemptsLogRef.current.push({
        signature: q.signature,
        level: q.level,
        isChallenge: q.isChallenge,
        firstTryCorrect: false,
        finallyCorrect: false,
        wasMistake,
        timeMs: elapsedMs,
        withinLimit: false,
      })

      // master.md §6.2 — interleave wrong problems +4 positions later in the queue
      // so the brain has to retrieve rather than rely on short-term memory.
      // Skip for challenge questions (those are one-off) and for mistakes mode (already revisiting).
      if (!q.isChallenge && mode !== 'mistakes') {
        setQuestions((prev) => (prev ? interleaveWrong(prev, idx, q) : prev))
      }

      window.setTimeout(() => {
        setFeedback(null)
        setRevealAnswer(null)
        setInput('')
        setAttemptsForCurrent(0)
        if (idx + 1 >= questions.length) {
          void finishSession()
        } else {
          setIdx((i) => i + 1)
        }
      }, 1700)
    }
  }, [
    questions,
    done,
    feedback,
    idx,
    input,
    attemptsForCurrent,
    streak,
    maxStreak,
    mistakes,
    mode,
    settings,
    addMistake,
    recordCorrect,
    finishSession,
  ])

  if (settingsLoading || !questions) {
    return (
      <>
        <CalcAppHeader
          balance={wallet.balance}
          soundEnabled={settings.soundEnabled}
          onToggleSound={() => update({ soundEnabled: !settings.soundEnabled })}
          title="练习中"
          backHref="/calc"
          backLabel="返回"
        />
        <div
          className="mx-auto max-w-[640px] px-4 py-10 text-center text-[13px]"
          style={{ color: 'rgba(196,181,253,0.5)' }}
        >
          准备题目中…
        </div>
      </>
    )
  }

  const currentQ = questions[idx]
  const progress = Math.round((idx / questions.length) * 100)

  return (
    <>
      <CalcAppHeader
        balance={wallet.balance + coinsTotal}
        soundEnabled={settings.soundEnabled}
        onToggleSound={() => update({ soundEnabled: !settings.soundEnabled })}
        title="练习中"
        backHref="/calc"
        backLabel="退出"
      />

      <main className="relative mx-auto max-w-[640px] px-4 pt-3 pb-6">
        {/* Top status */}
        <div
          className="mb-2 flex items-center justify-between text-[12px] font-bold tabular-nums"
          style={{ color: 'rgba(196,181,253,0.6)' }}
        >
          <div>{remainingSec !== null ? `⏱ ${formatTimer(remainingSec)}` : '⏱ ∞'}</div>
          <div style={{ color: 'rgba(245,243,255,0.5)' }}>
            {idx + 1} / {questions.length}
          </div>
          <div style={{ color: '#fb923c' }}>{streak >= 2 ? `🔥 ${streak}` : ' '}</div>
        </div>

        {/* Real-time star bar */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1"
            style={{
              background: 'rgba(251,191,36,0.12)',
              border: '1px solid rgba(251,191,36,0.22)',
            }}
          >
            <span className="text-[13px]">⭐</span>
            <span
              className="font-fredoka text-[14px] font-black tabular-nums"
              style={{ color: '#fbbf24' }}
            >
              {coinsTotal}
            </span>
          </div>
          {streak >= 5 && (
            <div
              className="flex items-center gap-1 rounded-full px-2.5 py-1"
              style={{
                background: 'rgba(251,146,60,0.15)',
                border: '1px solid rgba(251,146,60,0.3)',
              }}
            >
              <span className="text-[11px]">🔥</span>
              <span className="text-[10px] font-extrabold" style={{ color: '#fb923c' }}>
                {streak >= 10 ? '+2加成' : '+1加成'}
              </span>
            </div>
          )}
          {lastResult && lastResult.stars > 0 && (
            <div
              className="flex items-center gap-1 rounded-full px-2.5 py-1"
              style={{
                background: 'rgba(34,197,94,0.15)',
                border: '1px solid rgba(34,197,94,0.28)',
                animation: 'float-up 0.7s ease-out forwards',
              }}
            >
              <span className="text-[10px] font-extrabold" style={{ color: '#4ade80' }}>
                +{lastResult.stars} ⭐
                {lastResult.bonus > 0 && (
                  <span style={{ color: '#fb923c' }}> 含+{lastResult.bonus}加成</span>
                )}
              </span>
            </div>
          )}
        </div>

        <div
          className="mb-5 h-1.5 overflow-hidden rounded-full"
          style={{ background: 'rgba(255,255,255,0.07)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #7c3aed, #d946ef)',
              boxShadow: '0 0 8px rgba(139,92,246,0.5)',
            }}
          />
        </div>

        {/* Question */}
        <div className="my-6 sm:my-8">
          <QuestionDisplay display={currentQ.display} isChallenge={currentQ.isChallenge} />
        </div>

        {/* Inline feedback banner */}
        <div className="mb-4" style={{ minHeight: 52 }}>
          {feedback === 'correct' && (
            <div
              className="rounded-xl py-3 text-center text-[15px] font-extrabold"
              style={{
                background: 'rgba(34,197,94,0.15)',
                border: '1px solid rgba(34,197,94,0.3)',
                color: '#4ade80',
                animation: 'pop-in 0.25s ease',
              }}
            >
              ✓ 答对啦！
              {lastResult && lastResult.stars > 0 ? `本题 +${lastResult.stars} ⭐` : '（第二次）'}
            </div>
          )}
          {feedback === 'challenge-correct' && (
            <div
              className="rounded-xl py-3 text-center text-[15px] font-extrabold"
              style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(236,72,153,0.15))',
                border: '1px solid rgba(245,158,11,0.4)',
                color: '#fbbf24',
                animation: 'pop-in 0.3s cubic-bezier(.34,1.56,.64,1)',
              }}
            >
              🌟 挑战题答对！{lastResult && lastResult.stars > 0 ? `+${lastResult.stars} ⭐` : ''}
            </div>
          )}
          {feedback === 'retry' && (
            <div
              className="rounded-xl py-3 text-center text-[15px] font-extrabold"
              style={{
                background: 'rgba(251,191,36,0.12)',
                border: '1px solid rgba(251,191,36,0.25)',
                color: '#fbbf24',
                animation: 'wiggle 0.4s ease',
              }}
            >
              🤔 再想想～
            </div>
          )}
          {feedback === 'wrong' && (
            <div
              className="rounded-xl py-3 text-center text-[14px] font-extrabold"
              style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.28)',
                color: '#f87171',
                animation: 'pop-in 0.25s ease',
              }}
            >
              答案是{' '}
              <span className="font-fredoka text-[22px]" style={{ color: '#fca5a5' }}>
                {revealAnswer}
              </span>
              ，下次加油！
            </div>
          )}
        </div>

        {/* Input */}
        <div
          className="mx-auto mb-4 flex h-16 max-w-[260px] items-center justify-center rounded-2xl transition-all duration-200"
          style={{
            background: 'rgba(139,92,246,0.08)',
            border: `1.5px solid ${input ? 'rgba(139,92,246,0.4)' : 'rgba(139,92,246,0.2)'}`,
            boxShadow: input ? '0 0 14px rgba(139,92,246,0.15)' : 'none',
          }}
        >
          <span
            className="font-fredoka leading-none font-black tabular-nums"
            style={{
              fontSize: 'clamp(28px, 6vw, 38px)',
              color: input ? '#e9d5ff' : 'rgba(196,181,253,0.25)',
            }}
          >
            {input || '·'}
          </span>
        </div>

        {/* Pad */}
        <div className="mx-auto max-w-[320px]">
          <NumberPad
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            disabled={!!feedback || done}
          />
        </div>
      </main>

      {showChallengeBanner && <ChallengeBanner coins={currentQ.coinBase} />}

      {done && finalStats && (
        <SessionSummary
          correctCount={finalStats.correct}
          retryCount={finalStats.retry}
          wrongCount={finalStats.wrong}
          total={finalStats.total}
          coinsEarned={coinsTotal}
          timeBonusEarned={timeBonusEarned}
          timeSpentSec={finalStats.timeSec}
          avgMs={finalStats.avgMs}
          prevAvgMs={finalStats.prevAvgMs}
          maxStreak={maxStreak}
          challengeCorrect={finalStats.challenge}
          levelUpTo={null}
          levelDownTo={null}
          reviewMilestone={null}
          nextSessionAssault={false}
          onAgain={() => {
            void refreshMistakes()
            setQuestions(null)
            setIdx(0)
            setInput('')
            setAttemptsForCurrent(0)
            setFeedback(null)
            setRevealAnswer(null)
            setShowChallengeBanner(false)
            questionTimesRef.current = []
            coinsTotalRef.current = 0
            setCoinsTotal(0)
            setStreak(0)
            maxStreakRef.current = 0
            setMaxStreak(0)
            setLastResult(null)
            attemptsLogRef.current = []
            setStartedTsMs(0)
            setStartedAtIso('')
            setDone(false)
            setTimeBonusEarned(0)
            setFinalStats(null)
            initRef.current = false
            setSessionKey((k) => k + 1)
          }}
        />
      )}
    </>
  )
}
