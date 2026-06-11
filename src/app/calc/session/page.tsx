'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useCalcSettings } from '@/hooks/useCalcSettings'
import { useCalcWallet } from '@/hooks/useCalcWallet'
import { useStarHud } from '@/components/stars/StarHudProvider'
import { useCalcMistakes } from '@/hooks/useCalcMistakes'
import { useCalcLevel } from '@/hooks/useCalcLevel'
import {
  useCalcProblemState,
  applyAttempt,
  justCrossedFour,
  justReviewPassed,
  justReviewFailed,
  justShortMastered,
  justMasteredDemoted,
} from '@/hooks/useCalcProblemState'
import { useCalcLevelState } from '@/hooks/useCalcLevelState'
import CalcAppHeader from '@/components/calc/CalcAppHeader'
import QuestionDisplay from '@/components/calc/QuestionDisplay'
import NumberPad from '@/components/calc/NumberPad'
import { type FeedbackKind } from '@/components/calc/FeedbackOverlay'
import ChallengeBanner from '@/components/calc/ChallengeBanner'
import SessionSummary from '@/components/calc/SessionSummary'
import { buildSession, calcTimeBonus, coinReward } from '@/utils/calc-helpers'
import { interleaveWrong } from '@/utils/calc-session-builder'
import { writeCalcEvent } from '@/utils/calc-event-log'
import { timeLimitFromSettings } from '@/utils/calc-time-limits'
import { applyLevelSessionResult, evaluateABC, isAssaultMode } from '@/utils/calc-level-eval'
import { bankFor } from '@/utils/calc-bank'
import { MAX_NUMERIC_LEVEL } from '@/utils/calc-levels'
import AssaultBanner from '@/components/calc/AssaultBanner'
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
  const { checkAndAdvance } = useCalcLevel(user, settings, update)
  const problemState = useCalcProblemState(user)
  const levelState = useCalcLevelState(user)

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
  const [assaultActive, setAssaultActive] = useState(false)

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
  const [levelUpTo, setLevelUpTo] = useState<number | null>(null)
  const [levelDownTo, setLevelDownTo] = useState<number | null>(null)
  const [reviewMilestone, setReviewMilestone] = useState<string | null>(null)
  const [nextSessionAssault, setNextSessionAssault] = useState(false)
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

    const init = async () => {
      // Seed banks for current level (and one below for future P4 mixing)
      await problemState.seedBank(settings.currentLevel)
      if (typeof settings.currentLevel === 'number' && settings.currentLevel > 1) {
        await problemState.seedBank((settings.currentLevel - 1) as CalcLevel)
      }
      const levelsToLoad: CalcLevel[] = [settings.currentLevel]
      if (typeof settings.currentLevel === 'number' && settings.currentLevel > 1) {
        levelsToLoad.push((settings.currentLevel - 1) as CalcLevel)
      }
      await problemState.loadForLevels(levelsToLoad)
      await levelState.loadForLevels(levelsToLoad)

      const levelInfo = levelState.getLevelState(settings.currentLevel)
      // Assault mode + warmup state apply only in normal daily mode (the state
      // machine is bypassed in free / mistakes modes).
      const phase5Active = mode === 'daily' && !settings.freeMode
      const assault = phase5Active && isAssaultMode(levelInfo)
      const session = buildSession(
        settings,
        requestedCount,
        mistakes,
        {
          problemStates: problemState.states,
          userId: user.id,
          sessionNo: settings.sessionCounter + 1,
          today: todayStr(),
          assaultMode: assault,
          warmupComplete: phase5Active ? levelInfo.warmupComplete : true,
        },
        mode,
      )
      if (assault) {
        setAssaultActive(true)
        void writeCalcEvent({
          userId: user.id,
          type: 'assault_mode_on',
          level: settings.currentLevel,
          detail: {
            lastAccuracy: levelInfo.lastSessionAccuracy,
            sessionNo: settings.sessionCounter + 1,
          },
        })
      }
      setQuestions(session)
      setStartedAtIso(new Date().toISOString())
      setStartedTsMs(Date.now())
      questionStartRef.current = performance.now()
    }
    void init()
  }, [settings, settingsLoading, mistakes, requestedCount, mode, user, problemState, levelState, sessionKey])

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
    const nextSessionNo = settings.sessionCounter + 1
    update({ sessionCounter: nextSessionNo })

    // 3. Update per-problem states (skip 'mistakes' mode — those signatures may not be in current bank)
    // Hoisted so the Phase 5 ABC evaluation below can reference the freshly-updated states.
    const nextStates: CalcProblemState[] = []
    if (mode !== 'mistakes') {
      const today = todayStr()
      const groupedBySig = new Map<string, AttemptStat[]>()
      for (const a of log) {
        if (a.isChallenge) continue // challenge questions aren't tracked per-signature for now
        const arr = groupedBySig.get(a.signature) ?? []
        arr.push(a)
        groupedBySig.set(a.signature, arr)
      }
      for (const [signature, attempts] of groupedBySig) {
        const sample = attempts[0]
        let state = problemState.getState(signature, sample.level)
        for (const a of attempts) {
          const attempt = {
            correct: a.finallyCorrect,
            timeMs: a.timeMs,
            withinLimit: a.withinLimit,
          }
          const prevSnap = state

          // event: consecutive_wrong crosses 4 (master.md §6.1 type C)
          if (user && justCrossedFour(prevSnap, attempt)) {
            void writeCalcEvent({
              userId: user.id,
              type: 'forced_problem',
              level: prevSnap.level,
              signature: prevSnap.signature,
              detail: { reason: 'consecutive_wrong>=4', sessionNo: nextSessionNo },
            })
          }

          state = applyAttempt(state, attempt, a.withinLimit, nextSessionNo, today)

          if (user) {
            const passedRound = justReviewPassed(prevSnap, state)
            if (passedRound !== null) {
              void writeCalcEvent({
                userId: user.id,
                type: 'review_pass',
                level: state.level,
                signature: state.signature,
                detail: { round: passedRound, sessionNo: nextSessionNo },
              })
            }
            if (justReviewFailed(prevSnap, state)) {
              void writeCalcEvent({
                userId: user.id,
                type: 'review_fail',
                level: state.level,
                signature: state.signature,
                detail: { sessionNo: nextSessionNo },
              })
            }
            if (justShortMastered(prevSnap, state)) {
              // No dedicated event type yet — log under review_pass with round=short
              void writeCalcEvent({
                userId: user.id,
                type: 'review_pass',
                level: state.level,
                signature: state.signature,
                detail: { round: 'short_mastered', sessionNo: nextSessionNo },
              })
            }
            if (justMasteredDemoted(prevSnap, state)) {
              void writeCalcEvent({
                userId: user.id,
                type: 'review_fail',
                level: state.level,
                signature: state.signature,
                detail: { reason: 'mastered_audit_wrong', sessionNo: nextSessionNo },
              })
            }
          }
        }
        nextStates.push(state)
      }
      if (nextStates.length > 0) await problemState.upsertStates(nextStates)
    }

    // 4. Phase 5 — evaluate ABC + level state machine
    // Skipped in free-practice mode: questions span arbitrary levels, so the
    // "focus level" state machine + adaptive level-up cannot meaningfully apply.
    const atLevelLog = log.filter((a) => !a.isChallenge && a.level === settings.currentLevel)
    if (settings.freeMode && mode !== 'mistakes') {
      // Free practice: evaluate EACH selected numeric level independently (per-level
      // A/B/C + level-up). A level that masters is swapped for level+1 in the picker.
      const today = todayStr()
      const statesNow = new Map(problemState.states)
      for (const s of nextStates) statesNow.set(s.signature, s)

      const freeLevels = settings.freeModeLevels.filter((l): l is number => typeof l === 'number')
      let nextFreeLevels = [...settings.freeModeLevels]
      let promotedTo: number | null = null

      for (const L of freeLevels) {
        const lvlLog = log.filter((a) => !a.isChallenge && a.level === L)
        if (lvlLog.length === 0) continue
        const firstTryCorrect = lvlLog.filter((a) => a.firstTryCorrect).length
        const withinLimitCount = lvlLog.filter((a) => a.withinLimit).length
        const bank = bankFor(L as CalcLevel, user?.id ?? 'anonymous') ?? []
        const abc = evaluateABC(L as CalcLevel, statesNow, bank, {
          count: lvlLog.length,
          firstTryCorrect,
          withinLimitCount,
        })
        const { next, transitions, bumpCurrentLevel } = applyLevelSessionResult({
          prev: levelState.getLevelState(L as CalcLevel),
          abc,
          atLevel: { count: lvlLog.length, firstTryCorrect, withinLimitCount },
          minLevel: L, // disable demotion in free mode — only level-up applies
          today,
        })
        await levelState.upsertLevelState(next)

        if (user) {
          for (const t of transitions) {
            if (t.type === 'level_up') {
              void writeCalcEvent({
                userId: user.id,
                type: 'level_up',
                level: L as CalcLevel,
                detail: { to: t.to, sessionNo: nextSessionNo, free: true },
              })
            }
          }
        }

        if (bumpCurrentLevel && L < MAX_NUMERIC_LEVEL) {
          const newL = L + 1
          nextFreeLevels = nextFreeLevels.filter((x) => x !== L)
          if (!nextFreeLevels.includes(newL)) nextFreeLevels.push(newL)
          if (promotedTo === null) promotedTo = newL
        }
      }

      if (promotedTo !== null) {
        update({ freeModeLevels: nextFreeLevels })
        setLevelUpTo(promotedTo)
        playSfx('levelup', settings.soundEnabled)
      }
    } else if (atLevelLog.length > 0 && mode === 'daily') {
      const today = todayStr()
      const firstTryCorrect = atLevelLog.filter((a) => a.firstTryCorrect).length
      const withinLimitCount = atLevelLog.filter((a) => a.withinLimit).length
      const currentBank = bankFor(settings.currentLevel, user?.id ?? 'anonymous') ?? []

      // Use the freshly-updated problem states (already in problemState.states after upsert)
      const statesNow = new Map(problemState.states)
      for (const s of nextStates) statesNow.set(s.signature, s)

      const abc = evaluateABC(settings.currentLevel, statesNow, currentBank, {
        count: atLevelLog.length,
        firstTryCorrect,
        withinLimitCount,
      })
      const prevLevelInfo = levelState.getLevelState(settings.currentLevel)
      const {
        next: nextLevelInfo,
        transitions,
        bumpCurrentLevel,
        demote,
      } = applyLevelSessionResult({
        prev: prevLevelInfo,
        abc,
        atLevel: { count: atLevelLog.length, firstTryCorrect, withinLimitCount },
        minLevel: 1,
        today,
      })

      await levelState.upsertLevelState(nextLevelInfo)

      // Write transition events + capture user-facing milestones
      for (const t of transitions) {
        if (!user) continue
        if (t.type === 'abc_passed') {
          setReviewMilestone(`关卡 A/B/C 达标！第 2 天再来复测一次`)
          void writeCalcEvent({
            userId: user.id,
            type: 'review_pass',
            level: settings.currentLevel,
            detail: { round: 'abc_passed', sessionNo: nextSessionNo },
          })
        } else if (t.type === 'review_pass') {
          const labelByRound = { r1: '通过第 1 轮复测', r2: '通过第 2 轮复测', r3: '通过第 3 轮复测' }
          setReviewMilestone(labelByRound[t.round])
          void writeCalcEvent({
            userId: user.id,
            type: 'review_pass',
            level: settings.currentLevel,
            detail: { round: `level_${t.round}`, sessionNo: nextSessionNo },
          })
        } else if (t.type === 'review_fail') {
          setReviewMilestone(`第 ${t.round.toUpperCase()} 复测未通过，回到日常练习`)
          void writeCalcEvent({
            userId: user.id,
            type: 'review_fail',
            level: settings.currentLevel,
            detail: { round: `level_${t.round}`, accuracy: t.accuracy, sessionNo: nextSessionNo },
          })
        } else if (t.type === 'level_up') {
          void writeCalcEvent({
            userId: user.id,
            type: 'level_up',
            level: settings.currentLevel,
            detail: { to: t.to, sessionNo: nextSessionNo },
          })
        } else if (t.type === 'level_down') {
          void writeCalcEvent({
            userId: user.id,
            type: 'level_down',
            level: settings.currentLevel,
            detail: { to: t.to, reason: t.reason, sessionNo: nextSessionNo },
          })
        }
      }

      // Will the NEXT session be in assault mode? (master.md §6.3 — based on
      // the accuracy we just recorded.)
      const accuracyNow = atLevelLog.length > 0 ? firstTryCorrect / atLevelLog.length : 0
      if (nextLevelInfo.warmupComplete && accuracyNow < 0.75 && !bumpCurrentLevel && !demote) {
        setNextSessionAssault(true)
      }

      if (bumpCurrentLevel) {
        const newLevel = Math.min(MAX_NUMERIC_LEVEL, settings.currentLevel + 1)
        update({ currentLevel: newLevel })
        setLevelUpTo(newLevel)
        playSfx('levelup', settings.soundEnabled)
      } else if (demote && settings.currentLevel > 1) {
        const newLevel = settings.currentLevel - 1
        setLevelDownTo(newLevel)
        await problemState.resetLevelForDemotion(newLevel as CalcLevel)
        // Reset the demoted-to level's status to practicing as well (clear any prior abc/reviews)
        const demotedLevelInfo = levelState.getLevelState(newLevel as CalcLevel)
        await levelState.upsertLevelState({
          ...demotedLevelInfo,
          status: 'practicing',
          abcPassedDate: null,
          reviewR1Date: null,
          reviewR2Date: null,
          reviewR3Date: null,
          consecutivePoorSessions: 0,
        })
        update({ currentLevel: newLevel })
      }
    } else if (atLevelLog.length > 0) {
      // 'mistakes' mode — still bump warmup counters but skip transitions
      const firstTryCorrect = atLevelLog.filter((a) => a.firstTryCorrect).length
      const accuracy = atLevelLog.length > 0 ? firstTryCorrect / atLevelLog.length : 0
      await levelState.recordSessionAtLevel(settings.currentLevel, atLevelLog.length, accuracy)
    }

    // 5. Legacy adaptive level advancement — disabled in Phase 5 (A/B/C above governs).
    void checkAndAdvance

    playSfx('complete', settings.soundEnabled)
    launchConfetti(30)
  }, [
    done,
    user,
    wallet,
    refreshStarHud,
    mode,
    settings.currentLevel,
    settings.soundEnabled,
    settings.sessionCounter,
    settings.freeMode,
    settings.freeModeLevels,
    update,
    checkAndAdvance,
    problemState,
    levelState,
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
        {assaultActive && <AssaultBanner />}
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
          levelUpTo={levelUpTo}
          levelDownTo={levelDownTo}
          reviewMilestone={reviewMilestone}
          nextSessionAssault={nextSessionAssault}
          onAgain={() => {
            void refreshMistakes()
            setQuestions(null)
            setIdx(0)
            setInput('')
            setAttemptsForCurrent(0)
            setFeedback(null)
            setRevealAnswer(null)
            setShowChallengeBanner(false)
            setAssaultActive(false)
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
            setLevelUpTo(null)
            setLevelDownTo(null)
            setReviewMilestone(null)
            setNextSessionAssault(false)
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
