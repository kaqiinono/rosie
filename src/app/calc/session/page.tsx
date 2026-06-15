'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useCalcSettings } from '@/hooks/useCalcSettings'
import { useCalcWallet } from '@/hooks/useCalcWallet'
import { useStarHud } from '@/components/stars/StarHudProvider'
import { useCalcMistakes } from '@/hooks/useCalcMistakes'
import { useCalcProblemState, applyAttempt } from '@/hooks/useCalcProblemState'
import CalcAppHeader from '@/components/calc/CalcAppHeader'
import CalcQuestionStage from '@/components/calc/CalcQuestionStage'
import CalcSessionStatusBar from '@/components/calc/CalcSessionStatusBar'
import CalcFeedbackBanner from '@/components/calc/CalcFeedbackBanner'
import { type FeedbackKind } from '@/components/calc/FeedbackOverlay'
import ChallengeBanner from '@/components/calc/ChallengeBanner'
import SessionSummary from '@/components/calc/SessionSummary'
import { buildSession, calcTimeBonus, coinReward } from '@/utils/calc-helpers'
import { checkAnswer, formatAnswer, isReducibleFraction } from '@/utils/calc-answer'
import { diagnose } from '@/utils/calc-diagnose'
import { blockById } from '@/utils/calc-blocks'
import { skeletonMeta } from '@/utils/calc-mixed'
import { timeLimitFromSettings } from '@/utils/calc-time-limits'
import { playSfx } from '@/components/calc/audio'
import { launchConfetti } from '@/utils/confetti'
import { todayStr } from '@/utils/constant'
import type { CalcLevel, CalcMode, CalcProblemState, CalcQuestion } from '@/utils/type'

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
  /** Attribution: which single-op block this question came from. */
  sourceBlockId?: string
  /** Attribution: which mixed-op generator this question came from. */
  sourceMixedOpId?: string
  /** Question display with trailing "= ?" stripped, for wrong-answer review. */
  display?: string
}


