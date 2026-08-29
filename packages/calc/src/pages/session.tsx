'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@rosie/core'
import { useCalcSettings } from '../hooks/useCalcSettings'
import { useCalcWallet, loadWalletSessions, calcWalletStore } from '@rosie/rewards'
import { useStarHud } from '@rosie/rewards'
import { useCalcMistakes } from '../hooks/useCalcMistakes'
import { useCalcProblemState } from '../hooks/useCalcProblemState'
import { applyAttempt } from '../utils/calc-apply-attempt'
import { applyMasterySideEffects, unresolvedMistakes } from '../utils/calc-mastery-sync'
import { calcMistakesStore } from '../utils/calc-mistakes-store'
import {
  calcProblemStateStore,
  fetchMasteredRecallCandidates,
} from '../utils/calc-problem-state-store'
import CalcAppHeader from '../components/CalcAppHeader'
import CalcQuestionStage from '../components/CalcQuestionStage'
import CalcSessionStatusBar from '../components/CalcSessionStatusBar'
import { type FeedbackKind } from '../components/FeedbackOverlay'
import ChallengeBanner from '../components/ChallengeBanner'
import SessionSummary from '../components/SessionSummary'
import DrillSummary from '../components/DrillSummary'
import {
  buildSession,
  buildDrillSession,
  coinReward,
  type DrillParams,
} from '../utils/calc-helpers'
import { calcPlannedQuestionCount } from '../utils/calc-planned-question-count'
import {
  applySessionStarMultiplier,
  clampBonusSec,
  isInMakeupPhase,
  maxRetryCeiling,
  resolveClockSec,
  resolveTargetSec,
  tryEnqueueRetry,
} from '../utils/calc-session-policy'
import { tierOf, nextTierGap, suggestedTiers } from '../utils/calc-time-targets'
import { effectiveLimitSec, sourceIdForLimit } from '../utils/calc-effective-limit'
import { checkAnswer, formatAnswer, shouldAutoSubmitNumberPad } from '../utils/calc-answer'
import { diagnose } from '../utils/calc-diagnose'
import { parseSignature } from '../utils/calc-ast'
import { presentationKeyOf } from '../utils/calc-concept-key'
import { blockById } from '../utils/calc-blocks'
import { skeletonMeta } from '../utils/calc-mixed'
import { buildBySourceFromLog, buildNewWeakFromLog } from '../utils/calc-session-summary'
import { playSfx } from '../components/audio'
import { launchConfetti } from '@rosie/core'
import { todayStr } from '@rosie/core'
import { usePracticePendingLifecycle } from '@rosie/core'
import SessionPrepScreen from '../components/SessionPrepScreen'
import type {
  CalcLevel,
  CalcMode,
  CalcPresentationKey,
  CalcProblemState,
  CalcQuestion,
  CalcTimingMode,
  QuestionLogEntry,
} from '@rosie/core'
import {
  calcPendingScopeKey,
  calcSessionDrillKey,
  clearCalcPendingEverywhere,
  resolveCalcSessionSnapshot,
  writeCalcSessionSnapshot,
  wrapCalcEnvelope,
  type CalcAttemptStatSnapshot,
  type CalcSessionSnapshot,
} from '../utils/calc-session-snapshot'

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
  evidenceKind?: 'independent' | 'makeup' | 'recall'
  /** Attribution: which single-op block this question came from. */
  sourceBlockId?: string
  /** Attribution: which mixed-op generator this question came from. */
  sourceMixedOpId?: string
  /** Question display with trailing "= ?" stripped, for wrong-answer review. */
  display?: string
  /** Presentation mode the question was answered in (drives the limit coefficient). */
  presentationKey?: CalcPresentationKey
}