export default function CalcSessionPage() {
  const params = useSearchParams()
  const { user } = useAuth()
  const { settings, update, isLoading: settingsLoading } = useCalcSettings(user)
  const wallet = useCalcWallet(user)
  const { refresh: refreshStarHud } = useStarHud()
  const {
    mistakes,
    addMistake,
    recordCorrect,
    lastSessionUnresolved,
    refresh: refreshMistakes,
  } = useCalcMistakes(user)
  const problemState = useCalcProblemState(user)

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
  // Wrong questions collected during the session, appended to the tail for make-up.
  const wrongQueueRef = useRef<CalcQuestion[]>([])
  // Number of originally-planned questions (excludes make-up tail).
  // Ref for use inside event-handler closures; state mirror for render.
  const plannedCountRef = useRef(0)
  const [plannedCount, setPlannedCount] = useState(0)
  const [input, setInput] = useState('')
  const [attemptsForCurrent, setAttemptsForCurrent] = useState(0)
  const [feedback, setFeedback] = useState<FeedbackKind>(null)
  const [revealAnswer, setRevealAnswer] = useState<string | null>(null)
  const [reduceHint, setReduceHint] = useState(false)

  const [showChallengeBanner, setShowChallengeBanner] = useState(false)

  const [coinsTotal, setCoinsTotal] = useState(0)
  const coinsTotalRef = useRef(0)
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)
  const maxStreakRef = useRef(0)
  const [lastResult, setLastResult] = useState<{ stars: number; bonus: number } | null>(null)
  // Whether the current 'correct' feedback came on the second try (no stars).
  const [secondTryCorrect, setSecondTryCorrect] = useState(false)

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
    /** Per-source performance breakdown for this session. */
    bySource: { label: string; total: number; firstTryCorrect: number; proficiency: number }[]
    /** Distinct wrong-question displays from this session (final answer wrong), capped. */
    newWeak: string[]
    /** Source labels to focus on next time, weakest-first. */
    nextFocus: string[]
  } | null>(null)

  const [sessionKey, setSessionKey] = useState(0)

  // Initialize session ONCE after settings + mistakes ready, AND user is loaded
  const initRef = useRef(false)
  useEffect(() => {
    if (initRef.current) return
    if (settingsLoading) return
    if (!user) return
    initRef.current = true

    const init = async () => {
      // Load all of the user's problem states so buildSession can weight toward weak ones.
      // Use the returned map directly — `problemState.states` is still the stale
      // pre-load value within this same closure (React state updates async).
      const loadedStates = await problemState.loadAll()
      // Carry the PREVIOUS session's still-unresolved mistakes as make-up questions.
      // Previous session number == current sessionCounter (it bumps after finish).
      const carried = lastSessionUnresolved(settings.sessionCounter)
      const session = buildSession(
        settings,
        requestedCount,
        {
          problemStates: loadedStates,
        },
        carried,
      )
      setQuestions(session)
      plannedCountRef.current = session.length
      setPlannedCount(session.length)
      setStartedAtIso(new Date().toISOString())
      setStartedTsMs(Date.now())
      questionStartRef.current = performance.now()
    }
    void init()
  }, [
    settings,
    settingsLoading,
    requestedCount,
    mode,
    user,
    sessionKey,
    problemState,
    lastSessionUnresolved,
  ])

  // Reset question-start timestamp whenever idx changes
  useEffect(() => {
    if (questions && idx < questions.length) {
      questionStartRef.current = performance.now()
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReduceHint(false)
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
    const avgMs =
      qTimes.length > 0 ? Math.round(qTimes.reduce((s, t) => s + t, 0) / qTimes.length) : null
    // wallet.sessions is the pre-recording list (closure captured at render) → [0] is the last session.
    const prevSession = wallet.sessions[0]
    const prevAvgMs = prevSession
      ? prevSession.questionTimesMs && prevSession.questionTimesMs.length > 0
        ? Math.round(
            prevSession.questionTimesMs.reduce((s, t) => s + t, 0) /
              prevSession.questionTimesMs.length,
          )
        : prevSession.count > 0
          ? Math.round((prevSession.timeSpentSec * 1000) / prevSession.count)
          : null
      : null

    const topLevel = log.reduce<CalcLevel>((max, a) => {
      const av = a.level === 'C' ? 99 : (a.level as number)
      const mv = max === 'C' ? 99 : (max as number)
      return av > mv ? a.level : max
    }, 1)

    // ── Record lightweight per-signature proficiency with source attribution ──
    const nextSessionNo = settings.sessionCounter + 1
    const today = todayStr()
    const grouped = new Map<string, AttemptStat[]>()
    for (const a of log) {
      const arr = grouped.get(a.signature)
      if (arr) arr.push(a)
      else grouped.set(a.signature, [a])
    }
    const nextStates: CalcProblemState[] = []
    for (const group of grouped.values()) {
      const first = group[0]
      let state = problemState.getState(first.signature, first.level)
      for (const a of group) {
        state = applyAttempt(
          state,
          { correct: a.finallyCorrect, timeMs: a.timeMs, withinLimit: a.withinLimit },
          a.withinLimit,
          nextSessionNo,
          today,
        )
      }
      // Only (re)assign attribution when this question carried a source. Carried
      // make-up mistakes have no source — keep the signature's existing block/mixed
      // attribution instead of wiping it to null.
      if (first.sourceBlockId) state.blockId = first.sourceBlockId
      if (first.sourceMixedOpId) state.mixedOpId = first.sourceMixedOpId
      nextStates.push(state)
    }
    if (nextStates.length) await problemState.upsertStates(nextStates)

    // ── Per-source breakdown for this session's summary ──
    const sourceKeyOf = (a: AttemptStat): string | null => {
      if (a.sourceBlockId) return `block:${a.sourceBlockId}`
      if (a.sourceMixedOpId) return `mixed:${a.sourceMixedOpId}`
      return null
    }
    const sourceLabelOf = (key: string): string => {
      const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)]
      if (kind === 'block') return blockById(id)?.label ?? id
      const mixedOp = settings.mixedOps.find((m) => m.id === id)
      return mixedOp?.label ?? (mixedOp ? skeletonMeta(mixedOp.skeleton).label : id)
    }
    const sourceGroups = new Map<string, AttemptStat[]>()
    for (const a of log) {
      const key = sourceKeyOf(a)
      if (!key) continue
      const arr = sourceGroups.get(key)
      if (arr) arr.push(a)
      else sourceGroups.set(key, [a])
    }
    const bySource = Array.from(sourceGroups.entries()).map(([key, attempts]) => {
      const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)]
      const relevantStates = nextStates.filter((s) =>
        kind === 'block' ? s.blockId === id : s.mixedOpId === id,
      )
      const proficiency =
        relevantStates.length > 0
          ? Math.round(
              relevantStates.reduce((sum, s) => sum + s.proficiency, 0) / relevantStates.length,
            )
          : 0
      return {
        label: sourceLabelOf(key),
        total: attempts.length,
        firstTryCorrect: attempts.filter((a) => a.firstTryCorrect).length,
        proficiency,
      }
    })

    // ── Newly-exposed weak spots: distinct wrong-final question displays ──
    const newWeak = Array.from(
      new Set(
        log
          .filter((a) => !a.finallyCorrect)
          .map((a) => a.display)
          .filter((d): d is string => !!d),
      ),
    ).slice(0, 8)

    // ── Next-focus preview: weakest-proficiency sources, ascending ──
    const nextFocus = [...bySource]
      .sort((a, b) => a.proficiency - b.proficiency)
      .slice(0, 5)
      .map((s) => s.label)

    setFinalStats({
      correct: correctCount,
      retry: retryCount,
      wrong: wrongCount,
      total: log.length,
      challenge: challengeCorrect,
      timeSec: finalElapsed,
      avgMs,
      prevAvgMs,
      bySource,
      newWeak,
      nextFocus,
    })

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
    settings.mixedOps,
    update,
    startedTsMs,
    startedAtIso,
    requestedTimeLimit,
    problemState,
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
  // Shared outcome bookkeeping for a settled question (correct, or final-wrong with
  // no further retry). Updates streak/coins/log/mistakes/feedback and schedules advance.
  const settleQuestion = useCallback(
    (
      q: CalcQuestion,
      isCorrect: boolean,
      isFirstTry: boolean,
      elapsedMs: number,
      withinLimit: boolean,
      wasMistake: boolean,
      userAnswer: string,
    ) => {
      const goNext = () => {
        setFeedback(null)
        setInput('')
        setAttemptsForCurrent(0)
        setLastResult(null)
        setSecondTryCorrect(false)
        setRevealAnswer(null)
        if (!questions) return
        if (idx + 1 < questions.length) {
          setIdx((i) => i + 1)
          return
        }
        if (wrongQueueRef.current.length > 0) {
          const drained = wrongQueueRef.current
          wrongQueueRef.current = []
          setQuestions((prev) => (prev ? [...prev, ...drained] : prev))
          setIdx((i) => i + 1)
          return
        }
        void finishSession()
      }

      if (isCorrect) {
        const reward = isFirstTry ? coinReward(q, streak) : 0
        const isChallengeCorrect = q.isChallenge && isFirstTry
        const bonus = isFirstTry ? (streak >= 10 ? 2 : streak >= 5 ? 1 : 0) : 0
        if (isFirstTry && reward > 0) setLastResult({ stars: reward, bonus })
        setSecondTryCorrect(!isFirstTry)
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
          sourceBlockId: q.sourceBlockId,
          sourceMixedOpId: q.sourceMixedOpId,
        })
        if (wasMistake) void recordCorrect(q.signature, settings.sessionCounter + 1)
        window.setTimeout(goNext, isChallengeCorrect ? 1100 : 750)
        return
      }

      // final wrong
      setFeedback('wrong')
      setRevealAnswer(formatAnswer(q.answer))
      setStreak(0)
      playSfx('wrong', settings.soundEnabled)
      const errorTag = diagnose(q, userAnswer)
      void addMistake(q, settings.sessionCounter + 1, userAnswer, errorTag)
      attemptsLogRef.current.push({
        signature: q.signature,
        level: q.level,
        isChallenge: q.isChallenge,
        firstTryCorrect: false,
        finallyCorrect: false,
        wasMistake,
        timeMs: elapsedMs,
        withinLimit: false,
        sourceBlockId: q.sourceBlockId,
        sourceMixedOpId: q.sourceMixedOpId,
        display: q.display.replace(/\s*=\s*\?\s*$/, ''),
      })
      if (!q.isChallenge && mode !== 'mistakes') wrongQueueRef.current.push({ ...q })
      window.setTimeout(goNext, 1700)
    },
    [
      questions,
      idx,
      streak,
      mode,
      settings.soundEnabled,
      settings.sessionCounter,
      addMistake,
      recordCorrect,
      finishSession,
    ],
  )

  // Self-grading pads (竖式 / 余数 / 分数) lock + show inline 红/绿 on submit. They
  // run the SAME two-try loop as the number pad: first wrong → 「再想想」 + remount
  // the pad (padKey carries attemptsForCurrent, so 0→1 clears the locked cells);
  // second wrong → settle as final wrong. First-try correctness still drives reward.
  const settleSelfGraded = useCallback(
    (q: CalcQuestion, isCorrect: boolean, userAnswer: string) => {
      const elapsedMs = Math.round(performance.now() - questionStartRef.current)
      const limitMs = timeLimitFromSettings(q.level, settings)
      const withinLimit = limitMs > 0 ? elapsedMs <= limitMs : true
      if (attemptsForCurrent === 0) questionTimesRef.current.push(elapsedMs)
      const wasMistake = mistakes.some((m) => !m.resolved && m.signature === q.signature)

      if (isCorrect) {
        settleQuestion(q, true, attemptsForCurrent === 0, elapsedMs, withinLimit, wasMistake, userAnswer)
        return
      }
      // first miss → keep the red cells visible briefly, then remount for a retry.
      if (attemptsForCurrent === 0) {
        setFeedback('retry')
        setStreak(0)
        playSfx('retry', settings.soundEnabled)
        window.setTimeout(() => {
          setFeedback(null)
          setAttemptsForCurrent(1)
        }, 900)
      } else {
        settleQuestion(q, false, false, elapsedMs, withinLimit, wasMistake, userAnswer)
      }
    },
    [attemptsForCurrent, mistakes, settings, settleQuestion],
  )

  // 竖式: VerticalCalc/DivisionVertical self-grade and emit the typed answer.
  const handleVerticalSubmit = useCallback(
    (isCorrect: boolean, userAnswer: string) => {
      if (!questions || done || feedback) return
      settleSelfGraded(questions[idx], isCorrect, userAnswer)
    },
    [questions, done, feedback, idx, settleSelfGraded],
  )

  // 余数: RemainderPad collects 商/余 and submits a "q…r" string, graded by checkAnswer.
  const handleRemainderSubmit = useCallback(
    (combined: string) => {
      if (!questions || done || feedback) return
      const q = questions[idx]
      settleSelfGraded(q, checkAnswer(combined, q.answer), combined)
    },
    [questions, done, feedback, idx, settleSelfGraded],
  )

  // 分数: FractionPad submits "num/den". checkAnswer accepts any equivalent fraction;
  // a correct-but-reducible answer gets a gentle 约分 hint (still counts as correct).
  const handleFractionSubmit = useCallback(
    (combined: string) => {
      if (!questions || done || feedback) return
      const q = questions[idx]
      const correct = checkAnswer(combined, q.answer)
      if (correct && isReducibleFraction(combined)) setReduceHint(true)
      settleSelfGraded(q, correct, combined)
    },
    [questions, done, feedback, idx, settleSelfGraded],
  )

  const handleSubmit = useCallback(() => {
    if (!questions || done || feedback) return
    const q = questions[idx]
    const userAns = Number(input)
    if (!Number.isFinite(userAns)) return

    const isCorrect = checkAnswer(input, q.answer)
    const wasMistake = mistakes.some((m) => !m.resolved && m.signature === q.signature)

    const elapsedMs = Math.round(performance.now() - questionStartRef.current)
    const limitMs = timeLimitFromSettings(q.level, settings)
    const withinLimit = limitMs > 0 ? elapsedMs <= limitMs : true
    if (attemptsForCurrent === 0) questionTimesRef.current.push(elapsedMs)

    if (isCorrect) {
      settleQuestion(q, true, attemptsForCurrent === 0, elapsedMs, withinLimit, wasMistake, input)
      return
    }

    // wrong: first miss → retry; second miss → settle as final wrong.
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
      settleQuestion(q, false, false, elapsedMs, withinLimit, wasMistake, input)
    }
  }, [
    questions,
    done,
    feedback,
    idx,
    input,
    attemptsForCurrent,
    mistakes,
    settings,
    settleQuestion,
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
  const planned = plannedCount || questions.length

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

      <main
        // Fill the viewport below the sticky CalcAppHeader (h-14 = 56px) so the
        // CalcQuestionStage can center the equation and pin the keypad to the bottom.
        // A *definite* height (not min-height) is required so the 竖式's
        // `container-type: size` answer area resolves its cqh units instead of
        // collapsing — otherwise the grid shrinks to its clamp-min and overlaps the keypad.
        className="relative mx-auto flex w-full max-w-[640px] flex-col px-4 pt-3 pb-6"
        style={{ height: 'calc(100svh - 56px)' }}
      >
        <CalcSessionStatusBar
          remainingSec={remainingSec}
          idx={idx}
          planned={planned}
          total={questions.length}
          streak={streak}
          coinsTotal={coinsTotal}
          lastResult={lastResult}
        />

        <CalcFeedbackBanner
          feedback={feedback}
          reduceHint={reduceHint}
          lastResult={lastResult}
          revealAnswer={revealAnswer}
          secondTry={secondTryCorrect}
        />

        <CalcQuestionStage
          padKey={`${idx}:${attemptsForCurrent}`}
          question={currentQ}
          isChallenge={currentQ.isChallenge}
          disabled={!!feedback || done}
          className=""
          input={input}
          onInputChange={setInput}
          onNumberSubmit={handleSubmit}
          onFractionSubmit={handleFractionSubmit}
          onRemainderSubmit={handleRemainderSubmit}
          onVerticalSubmit={handleVerticalSubmit}
        />
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
          bySource={finalStats.bySource}
          newWeak={finalStats.newWeak}
          nextFocus={finalStats.nextFocus}
          levelUpTo={null}
          levelDownTo={null}
          reviewMilestone={null}
          nextSessionAssault={false}
          onAgain={() => {
            void refreshMistakes()
            setQuestions(null)
            setIdx(0)
            wrongQueueRef.current = []
            plannedCountRef.current = 0
            setPlannedCount(0)
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