export default function CalcSessionPage() {
  const params = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const { settings, update, isLoading: settingsLoading } = useCalcSettings(user)
  const wallet = useCalcWallet(user, { loadSessions: true })
  const { refresh: refreshStarHud } = useStarHud()
  const {
    mistakes,
    unresolved,
    addMistake,
    recordCorrect,
    refresh: refreshMistakes,
  } = useCalcMistakes(user)
  const problemState = useCalcProblemState(user)

  const mode: CalcMode = useMemo(() => {
    const m = params.get('mode')
    return m === 'free' || m === 'mistakes' ? m : 'daily'
  }, [params])

  /** Homepage「今日计划」口算卡：跳过准备页，直接开练 */
  const autoStart = params.get('start') === '1'
  const drillKey = useMemo(
    () => calcSessionDrillKey(mode, params.get('drill'), params.get('blockId')),
    [mode, params],
  )

  const drillParams = useMemo<DrillParams | null>(() => {
    const d = params.get('drill')
    if (!d) return null
    if (d === 'weak-formulas') return { type: 'weak-formulas' }
    if (d === 'breakthrough') {
      const blockId = params.get('blockId')
      if (blockId) return { type: 'breakthrough', blockId }
    }
    return null
  }, [params])

  const drillRound = useMemo(() => {
    const r = params.get('round')
    return r ? parseInt(r, 10) : 1
  }, [params])

  // Client-only peek for mid-exit resume (avoid SSR/hydration mismatch).
  const [snapChecked, setSnapChecked] = useState(false)
  const [pendingSnap, setPendingSnap] = useState<CalcSessionSnapshot | null>(null)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      const snap = await resolveCalcSessionSnapshot(user.id, mode, drillKey)
      if (cancelled) return
      setPendingSnap(snap)
      setSnapChecked(true)
    })()
    return () => {
      cancelled = true
    }
  }, [user, mode, drillKey])
  const resumeFromSnap = pendingSnap != null

  const [drillTargetSignatures, setDrillTargetSignatures] = useState<string[]>([])
  const loadedStatesRef = useRef<Map<string, CalcProblemState>>(new Map())

  // ── Prep gate (daily only) ──────────────────────────────────────
  // Drills and mistakes-only sessions skip the prep screen entirely and keep
  // today's behavior (relaxed clock, no end-of-session star multiplier).
  // autoStart (from homepage today cards) and mid-session resume also skip prep.
  const needsPrep = mode === 'daily' && !drillParams && !autoStart && !resumeFromSnap
  const [prepConfirmed, setPrepConfirmed] = useState(autoStart)
  // Editable prep selections default to the persisted settings until the user
  // overrides them for this run only (admin settings page owns persisted defaults).
  const [prepModeOverride, setPrepModeOverride] = useState<CalcTimingMode | null>(null)
  const [prepBonusOverride, setPrepBonusOverride] = useState<number | null>(null)
  const [answerModeOverride, setAnswerModeOverride] = useState<{
    idx: number
    mode: 'pad' | 'vertical'
  } | null>(null)
  const prepTimingMode = prepModeOverride ?? settings.timingMode
  const prepBonusSec = prepBonusOverride ?? settings.bonusSec
  // Frozen at confirm time — the session's timing authority for its whole run,
  // read from refs inside stable callbacks (clock, auto-advance, star multiplier).
  const sessionTimingModeRef = useRef<CalcTimingMode>('relaxed')
  const sessionBonusSecRef = useRef<number>(0)

  // When a same-day snapshot exists, skip prep as soon as we've checked storage.
  useEffect(() => {
    if (resumeFromSnap) setPrepConfirmed(true)
  }, [resumeFromSnap])

  const plannedEstimate = calcPlannedQuestionCount(settings)

  const handlePrepStart = useCallback(() => {
    sessionTimingModeRef.current = prepTimingMode
    sessionBonusSecRef.current = clampBonusSec(prepBonusSec)
    playSfx('coin', settings.soundEnabled)
    setPrepConfirmed(true)
  }, [prepTimingMode, prepBonusSec, settings.soundEnabled])

  // Clock time per the confirmed session timing mode. Relaxed sessions keep
  // this clock for proficiency measurement, but do not display it in the UI.
  const secondsForQuestion = useCallback(
    (q: CalcQuestion): number | null => {
      let explicit: number | null | undefined = null
      let sourceId = sourceIdForLimit(q)
      if (q.sourceBlockId) {
        explicit = settings.selectedBlocks.find((b) => b.id === q.sourceBlockId)?.seconds
      } else if (q.sourceMixedOpId) {
        const op = settings.mixedOps.find((m) => m.id === q.sourceMixedOpId)
        explicit = op?.seconds
        if (op) sourceId = op.skeleton
      }
      const targetSec = resolveTargetSec({
        explicitSeconds: explicit,
        sourceId,
        presentationKey: presentationKeyOf(q),
      })
      return resolveClockSec({
        mode: sessionTimingModeRef.current,
        targetSec,
        bonusSec: sessionBonusSecRef.current,
        timedAnswerEnabled: settings.timedAnswerEnabled,
        explicitSeconds: explicit,
      })
    },
    [settings.timedAnswerEnabled, settings.selectedBlocks, settings.mixedOps],
  )

  /** Cognitive withinLimit — always has a threshold (explicit ∥ TIME_TARGETS.fluent). */
  const withinLimitForQuestion = useCallback(
    (q: CalcQuestion, elapsedMs: number): boolean => {
      let explicit: number | null | undefined = null
      let sourceId = sourceIdForLimit(q)
      if (q.sourceBlockId) {
        explicit = settings.selectedBlocks.find((b) => b.id === q.sourceBlockId)?.seconds
      } else if (q.sourceMixedOpId) {
        const op = settings.mixedOps.find((m) => m.id === q.sourceMixedOpId)
        explicit = op?.seconds
        // TIME_TARGETS keys are skeleton ids for mixed ops
        if (op) sourceId = op.skeleton
      }
      return (
        elapsedMs <=
        effectiveLimitSec({
          timedAnswerEnabled: settings.timedAnswerEnabled,
          explicitSeconds: explicit,
          sourceId,
          presentationKey: presentationKeyOf(q),
        }) *
          1000
      )
    },
    [settings.timedAnswerEnabled, settings.selectedBlocks, settings.mixedOps],
  )

  const sourceKeyForLog = (q: CalcQuestion): string =>
    q.sourceBlockId
      ? `block:${q.sourceBlockId}`
      : q.sourceMixedOpId
        ? `mixed:${q.sourceMixedOpId}`
        : 'unknown'

  const targetSecForLog = useCallback(
    (q: CalcQuestion): number | null => {
      if (!settings.timedAnswerEnabled) return null
      let sec: number | null | undefined = null
      if (q.sourceBlockId) {
        sec = settings.selectedBlocks.find((b) => b.id === q.sourceBlockId)?.seconds
      } else if (q.sourceMixedOpId) {
        sec = settings.mixedOps.find((m) => m.id === q.sourceMixedOpId)?.seconds
      }
      return sec && sec > 0 ? sec : null
    },
    [settings.timedAnswerEnabled, settings.selectedBlocks, settings.mixedOps],
  )

  const labelForLog = useCallback(
    (q: CalcQuestion): string | undefined => {
      if (q.sourceBlockId) return blockById(q.sourceBlockId)?.label
      if (q.sourceMixedOpId) {
        const op = settings.mixedOps.find((m) => m.id === q.sourceMixedOpId)
        if (!op) return undefined
        return op.label ?? skeletonMeta(op.skeleton).label
      }
      return undefined
    },
    [settings.mixedOps],
  )

  const pushQuestionLog = useCallback(
    (q: CalcQuestion, elapsedMs: number, ok: boolean) => {
      const previousOccurrences = questionLogRef.current.filter(
        (entry) => entry.signature === q.signature,
      ).length
      const occurrenceInSession = previousOccurrences + 1
      const previousIndex = questionLogRef.current.findLastIndex(
        (entry) => entry.signature === q.signature,
      )
      const intentionalRepeat =
        occurrenceInSession > 1 &&
        (q.selectionReason === 'carried-mistake' ||
          q.selectionReason === 'same-session-makeup' ||
          q.selectionReason === 'mastered-recall')
      const entry: QuestionLogEntry = {
        key: sourceKeyForLog(q),
        ms: elapsedMs,
        ok,
        display: q.display.replace(/\s*=\s*\?\s*$/, ''),
        targetSec: targetSecForLog(q),
        label: labelForLog(q),
        signature: q.signature,
        selectionReason: q.selectionReason,
        occurrenceInSession,
        intentionalRepeat,
        previousDistance:
          previousIndex >= 0 ? questionLogRef.current.length - previousIndex - 1 : null,
      }
      questionLogRef.current.push(entry)
    },
    [targetSecForLog, labelForLog],
  )

  const patchQuestionLogFinallyOk = useCallback((q: CalcQuestion, finallyOk: boolean) => {
    const key = sourceKeyForLog(q)
    const log = questionLogRef.current
    for (let i = log.length - 1; i >= 0; i--) {
      if (log[i].key === key && log[i].finallyOk === undefined) {
        log[i] = { ...log[i], finallyOk }
        return
      }
    }
  }, [])

  // ── Session state ────────────────────────────────────────────────
  const [questions, setQuestions] = useState<CalcQuestion[] | null>(null)
  const [idx, setIdx] = useState(0)
  // Wrong questions collected during the session, appended to the tail for make-up.
  const wrongQueueRef = useRef<CalcQuestion[]>([])
  const maxRetryRef = useRef(0)
  // Number of originally-planned questions (excludes make-up tail).
  // Ref for use inside event-handler closures; state mirror for render.
  const plannedCountRef = useRef(0)
  const [plannedCount, setPlannedCount] = useState(0)
  const [input, setInput] = useState('')
  // Guards NumberPad auto-submit from double-settling while a settle (correct/retry/wrong)
  // is already in flight for the current question; cleared when advancing to the next one.
  const settleLockRef = useRef(false)
  const [attemptsForCurrent, setAttemptsForCurrent] = useState(0)
  const [feedback, setFeedback] = useState<FeedbackKind>(null)
  const [revealAnswer, setRevealAnswer] = useState<string | null>(null)

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
  // Tagged per-question first-attempt log (atomic per-题型 records).
  const questionLogRef = useRef<QuestionLogEntry[]>([])
  const questionStartRef = useRef<number>(0)
  /** Which `idx` the countdown wall/ref are bound to. Prevents stale wall from
   *  the previous question from zeroing `remainingSec` on the advance render. */
  const clockBoundIdxRef = useRef<number>(-1)
  const [startedTsMs, setStartedTsMs] = useState<number>(0)
  const [startedAtIso, setStartedAtIso] = useState<string>('')
  /** Active time from earlier runs of a resumed session (excludes idle time). */
  const carriedElapsedMsRef = useRef(0)

  const [now, setNow] = useState<number>(() => Date.now())
  const [questionStartWall, setQuestionStartWall] = useState<number>(0)

  /** Bind the per-question clock to `forIdx` (sync — safe to call inside goNext). */
  const bindQuestionClock = useCallback((forIdx: number) => {
    questionStartRef.current = performance.now()
    clockBoundIdxRef.current = forIdx
    setQuestionStartWall(Date.now())
  }, [])
  const [done, setDone] = useState(false)
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
    bySource: {
      label: string
      total: number
      firstTryCorrect: number
      perMinute: number
      avgSec: number
      targetSec: number | null
    }[]
    /** Distinct wrong-question displays from this session (final answer wrong), capped. */
    newWeak: string[]
    /** Source labels to focus on next time, weakest-first. */
    nextFocus: string[]
  } | null>(null)

  const [sessionKey, setSessionKey] = useState(0)
  const [stashToast, setStashToast] = useState<string | null>(null)

  const buildCurrentSnapshot = useCallback((): CalcSessionSnapshot | null => {
    if (done || !questions || questions.length === 0 || !startedAtIso) return null
    // Nothing answered yet is not a resumable session — snapshotting it would skip
    // the prep screen and replay this frozen question list for the rest of the day.
    if (idx === 0 && attemptsLogRef.current.length === 0) return null
    const snapAttempts: CalcAttemptStatSnapshot[] = attemptsLogRef.current.map((a) => ({
      signature: a.signature,
      level: a.level,
      isChallenge: a.isChallenge,
      firstTryCorrect: a.firstTryCorrect,
      finallyCorrect: a.finallyCorrect,
      wasMistake: a.wasMistake,
      timeMs: a.timeMs,
      withinLimit: a.withinLimit,
      sourceBlockId: a.sourceBlockId,
      sourceMixedOpId: a.sourceMixedOpId,
      display: a.display,
      presentationKey: a.presentationKey,
    }))
    return {
      version: 1,
      date: todayStr(),
      mode,
      drillKey,
      questions,
      idx,
      wrongQueue: wrongQueueRef.current,
      plannedCount: plannedCountRef.current,
      maxRetry: maxRetryRef.current,
      coinsTotal: coinsTotalRef.current,
      streak,
      maxStreak: maxStreakRef.current,
      attemptsLog: snapAttempts,
      questionTimesMs: questionTimesRef.current,
      questionLog: questionLogRef.current,
      startedAtIso,
      startedTsMs,
      carriedElapsedMs: carriedElapsedMsRef.current + Math.max(0, Date.now() - startedTsMs),
      timingMode: sessionTimingModeRef.current,
      bonusSec: sessionBonusSecRef.current,
      drillTargetSignatures,
    }
  }, [
    done,
    questions,
    idx,
    streak,
    mode,
    drillKey,
    startedAtIso,
    startedTsMs,
    drillTargetSignatures,
    coinsTotal,
    maxStreak,
  ])

  const pendingScopeKey = calcPendingScopeKey(mode, drillKey)
  const pendingEnabled = !!questions && questions.length > 0 && !done && !!startedAtIso

  const getEnvelope = useCallback(() => {
    const snap = buildCurrentSnapshot()
    return snap ? wrapCalcEnvelope(snap) : null
  }, [buildCurrentSnapshot])

  const { flushCloudNow } = usePracticePendingLifecycle({
    enabled: pendingEnabled,
    userId: user?.id,
    kind: 'calc',
    scopeKey: pendingScopeKey,
    getEnvelope,
  })

  const handleSessionExit = useCallback(() => {
    void flushCloudNow().then(() => router.push('/calc'))
  }, [flushCloudNow, router])

  const handleStash = useCallback(async () => {
    const synced = await flushCloudNow()
    setStashToast(synced ? '已暂存到云端' : '已暂存在本机，云端备份失败')
    router.push('/calc')
  }, [flushCloudNow, router])

  useEffect(() => {
    if (!stashToast) return
    const timer = window.setTimeout(() => setStashToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [stashToast])

  // Initialize session ONCE after settings + mistakes ready, AND user is loaded
  const initRef = useRef(false)
  useEffect(() => {
    if (initRef.current) return
    if (!snapChecked) return
    if (settingsLoading) return
    if (!user) return
    if (needsPrep && !prepConfirmed) return
    initRef.current = true

    // Homepage auto-start / resume: freeze timing.
    if (pendingSnap) {
      sessionTimingModeRef.current = pendingSnap.timingMode
      sessionBonusSecRef.current = clampBonusSec(pendingSnap.bonusSec)
    } else if (autoStart) {
      sessionTimingModeRef.current = settings.timingMode
      sessionBonusSecRef.current = clampBonusSec(settings.bonusSec)
    }
    if (autoStart || pendingSnap) {
      // Drop ?start=1 so refresh doesn't re-trigger auto-start mid-session edge cases.
      const next = new URLSearchParams(params.toString())
      if (next.has('start')) {
        next.delete('start')
        const qs = next.toString()
        router.replace(`/calc/session${qs ? `?${qs}` : ''}`, { scroll: false })
      }
    }

    const init = async () => {
      if (pendingSnap) {
        await problemState.loadAll()
        await calcMistakesStore.ensureLoaded(user.id)
        const reconciledStates = calcProblemStateStore.getSessionData(user.id) ?? {}
        const loadedStates = new Map<string, CalcProblemState>()
        for (const [sig, st] of Object.entries(reconciledStates)) {
          loadedStates.set(sig, st)
        }
        loadedStatesRef.current = loadedStates

        setQuestions(pendingSnap.questions)
        setIdx(pendingSnap.idx)
        wrongQueueRef.current = pendingSnap.wrongQueue
        plannedCountRef.current = pendingSnap.plannedCount
        setPlannedCount(pendingSnap.plannedCount)
        maxRetryRef.current = pendingSnap.maxRetry
        coinsTotalRef.current = pendingSnap.coinsTotal
        setCoinsTotal(pendingSnap.coinsTotal)
        setStreak(pendingSnap.streak)
        maxStreakRef.current = pendingSnap.maxStreak
        setMaxStreak(pendingSnap.maxStreak)
        attemptsLogRef.current = pendingSnap.attemptsLog as AttemptStat[]
        questionTimesRef.current = pendingSnap.questionTimesMs
        questionLogRef.current = pendingSnap.questionLog
        setStartedAtIso(pendingSnap.startedAtIso)
        // Restart the clock and carry the earlier active time, so the hours between
        // stash and resume don't land in `time_spent_sec`.
        carriedElapsedMsRef.current = pendingSnap.carriedElapsedMs ?? 0
        setStartedTsMs(Date.now())
        setDrillTargetSignatures(pendingSnap.drillTargetSignatures)
        questionStartRef.current = performance.now()
        return
      }

      // Load all of the user's problem states so buildSession can weight toward weak ones.
      // Use the returned map directly — `problemState.states` is still the stale
      // pre-load value within this same closure (React state updates async).
      const loadedStates = await problemState.loadAll()
      // Mistakes MUST be in the store before reconcile / carry — the hook's
      // `mistakes` state may still be empty on a cold visit to /calc/session.
      await calcMistakesStore.ensureLoaded(user.id)
      // Reconcile hanging mistakes vs mastered (deadlock repair)
      await applyMasterySideEffects(user.id, { kind: 'reconcile' })
      // Reconcile may have resolved/demoted rows — refresh the local snapshot.
      const reconciledStates = calcProblemStateStore.getSessionData(user.id) ?? {}
      for (const [sig, st] of Object.entries(reconciledStates)) {
        loadedStates.set(sig, st)
      }

      loadedStatesRef.current = loadedStates

      if (drillParams) {
        const session = buildDrillSession(
          drillParams,
          loadedStates,
          20,
          settings.verticalForBigNumbers,
        )
        if (session.length === 0) {
          router.replace('/calc/report')
          return
        }
        if (drillParams.type === 'weak-formulas') {
          setDrillTargetSignatures(session.map((q) => q.signature))
        }
        plannedCountRef.current = session.length
        setPlannedCount(session.length)
        setQuestions(session)
      } else {
        // SQL-truncated recall candidates (LIMIT recall*3) for the ~5% slot.
        const blockIds = settings.selectedBlocks.map((b) => b.id)
        const recallSlot = Math.max(1, Math.floor(0.05 * settings.lastCount))
        const recallCandidates = await fetchMasteredRecallCandidates(user.id, blockIds, recallSlot)
        // Carry the PREVIOUS session's still-unresolved mistakes as make-up questions.
        // Previous session number == current sessionCounter (it bumps after finish).
        // Read from the store snapshot (post-reconcile), not the hook's state.
        const mistakesNow = calcMistakesStore.getSessionData(user.id) ?? []
        const carried = unresolvedMistakes(mistakesNow, loadedStates).filter(
          (m) => m.sessionNo === settings.sessionCounter,
        )
        // Recent session history for adaptive recovery debounce (no-op if already loaded).
        await loadWalletSessions(user.id)
        const historySessions = calcWalletStore.getSessionData(user.id)?.sessions ?? []
        const session = buildSession(
          settings,
          { problemStates: loadedStates, recallCandidates, sessions: historySessions },
          carried,
        )
        setQuestions(session)
        plannedCountRef.current = session.length
        setPlannedCount(session.length)
        const carriedCount = session.filter(
          (question) => question.selectionReason === 'carried-mistake',
        ).length
        const baseCount = Math.max(0, session.length - carriedCount)
        maxRetryRef.current = Math.max(0, maxRetryCeiling(baseCount) - carriedCount)
      }
      setStartedAtIso(new Date().toISOString())
      setStartedTsMs(Date.now())
      carriedElapsedMsRef.current = 0
      questionStartRef.current = performance.now()
      questionTimesRef.current = []
      questionLogRef.current = []
      attemptsLogRef.current = []
    }
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user,
    settingsLoading,
    drillParams,
    sessionKey,
    needsPrep,
    prepConfirmed,
    snapChecked,
    pendingSnap,
  ])

  // Persist in-progress session so mid-exit / refresh can resume.
  useEffect(() => {
    const snap = buildCurrentSnapshot()
    if (!snap) return
    writeCalcSessionSnapshot(snap)
  }, [buildCurrentSnapshot])

  // Bind clock on idx/questions change when goNext hasn't already (init / resume).
  useEffect(() => {
    if (!questions || idx >= questions.length) return
    if (clockBoundIdxRef.current === idx) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    bindQuestionClock(idx)
  }, [idx, questions, bindQuestionClock])

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

  const currentSeconds =
    questions && idx < questions.length ? secondsForQuestion(questions[idx]) : null
  // Clock must be bound to the current idx — otherwise a just-advanced question
  // briefly inherits the previous question's wall and looks already timed out.
  const clockReady = questionStartWall !== 0 && clockBoundIdxRef.current === idx
  const elapsedSec = clockReady && !feedback ? Math.floor((now - questionStartWall) / 1000) : 0
  const isRelaxedClock = sessionTimingModeRef.current === 'relaxed'
  const remainingSec =
    currentSeconds && currentSeconds > 0
      ? feedback || !clockReady
        ? currentSeconds
        : // Relaxed soft clock keeps ticking past 0 (negative = overtime seconds).
          // Strict/bonus clamp at 0 — auto-advance settles the question.
          isRelaxedClock
          ? currentSeconds - elapsedSec
          : Math.max(0, currentSeconds - elapsedSec)
      : null
  // Relaxed soft clock: stay on the question past 0, count overtime, light red.
  const timerOvertime =
    !!currentSeconds &&
    currentSeconds > 0 &&
    clockReady &&
    !feedback &&
    elapsedSec >= currentSeconds &&
    isRelaxedClock

  // ── Finish handler ───────────────────────────────────────────────
  const finishSession = useCallback(async () => {
    if (done) return
    setDone(true)
    const finalElapsed = Math.floor(
      (carriedElapsedMsRef.current + Math.max(0, Date.now() - startedTsMs)) / 1000,
    )
    const log = attemptsLogRef.current
    const correctCount = log.filter((a) => a.firstTryCorrect).length
    const retryCount = log.filter((a) => !a.firstTryCorrect && a.finallyCorrect).length
    const wrongCount = log.filter((a) => !a.finallyCorrect).length
    const challengeCorrect = log.filter((a) => a.isChallenge && a.finallyCorrect).length

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
          {
            correct: a.finallyCorrect,
            timeMs: a.timeMs,
            withinLimit: a.withinLimit,
            evidenceKind: a.evidenceKind,
          },
          a.withinLimit,
          nextSessionNo,
          today,
          a.presentationKey,
        )
      }
      // Only (re)assign attribution when this question carried a source. Carried
      // make-up usually restores source from problem_state in buildSession; if a
      // question still has none, keep the signature's existing block/mixed ids.
      if (first.sourceBlockId) state.blockId = first.sourceBlockId
      if (first.sourceMixedOpId) state.mixedOpId = first.sourceMixedOpId
      nextStates.push(state)
    }
    if (nextStates.length && user) {
      await applyMasterySideEffects(user.id, {
        kind: 'main_path_states',
        states: nextStates,
        sessionNo: nextSessionNo,
      })
      // Refresh loadedStatesRef so DrillSummary reads updated proficiency (not pre-drill snapshot).
      for (const state of nextStates) {
        loadedStatesRef.current.set(state.signature, state)
      }
    }

    // Per-source / weak / next-focus — same helpers as home history replay
    const bySource = buildBySourceFromLog(questionLogRef.current)
    const newWeak = buildNewWeakFromLog(questionLogRef.current)
    const nextFocus = [...bySource]
      .sort(
        (a, b) =>
          a.firstTryCorrect / Math.max(1, a.total) - b.firstTryCorrect / Math.max(1, b.total),
      )
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

    // End-of-session star multiplier (daily main path only — drills/mistakes
    // never confirmed a prep mode, so they stay at the ×1.0 default).
    if (!drillParams && mode === 'daily') {
      const raw = coinsTotalRef.current
      const finalStars = applySessionStarMultiplier(
        raw,
        sessionTimingModeRef.current,
        sessionBonusSecRef.current,
      )
      coinsTotalRef.current = finalStars
      setCoinsTotal(finalStars)
    }

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
      coinsEarned: coinsTotalRef.current,
      mode,
      maxStreak: maxStreakRef.current,
      topLevel,
      questionTimesMs: qTimes,
      questionLog: questionLogRef.current,
    })
    // Only now — clearing before the row is persisted would leave a failed insert
    // with neither a session row nor a resumable snapshot.
    void clearCalcPendingEverywhere(user?.id, mode, drillKey)
    // Sync the global StarHud balance so the top-left chip updates immediately.
    void refreshStarHud()

    // 2. Bump global session counter (skip in drill mode — drills must not pollute carry-over queue)
    if (!drillParams) {
      update({ sessionCounter: settings.sessionCounter + 1 })
    }

    playSfx('complete', settings.soundEnabled)
    launchConfetti(30)
  }, [
    done,
    drillParams,
    wallet,
    refreshStarHud,
    mode,
    settings.soundEnabled,
    settings.sessionCounter,
    update,
    startedTsMs,
    startedAtIso,
    problemState,
    user,
    mode,
    drillKey,
  ])

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
      patchQuestionLogFinallyOk(q, isCorrect)

      const goNext = () => {
        settleLockRef.current = false
        setFeedback(null)
        setInput('')
        setAttemptsForCurrent(0)
        setLastResult(null)
        setRevealAnswer(null)
        if (!questions) return
        if (idx + 1 < questions.length) {
          // Sync-bind before setIdx so the advance render never sees a stale wall.
          bindQuestionClock(idx + 1)
          setIdx((i) => i + 1)
          return
        }
        if (wrongQueueRef.current.length > 0) {
          const drained = wrongQueueRef.current
          wrongQueueRef.current = []
          setQuestions((prev) => (prev ? [...prev, ...drained] : prev))
          bindQuestionClock(idx + 1)
          setIdx((i) => i + 1)
          return
        }
        void finishSession()
      }

      if (isCorrect) {
        const sec = secondsForQuestion(q)
        const speedBonus = isFirstTry && sec && sec > 0 && withinLimit ? 1 : 0
        const reward = (isFirstTry ? coinReward(q, streak) : 0) + speedBonus
        const isChallengeCorrect = q.isChallenge && isFirstTry
        const bonus = isFirstTry ? (streak >= 10 ? 2 : streak >= 5 ? 1 : 0) : 0
        if (isFirstTry && reward > 0) setLastResult({ stars: reward, bonus })
        playSfx(isChallengeCorrect ? 'streak' : 'correct', settings.soundEnabled)
        if (reward > 0) playSfx('coin', settings.soundEnabled)
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
          evidenceKind:
            q.selectionReason === 'same-session-makeup' || q.selectionReason === 'carried-mistake'
              ? 'makeup'
              : q.selectionReason === 'mastered-recall'
                ? 'recall'
                : 'independent',
          sourceBlockId: q.sourceBlockId,
          sourceMixedOpId: q.sourceMixedOpId,
          presentationKey: presentationKeyOf(q),
        })
        if (wasMistake) void recordCorrect(q.signature, settings.sessionCounter + 1)
        goNext()
        return
      }

      // final wrong
      if (!settings.immersiveMode) {
        setFeedback('wrong')
        setRevealAnswer(formatAnswer(q.answer))
        playSfx('wrong', settings.soundEnabled)
      }
      setStreak(0)
      const errorTag = diagnose(q, userAnswer)
      // Gate DB mistake write behind !drillParams — drill wrong answers must not pollute the
      // carry-over queue that normal sessions pick up on the next launch.
      if (!drillParams) {
        void addMistake(q, settings.sessionCounter + 1, userAnswer, errorTag)
      }
      attemptsLogRef.current.push({
        signature: q.signature,
        level: q.level,
        isChallenge: q.isChallenge,
        firstTryCorrect: false,
        finallyCorrect: false,
        wasMistake,
        timeMs: elapsedMs,
        withinLimit: false,
        evidenceKind:
          q.selectionReason === 'same-session-makeup' || q.selectionReason === 'carried-mistake'
            ? 'makeup'
            : q.selectionReason === 'mastered-recall'
              ? 'recall'
              : 'independent',
        sourceBlockId: q.sourceBlockId,
        sourceMixedOpId: q.sourceMixedOpId,
        display: q.display.replace(/\s*=\s*\?\s*$/, ''),
        presentationKey: presentationKeyOf(q),
      })
      const inMakeup = isInMakeupPhase(idx, plannedCountRef.current)
      if (!q.isChallenge && mode !== 'mistakes') {
        if (drillParams) {
          wrongQueueRef.current.push({ ...q, selectionReason: 'same-session-makeup' })
        } else if (!inMakeup) {
          const { pool } = tryEnqueueRetry(
            wrongQueueRef.current,
            { ...q, selectionReason: 'same-session-makeup' },
            maxRetryRef.current,
          )
          wrongQueueRef.current = pool
        }
      }
      if (settings.immersiveMode) {
        goNext()
      } else {
        window.setTimeout(goNext, 1200)
      }
    },
    [
      questions,
      idx,
      streak,
      mode,
      drillParams,
      settings.soundEnabled,
      settings.sessionCounter,
      settings.immersiveMode,
      addMistake,
      recordCorrect,
      finishSession,
      secondsForQuestion,
      patchQuestionLogFinallyOk,
      bindQuestionClock,
    ],
  )

  // Strict/bonus auto-advance: clock hits 0 → settle as final wrong (unanswered),
  // once per question. Relaxed mode never auto-advances (ref stays 'relaxed').
  const autoAdvancedIdxRef = useRef<number>(-1)
  useEffect(() => {
    if (done || !questions || idx >= questions.length) return
    const timingMode = sessionTimingModeRef.current
    if (timingMode !== 'strict' && timingMode !== 'bonus') return
    if (feedback) return
    // Stale wall from the previous question must not auto-advance the next one.
    if (clockBoundIdxRef.current !== idx) return
    if (remainingSec === null || remainingSec > 0) return
    if (autoAdvancedIdxRef.current === idx) return
    autoAdvancedIdxRef.current = idx

    const q = questions[idx]
    const elapsedMs = Math.round(performance.now() - questionStartRef.current)
    const withinLimit = withinLimitForQuestion(q, elapsedMs)
    if (attemptsForCurrent === 0) {
      questionTimesRef.current.push(elapsedMs)
      pushQuestionLog(q, elapsedMs, false)
    }
    const wasMistake = unresolved.some((m) => m.signature === q.signature)
    settleQuestion(q, false, false, elapsedMs, withinLimit, wasMistake, '')
  }, [
    done,
    questions,
    idx,
    feedback,
    remainingSec,
    attemptsForCurrent,
    unresolved,
    withinLimitForQuestion,
    settleQuestion,
    pushQuestionLog,
  ])

  // Self-grading pads (竖式 / 余数 / 分数) lock + show inline 红/绿 on submit. They
  // run the SAME two-try loop as the number pad: first wrong → retry (竖式 keeps the
  // current grid + keypad; other pads remount via padKey); second wrong → final wrong.
  const settleSelfGraded = useCallback(
    (q: CalcQuestion, isCorrect: boolean, userAnswer: string) => {
      const elapsedMs = Math.round(performance.now() - questionStartRef.current)
      const withinLimit = withinLimitForQuestion(q, elapsedMs)
      if (attemptsForCurrent === 0) {
        questionTimesRef.current.push(elapsedMs)
        pushQuestionLog(q, elapsedMs, isCorrect)
      }
      const wasMistake = unresolved.some((m) => m.signature === q.signature)

      if (isCorrect) {
        settleQuestion(
          q,
          true,
          attemptsForCurrent === 0,
          elapsedMs,
          withinLimit,
          wasMistake,
          userAnswer,
        )
        return
      }
      if (settings.immersiveMode) {
        settleQuestion(q, false, false, elapsedMs, withinLimit, wasMistake, userAnswer)
        return
      }
      // first miss → 竖式: wrong cells in place + inline hint; others: brief retry banner.
      // makeup is single-pass: no soft retry when idx >= plannedCount.
      if (!isInMakeupPhase(idx, plannedCountRef.current) && attemptsForCurrent === 0) {
        setStreak(0)
        playSfx('retry', settings.soundEnabled)
        setFeedback('retry')
        setAttemptsForCurrent(1)
        window.setTimeout(() => setFeedback(null), 900)
      } else {
        settleQuestion(q, false, false, elapsedMs, withinLimit, wasMistake, userAnswer)
      }
    },
    [
      idx,
      attemptsForCurrent,
      unresolved,
      settings,
      settleQuestion,
      withinLimitForQuestion,
      pushQuestionLog,
    ],
  )

  // 竖式: VerticalCalc/DivisionVertical self-grade and emit the typed answer.
  const handleVerticalSubmit = useCallback(
    (isCorrect: boolean, userAnswer: string) => {
      if (!questions || done || feedback === 'wrong') return
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

  // 分数: FractionPad submits "num/den". checkAnswer accepts any equivalent fraction.
  const handleFractionSubmit = useCallback(
    (combined: string) => {
      if (!questions || done || feedback) return
      const q = questions[idx]
      const correct = checkAnswer(combined, q.answer)
      settleSelfGraded(q, correct, combined)
    },
    [questions, done, feedback, idx, settleSelfGraded],
  )

  // Shared NumberPad settle path — takes an explicit `raw` string rather than closing over
  // `input` state, so the auto-submit path (which fires from onInputChange with the just-typed
  // value) never races a stale `input` that hasn't re-rendered yet.
  const submitNumberPadAnswer = useCallback(
    (raw: string) => {
      if (!questions || done || feedback) return
      const q = questions[idx]
      const userAns = Number(raw)
      if (!Number.isFinite(userAns)) return

      const isCorrect = checkAnswer(raw, q.answer)
      const wasMistake = unresolved.some((m) => m.signature === q.signature)

      const elapsedMs = Math.round(performance.now() - questionStartRef.current)
      const withinLimit = withinLimitForQuestion(q, elapsedMs)
      if (attemptsForCurrent === 0) {
        questionTimesRef.current.push(elapsedMs)
        pushQuestionLog(q, elapsedMs, isCorrect)
      }

      if (isCorrect) {
        settleQuestion(q, true, attemptsForCurrent === 0, elapsedMs, withinLimit, wasMistake, raw)
        return
      }

      if (settings.immersiveMode) {
        settleQuestion(q, false, false, elapsedMs, withinLimit, wasMistake, raw)
        return
      }

      // wrong: first miss → retry; second miss → settle as final wrong.
      // makeup is single-pass: no soft retry when idx >= plannedCount.
      if (!isInMakeupPhase(idx, plannedCountRef.current) && attemptsForCurrent === 0) {
        setFeedback('retry')
        setStreak(0)
        playSfx('retry', settings.soundEnabled)
        window.setTimeout(() => {
          setFeedback(null)
          setInput('')
          setAttemptsForCurrent(1)
        }, 700)
      } else {
        settleQuestion(q, false, false, elapsedMs, withinLimit, wasMistake, raw)
      }
    },
    [
      questions,
      done,
      feedback,
      idx,
      attemptsForCurrent,
      unresolved,
      settings,
      settleQuestion,
      withinLimitForQuestion,
      pushQuestionLog,
    ],
  )

  const handleSubmit = useCallback(() => {
    submitNumberPadAnswer(input)
  }, [submitNumberPadAnswer, input])

  // NumberPad only: as the child types, auto-settle once the input matches the answer
  // (gated by settings.autoSubmitOnMatch) so a correct entry doesn't need an explicit tap.
  const handleNumberPadInputChange = useCallback(
    (next: string) => {
      setInput(next)
      if (!settings.autoSubmitOnMatch) return
      if (!questions || done) return
      const q = questions[idx]
      if (!q) return
      if (q.answer.kind !== 'int' && q.answer.kind !== 'decimal') return
      if (feedback) return
      if (settleLockRef.current) return
      if (!shouldAutoSubmitNumberPad(next, q.answer)) return
      settleLockRef.current = true
      submitNumberPadAnswer(next)
    },
    [settings.autoSubmitOnMatch, questions, done, idx, feedback, submitNumberPadAnswer],
  )

  // Compute breakthrough drill summary values from the just-completed session's log.
  // Must use questionLogRef.current — wallet.sessions[0] is stale at this point because
  // recordSession() is async and wallet hasn't re-fetched yet when DrillSummary renders.
  const breakthroughLog = done && drillParams?.type === 'breakthrough' ? questionLogRef.current : []
  const btAvgSec =
    breakthroughLog.length > 0
      ? +(breakthroughLog.reduce((a, e) => a + e.ms, 0) / breakthroughLog.length / 1000).toFixed(1)
      : 0
  const btTargetSec = (() => {
    if (!drillParams?.blockId || breakthroughLog.length === 0) return 99
    const tiers = suggestedTiers(drillParams.blockId)
    const avgSecVal = breakthroughLog.reduce((a, e) => a + e.ms, 0) / breakthroughLog.length / 1000
    const accuracy = breakthroughLog.filter((e) => e.ok).length / breakthroughLog.length
    const currentTier = tierOf(avgSecVal, accuracy, tiers)
    const gap = nextTierGap(avgSecVal, currentTier, tiers)
    return +(avgSecVal - gap).toFixed(1)
  })()
  const btTierLabel = (() => {
    if (!drillParams?.blockId || breakthroughLog.length === 0) return '进阶'
    const tiers = suggestedTiers(drillParams.blockId)
    const avgSecVal = breakthroughLog.reduce((a, e) => a + e.ms, 0) / breakthroughLog.length / 1000
    const accuracy = breakthroughLog.filter((e) => e.ok).length / breakthroughLog.length
    const currentTier = tierOf(avgSecVal, accuracy, tiers)
    const nextT: Record<string, string> = {
      entry: '进阶',
      stable: '高级',
      fluent: '超高级',
      auto: '超高级',
    }
    return nextT[currentTier ?? 'entry'] ?? '进阶'
  })()

  if (settingsLoading || !snapChecked) {
    return (
      <>
        <CalcAppHeader title="练习中" backHref="/calc" backLabel="返回" />
        <div
          className="mx-auto max-w-[640px] px-4 py-10 text-center text-[13px]"
          style={{ color: 'rgba(196,181,253,0.5)' }}
        >
          准备题目中…
        </div>
      </>
    )
  }

  if (needsPrep && !prepConfirmed) {
    return (
      <>
        <CalcAppHeader title="准备练习" backHref="/calc" backLabel="返回" />
        <SessionPrepScreen
          plannedEstimate={plannedEstimate}
          maxRetry={maxRetryCeiling(plannedEstimate)}
          timingMode={prepTimingMode}
          bonusSec={prepBonusSec}
          onChangeMode={setPrepModeOverride}
          onChangeBonus={setPrepBonusOverride}
          onStart={handlePrepStart}
          onBack={() => router.push('/calc')}
        />
      </>
    )
  }

  if (!questions || questions.length === 0) {
    return (
      <>
        <CalcAppHeader title="练习中" backHref="/calc" backLabel="返回" />
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
  const canSwitchAnswerMode = (() => {
    if (currentQ.answer.kind !== 'int' || currentQ.display.includes('□')) {
      return false
    }
    try {
      const ast = parseSignature(currentQ.signature)
      return (
        typeof ast !== 'number' && typeof ast.left === 'number' && typeof ast.right === 'number'
      )
    } catch {
      return false
    }
  })()
  const questionForStage =
    answerModeOverride?.idx === idx
      ? { ...currentQ, answerMode: answerModeOverride.mode }
      : currentQ
  const planned = plannedCount || questions.length
  const stageDisabled =
    done ||
    (!settings.immersiveMode &&
      (questionForStage.answerMode === 'vertical' ? feedback === 'wrong' : !!feedback))
  const padKey =
    settings.immersiveMode || questionForStage.answerMode === 'vertical'
      ? String(idx)
      : `${idx}:${attemptsForCurrent}`

  return (
    <>
      <CalcAppHeader
        title="练习中"
        backLabel="退出"
        onBack={handleSessionExit}
        rightExtra={
          !done ? (
            <button
              type="button"
              onClick={() => void handleStash()}
              className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold text-amber-300 transition-all hover:text-white"
              style={{
                background: 'rgba(245,158,11,0.15)',
                border: '1px solid rgba(245,158,11,0.35)',
              }}
            >
              💾 暂存
            </button>
          ) : undefined
        }
      />

      {stashToast && (
        <div
          className="fixed top-16 left-1/2 z-40 -translate-x-1/2 rounded-[12px] border px-4 py-2.5 text-[13px] font-bold"
          style={{
            borderColor: 'rgba(74,222,128,0.45)',
            background: 'rgba(74,222,128,0.1)',
            color: '#86efac',
          }}
        >
          ✓ {stashToast}
        </div>
      )}

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
          showTimer={!isRelaxedClock}
          remainingSec={remainingSec}
          timerOvertime={timerOvertime}
          idx={idx}
          planned={planned}
          total={questions.length}
          streak={streak}
          coinsTotal={coinsTotal}
          lastResult={lastResult}
        />

        {(currentQ.selectionReason === 'coverage' ||
          currentQ.selectionReason === 'carried-mistake' ||
          currentQ.selectionReason === 'same-session-makeup') && (
          <div className="pointer-events-none absolute top-16 left-1/2 z-10 -translate-x-1/2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-bold text-cyan-200">
            {currentQ.selectionReason === 'coverage' ? '新题' : '补练'}
          </div>
        )}

        <CalcQuestionStage
          padKey={padKey}
          question={questionForStage}
          isChallenge={currentQ.isChallenge}
          disabled={stageDisabled}
          immersive={settings.immersiveMode}
          autoSubmitOnMatch={settings.autoSubmitOnMatch}
          className=""
          input={input}
          onInputChange={handleNumberPadInputChange}
          onNumberSubmit={handleSubmit}
          onFractionSubmit={handleFractionSubmit}
          onRemainderSubmit={handleRemainderSubmit}
          onVerticalSubmit={handleVerticalSubmit}
          feedback={feedback}
          revealAnswer={revealAnswer}
          attempt={attemptsForCurrent}
          onSwitchToVertical={
            canSwitchAnswerMode
              ? () => {
                  setInput('')
                  setAnswerModeOverride({ idx, mode: 'vertical' })
                }
              : undefined
          }
          onSwitchToPad={
            canSwitchAnswerMode
              ? () => {
                  setInput('')
                  setAnswerModeOverride({ idx, mode: 'pad' })
                }
              : undefined
          }
        />
      </main>

      {showChallengeBanner && <ChallengeBanner coins={currentQ.coinBase} />}

      {done &&
        finalStats &&
        (drillParams ? (
          <DrillSummary
            {...(drillParams.type === 'weak-formulas'
              ? {
                  type: 'weak-formulas' as const,
                  problemStates: loadedStatesRef.current,
                  targetSignatures: drillTargetSignatures,
                  round: drillRound,
                  onContinue: () => {
                    // Reset session state so the init useEffect re-runs for the next round.
                    void clearCalcPendingEverywhere(user?.id, mode, drillKey)
                    // Init reads this state, not storage — without it the next round
                    // restores the round that just finished.
                    setPendingSnap(null)
                    initRef.current = false
                    clockBoundIdxRef.current = -1
                    setQuestions(null)
                    setIdx(0)
                    setDone(false)
                    const next = new URLSearchParams({
                      drill: 'weak-formulas',
                      round: String(drillRound + 1),
                    })
                    router.replace(`/calc/session?${next.toString()}`)
                  },
                  onExit: () => router.push('/calc/report'),
                }
              : {
                  type: 'breakthrough' as const,
                  blockLabel: drillParams.blockId
                    ? (blockById(drillParams.blockId)?.label ?? '')
                    : '',
                  avgSec: btAvgSec,
                  targetSec: btTargetSec,
                  tierLabel: btTierLabel,
                  onRetry: () => {
                    if (drillParams.blockId) {
                      // Reset session state so the init useEffect re-runs.
                      // sessionKey bump is required here because URL doesn't change (same blockId),
                      // so drillParams won't change and the useEffect won't re-fire without it.
                      void clearCalcPendingEverywhere(user?.id, mode, drillKey)
                      setPendingSnap(null)
                      initRef.current = false
                      clockBoundIdxRef.current = -1
                      setQuestions(null)
                      setIdx(0)
                      setDone(false)
                      setSessionKey((k) => k + 1)
                      router.replace(
                        `/calc/session?drill=breakthrough&blockId=${drillParams.blockId}`,
                      )
                    }
                  },
                  onExit: () => router.push('/calc/report'),
                })}
          />
        ) : (
          <SessionSummary
            correctCount={finalStats.correct}
            retryCount={finalStats.retry}
            wrongCount={finalStats.wrong}
            total={finalStats.total}
            coinsEarned={coinsTotal}
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
              void clearCalcPendingEverywhere(user?.id, mode, drillKey)
              setPendingSnap(null)
              setQuestions(null)
              setIdx(0)
              wrongQueueRef.current = []
              maxRetryRef.current = 0
              plannedCountRef.current = 0
              setPlannedCount(0)
              setInput('')
              setAttemptsForCurrent(0)
              setFeedback(null)
              setRevealAnswer(null)
              setShowChallengeBanner(false)
              questionTimesRef.current = []
              questionLogRef.current = []
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
              setFinalStats(null)
              initRef.current = false
              autoAdvancedIdxRef.current = -1
              clockBoundIdxRef.current = -1
              settleLockRef.current = false
              setPrepConfirmed(false)
              setPrepModeOverride(null)
              setPrepBonusOverride(null)
              setSessionKey((k) => k + 1)
            }}
          />
        ))}
    </>
  )
}
