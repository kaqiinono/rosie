'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { QuizQuestion, WordEntry } from '@rosie/core'
import { supabase, todayStr, useAuth, useImmersive } from '@rosie/core'
import { StarProgressBar, useStarHud } from '@rosie/rewards'
import { useAdaptiveWordPlan } from '../../hooks/useAdaptiveWordPlan'
import { useWeeklyPlan } from '../../hooks/useWeeklyPlan'
import { wordMasteryStore } from '../../hooks/useWordMastery'
import {
  buildQuizOptions,
  findWordByKey,
  wordKey,
} from '../../utils/english-helpers'
import { activateWord } from '../../utils/adaptivePlanBoxes'
import {
  buildConsolidateExemptSet,
  collapseSessionOutcomes,
  settleBossFirstPass,
  settleStep3,
  type AdaptiveMasteryPatch,
  type SessionOutcome,
} from '../../utils/adaptivePlanSettle'
import type {
  AdaptiveDailyTask,
} from '../../utils/adaptivePlanScheduler'
import { buildDailyTask, isPlanCompletable } from '../../utils/adaptivePlanScheduler'
import { quizTypesForWord } from '../../utils/adaptivePlanQuizTypes'
import { adaptiveStageLabel } from '../../utils/adaptivePlanStages'
import type {
  AdaptivePlanWordProgress,
  AdaptiveWordPlan,
} from '../../utils/adaptivePlanTypes'
import { useWordsContext } from '../../WordsContext'
import AdaptivePlanProgressBar from './AdaptivePlanProgressBar'
import AdaptivePlanStageBoard from './AdaptivePlanStageBoard'
import QuizQuestionBody from './QuizQuestionBody'
import StudyPhase from './StudyPhase'
import { useQuizRunner, type QuizCommitInfo } from './useQuizRunner'

type AdaptivePlanSessionProps = {
  planId: string
  onBack: () => void
}

type Phase = 'hub' | 'review' | 'study' | 'final' | 'boss' | 'boss_sink' | 'done'

type QuizSlot = {
  key: string
  type: QuizQuestion['type']
}

type RoundWordStatus = {
  wordKey: string
  word: string
  correct: boolean
  statusLabel: string
  boxIndex: number | null
  mastered: boolean
}

type RoundSummary = {
  kind: 'normal' | 'boss' | 'empty'
  newLearnedCount: number
  reviewedCount: number
  correctCount: number
  wrongCount: number
  questionCount: number
  starsEarned: number
  promotedCount: number
  masteredCount: number
  words: RoundWordStatus[]
  note: string
}

const BOSS_PASS_PCT = 85
const BOSS_FORCE_UNLOCK_STREAK = 3

function uniqueKeys(keys: string[]): string[] {
  return [...new Set(keys)]
}

function hasStatsPatch(patch: Partial<AdaptiveWordPlan['stats']>): boolean {
  return Object.keys(patch).length > 0
}

function firstPassPct(results: SessionOutcome[]): number {
  if (results.length === 0) return 0
  const correct = results.filter((item) => item.correct).length
  return (correct / results.length) * 100
}

function sinkCleared(results: SessionOutcome[]): boolean {
  return results.length === 0 || results.every((item) => item.correct)
}

function displayWordFromKey(key: string, vocab: WordEntry[]): string {
  const entry = findWordByKey(vocab, key)
  if (entry) return entry.word
  const parts = key.split('::')
  return parts[parts.length - 1] || key
}

function buildRoundSummary(args: {
  kind: RoundSummary['kind']
  activateKeys: string[]
  reviewKeys: string[]
  outcomes: SessionOutcome[]
  beforeRows: AdaptivePlanWordProgress[]
  afterRows: AdaptivePlanWordProgress[]
  starsEarned: number
  note: string
  vocab: WordEntry[]
}): RoundSummary {
  const collapsed = collapseSessionOutcomes(args.outcomes)
  const beforeByKey = new Map(args.beforeRows.map((row) => [row.wordKey, row]))
  const afterByKey = new Map(args.afterRows.map((row) => [row.wordKey, row]))
  const touchedKeys = uniqueKeys([
    ...args.activateKeys,
    ...args.reviewKeys,
    ...collapsed.keys(),
  ])

  let promotedCount = 0
  let masteredCount = 0
  const words: RoundWordStatus[] = touchedKeys.map((key) => {
    const before = beforeByKey.get(key)
    const after = afterByKey.get(key) ?? before
    const correct = collapsed.get(key) ?? true
    if (after?.status === 'MASTERED' && before?.status !== 'MASTERED') {
      masteredCount += 1
    }
    const beforeBox = before?.boxIndex ?? 0
    const afterBox = after?.status === 'MASTERED' ? 6 : (after?.boxIndex ?? 0)
    if (afterBox > beforeBox) promotedCount += 1

    return {
      wordKey: key,
      word: displayWordFromKey(key, args.vocab),
      correct,
      statusLabel: adaptiveStageLabel(after),
      boxIndex: after?.boxIndex ?? null,
      mastered: after?.status === 'MASTERED',
    }
  })

  words.sort((a, b) => {
    if (a.correct !== b.correct) return a.correct ? 1 : -1
    return a.word.localeCompare(b.word)
  })

  const wrongCount = [...collapsed.values()].filter((ok) => !ok).length
  const correctCount = [...collapsed.values()].filter((ok) => ok).length

  return {
    kind: args.kind,
    newLearnedCount: args.activateKeys.length,
    reviewedCount: args.reviewKeys.length,
    correctCount,
    wrongCount,
    questionCount: args.outcomes.length,
    starsEarned: args.starsEarned,
    promotedCount,
    masteredCount,
    words,
    note: args.note,
  }
}

function demoteBossStubbornRows(
  rows: AdaptivePlanWordProgress[],
  firstPassWrongKeys: Set<string>,
  today: string,
): AdaptivePlanWordProgress[] {
  return rows
    .filter(
      (row) =>
        row.status === 'LEARNING' &&
        (firstPassWrongKeys.has(row.wordKey) || row.streakWrong >= 2),
    )
    .map((row) => ({
      ...row,
      boxIndex: 1,
      targetBox: null,
      streakWrong: Math.max(row.streakWrong, 2),
      // Stay due today so the next same-day session can keep drilling stubborn words.
      nextReviewDate: today,
    }))
}

async function upsertMasteryPatches(
  userId: string,
  patches: AdaptiveMasteryPatch[],
): Promise<void> {
  if (patches.length === 0) return

  wordMasteryStore.patchSessionData(userId, (prev) => {
    const next = { ...prev }
    for (const patch of patches) next[patch.wordKey] = patch.info
    return next
  })

  const rows = patches.map(({ wordKey: key, info }) => ({
    user_id: userId,
    word_key: key,
    correct: info.correct,
    incorrect: info.incorrect,
    last_seen: info.lastSeen,
    stage: info.stage ?? null,
    next_review_date: info.nextReviewDate ?? null,
    is_hard: info.isHard ?? false,
    review_history: info.reviewHistory ?? [],
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('word_mastery')
    .upsert(rows, { onConflict: 'user_id,word_key' })
  if (error) console.error('[adaptive_word_plan] mastery upsert failed', error)
}

export default function AdaptivePlanSession({ planId, onBack }: AdaptivePlanSessionProps) {
  const { user } = useAuth()
  const { vocab, masteryMap } = useWordsContext()
  const { isImmersive, setIsImmersive } = useImmersive()
  const { awardStars, session: starSession } = useStarHud()
  const {
    plans,
    isLoading: plansLoading,
    loadProgress,
    saveProgressBatch,
    updatePlan,
    completePlanIfEligible,
  } = useAdaptiveWordPlan(user)
  const { weeklyPlan } = useWeeklyPlan(user)

  const [plan, setPlan] = useState<AdaptiveWordPlan | null>(null)
  const [rows, setRows] = useState<AdaptivePlanWordProgress[]>([])
  const [task, setTask] = useState<AdaptiveDailyTask | null>(null)
  const [isLoadingRows, setIsLoadingRows] = useState(true)
  const [phase, setPhase] = useState<Phase>('hub')
  const [reviewCursor, setReviewCursor] = useState(0)
  const [reviewDoneKeys, setReviewDoneKeys] = useState<Set<string>>(new Set())
  const [studyIdx, setStudyIdx] = useState(0)
  const [studyDefOnly, setStudyDefOnly] = useState(false)
  const [quizSlots, setQuizSlots] = useState<QuizSlot[]>([])
  const [curQ, setCurQ] = useState(0)
  const [score, setScore] = useState(0)
  const [helpClicks, setHelpClicks] = useState<Record<string, number>>({})
  const [settling, setSettling] = useState(false)
  const [activationApplied, setActivationApplied] = useState(false)
  const [newStudyDone, setNewStudyDone] = useState(0)
  const [doneTitle, setDoneTitle] = useState('本轮完成')
  const [doneMessage, setDoneMessage] = useState('已保存自适应计划进度。')
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null)
  const starsAwardedThisRoundRef = useRef(0)
  const roundActivateKeysRef = useRef<string[]>([])
  const roundReviewKeysRef = useRef<string[]>([])

  const reviewOutcomesRef = useRef<SessionOutcome[]>([])
  const finalOutcomesRef = useRef<SessionOutcome[]>([])
  const bossFirstPassOutcomesRef = useRef<SessionOutcome[]>([])
  const bossSinkOutcomesRef = useRef<SessionOutcome[]>([])
  const finalPassWrongKeysRef = useRef<Set<string>>(new Set())
  const bossPassWrongKeysRef = useRef<Set<string>>(new Set())
  const bossSinkWrongKeysRef = useRef<Set<string>>(new Set())

  const today = todayStr()
  const sourcePlan = useMemo(
    () => plans.find((item) => item.id === planId) ?? null,
    [plans, planId],
  )
  const dayReviewKeys = task?.reviewKeys ?? []
  const batchSize = Math.max(1, plan?.reviewBatchSize ?? 20)
  const visibleReviewKeys = dayReviewKeys.slice(0, reviewCursor)
  const activateKeys = useMemo(() => {
    const keys = task?.activateKeys ?? []
    const cap = Number.isFinite(plan?.newWordsPerDay)
      ? Math.max(1, Math.floor(plan!.newWordsPerDay))
      : 10
    // Belt-and-suspenders: never study more than the plan's daily new-word quota.
    return keys.slice(0, cap)
  }, [plan, task?.activateKeys])
  const activateEntries = useMemo(
    () =>
      activateKeys
        .map((key) => findWordByKey(vocab, key))
        .filter((entry): entry is WordEntry => entry != null),
    [activateKeys, vocab],
  )
  const [loadError, setLoadError] = useState<string | null>(null)
  const loadGenRef = useRef(0)
  const sessionStartedRef = useRef(false)
  const loadedPlanIdRef = useRef<string | null>(null)

  useEffect(() => {
    sessionStartedRef.current = false
    loadedPlanIdRef.current = null
    setLoadError(null)
  }, [planId])

  useEffect(() => {
    if (plansLoading || !sourcePlan) return
    // Only full-reset load once per planId (or after explicit planId change).
    if (loadedPlanIdRef.current === sourcePlan.id && plan) return

    const planSnapshot = sourcePlan
    const gen = ++loadGenRef.current
    let cancelled = false

    void (async () => {
      setIsLoadingRows(true)
      setLoadError(null)
      try {
        const loadedRows = await loadProgress(planSnapshot.id)
        if (cancelled || gen !== loadGenRef.current) return

        if (loadedRows.length === 0) {
          setPlan(planSnapshot)
          setRows([])
          setTask(null)
          setLoadError(
            '计划单词进度为空。常见原因：尚未在 Supabase 执行 docs/sql/adaptive-word-plans.sql，或创建时进度写入失败。请到管理页删除后重建，或检查数据库表。',
          )
          setIsLoadingRows(false)
          return
        }

        const dailyTask = buildDailyTask(planSnapshot, loadedRows, today)
        const modePlan =
          dailyTask.mode === planSnapshot.mode
            ? planSnapshot
            : { ...planSnapshot, mode: dailyTask.mode }

        loadedPlanIdRef.current = planSnapshot.id
        setPlan(modePlan)
        setRows(loadedRows)
        setTask(dailyTask)
        setPhase('hub')
        setReviewCursor(Math.min(modePlan.reviewBatchSize, dailyTask.reviewKeys.length))
        setReviewDoneKeys(new Set())
        setStudyIdx(0)
        setQuizSlots([])
        setCurQ(0)
        setScore(0)
        setHelpClicks({})
        setActivationApplied(false)
        setNewStudyDone(0)
        setDoneTitle('本轮完成')
        setDoneMessage('已保存自适应计划进度。')
        setRoundSummary(null)
        starsAwardedThisRoundRef.current = 0
        roundActivateKeysRef.current = []
        roundReviewKeysRef.current = []
        reviewOutcomesRef.current = []
        finalOutcomesRef.current = []
        bossFirstPassOutcomesRef.current = []
        bossSinkOutcomesRef.current = []
        finalPassWrongKeysRef.current = new Set()
        bossPassWrongKeysRef.current = new Set()
        bossSinkWrongKeysRef.current = new Set()
        setIsLoadingRows(false)

        if (dailyTask.mode !== planSnapshot.mode) {
          void updatePlan(modePlan)
        }
      } catch (err) {
        if (cancelled || gen !== loadGenRef.current) return
        console.error('[adaptive_word_plan] session load failed', err)
        setLoadError(
          err instanceof Error
            ? err.message
            : '加载计划进度失败。请确认已执行 adaptive-word-plans.sql，并刷新重试。',
        )
        setIsLoadingRows(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [loadProgress, plansLoading, sourcePlan, plan, today, updatePlan])

  const buildSlots = useCallback(
    (keys: string[], preferLight = false): QuizSlot[] => {
      const progressByKey = new Map(rows.map((row) => [row.wordKey, row]))
      const seed = Date.now()
      const shuffledKeys = [...keys].sort((a, b) => {
        let ha = seed
        let hb = seed + 1
        for (let i = 0; i < a.length; i++) ha = (ha * 31 + a.charCodeAt(i)) | 0
        for (let i = 0; i < b.length; i++) hb = (hb * 31 + b.charCodeAt(i)) | 0
        return (ha >>> 0) - (hb >>> 0)
      })

      const ordered: QuizSlot[] = []
      for (const key of shuffledKeys) {
        if (!findWordByKey(vocab, key)) continue
        const types = quizTypesForWord(progressByKey.get(key), masteryMap[key], { preferLight })
        for (const type of types) ordered.push({ key, type })
      }
      return ordered
    },
    [masteryMap, rows, vocab],
  )

  const startReview = useCallback(() => {
    const firstKeys = dayReviewKeys.slice(0, reviewCursor)
    setQuizSlots(buildSlots(firstKeys, true))
    setCurQ(0)
    setScore(0)
    setHelpClicks({})
    setIsImmersive(true)
    setPhase('review')
  }, [buildSlots, dayReviewKeys, reviewCursor, setIsImmersive])

  const applyActivations = useCallback(async () => {
    if (!plan || !task || activationApplied || task.activateKeys.length === 0) return

    const activateSet = new Set(task.activateKeys)
    const activatedRows = rows
      .filter((row) => activateSet.has(row.wordKey) && row.status !== 'LEARNING')
      .map((row) => activateWord(row, today))

    if (activatedRows.length === 0) {
      setActivationApplied(true)
      return
    }

    const activatedByKey = new Map(activatedRows.map((row) => [row.wordKey, row]))
    setRows((prev) => prev.map((row) => activatedByKey.get(row.wordKey) ?? row))
    setActivationApplied(true)
    await saveProgressBatch(activatedRows)

    const updatedPlan: AdaptiveWordPlan = {
      ...plan,
      stats: {
        ...plan.stats,
        everActivatedCount: plan.stats.everActivatedCount + activatedRows.length,
        totalActivatedCount: plan.stats.totalActivatedCount + activatedRows.length,
      },
    }
    setPlan(updatedPlan)
    await updatePlan(updatedPlan)
  }, [activationApplied, plan, rows, saveProgressBatch, task, today, updatePlan])

  const startFinalQuiz = useCallback(
    (keys: string[]) => {
      finalPassWrongKeysRef.current = new Set()
      setQuizSlots(buildSlots(keys, false))
      setCurQ(0)
      setScore(0)
      setHelpClicks({})
      setIsImmersive(true)
      setPhase('final')
    },
    [buildSlots, setIsImmersive],
  )

  const startBossQuiz = useCallback(
    (keys: string[], phaseName: 'boss' | 'boss_sink') => {
      if (phaseName === 'boss') {
        bossFirstPassOutcomesRef.current = []
        bossSinkOutcomesRef.current = []
        bossPassWrongKeysRef.current = new Set()
        bossSinkWrongKeysRef.current = new Set()
      } else {
        bossSinkWrongKeysRef.current = new Set()
      }
      // Boss: full writing pressure (no light pad)
      setQuizSlots(buildSlots(keys, false))
      setCurQ(0)
      setScore(0)
      setHelpClicks({})
      setIsImmersive(true)
      setPhase(phaseName)
    },
    [buildSlots, setIsImmersive],
  )

  const resetRoundState = useCallback(
    (nextPlan: AdaptiveWordPlan, nextRows: AdaptivePlanWordProgress[]) => {
      const dailyTask = buildDailyTask(nextPlan, nextRows, today)
      const modePlan =
        dailyTask.mode === nextPlan.mode
          ? nextPlan
          : { ...nextPlan, mode: dailyTask.mode }
      setPlan(modePlan)
      setTask(dailyTask)
      setReviewCursor(Math.min(modePlan.reviewBatchSize, dailyTask.reviewKeys.length))
      setReviewDoneKeys(new Set())
      setStudyIdx(0)
      setQuizSlots([])
      setCurQ(0)
      setScore(0)
      setHelpClicks({})
      setActivationApplied(false)
      setNewStudyDone(0)
      reviewOutcomesRef.current = []
      finalOutcomesRef.current = []
      bossFirstPassOutcomesRef.current = []
      bossSinkOutcomesRef.current = []
      finalPassWrongKeysRef.current = new Set()
      bossPassWrongKeysRef.current = new Set()
      bossSinkWrongKeysRef.current = new Set()
      sessionStartedRef.current = false
      starsAwardedThisRoundRef.current = 0
      return { modePlan, dailyTask }
    },
    [today],
  )

  const hasMoreWorkToday = useCallback((dailyTask: AdaptiveDailyTask) => {
    return (
      dailyTask.reviewKeys.length > 0 ||
      dailyTask.activateKeys.length > 0 ||
      dailyTask.bossKeys.length > 0
    )
  }, [])

  const settleSession = useCallback(async () => {
    if (!user || !plan || settling) return
    setSettling(true)
    try {
      const roundOutcomes = [...reviewOutcomesRef.current, ...finalOutcomesRef.current]
      const settleResult = settleStep3({
        progressRows: rows,
        results: roundOutcomes,
        masteryByKey: masteryMap,
        consolidateExemptSet: buildConsolidateExemptSet(weeklyPlan, vocab),
        today,
      })

      await saveProgressBatch(settleResult.progressUpdates)
      const updateByKey = new Map(settleResult.progressUpdates.map((row) => [row.wordKey, row]))
      const nextRows = rows.map((row) => updateByKey.get(row.wordKey) ?? row)
      setRows(nextRows)
      await upsertMasteryPatches(user.id, settleResult.masteryPatches)

      let nextPlan = plan
      if (hasStatsPatch(settleResult.planStatsPatch)) {
        nextPlan = {
          ...nextPlan,
          stats: { ...nextPlan.stats, ...settleResult.planStatsPatch },
        }
      }

      const noteIfMore = '今天还可以再练一轮：错词会继续出现，也可以继续拉新词。'
      const noteIfDone = '今天暂无更多到期复习或可拉新词，明天再来继续推进。'
      const starsEarned = starsAwardedThisRoundRef.current
      const activateSnapshot = [...roundActivateKeysRef.current]
      const reviewSnapshot = [...roundReviewKeysRef.current]

      if (isPlanCompletable(nextRows, false)) {
        const completed = await completePlanIfEligible(plan.id)
        if (completed) {
          nextPlan = { ...nextPlan, status: 'completed' }
          setPlan(nextPlan)
          setRoundSummary(
            buildRoundSummary({
              kind: 'normal',
              activateKeys: activateSnapshot,
              reviewKeys: reviewSnapshot,
              outcomes: roundOutcomes,
              beforeRows: rows,
              afterRows: nextRows,
              starsEarned,
              note: '全部单词已完成，自适应计划已标记完成并归档进度。',
              vocab,
            }),
          )
          setDoneTitle('计划已完成')
          setDoneMessage('全部单词已完成，自适应计划已标记完成并归档进度。')
          setIsImmersive(false)
          setPhase('done')
          return
        }
      }

      const { modePlan, dailyTask } = resetRoundState(nextPlan, nextRows)
      if (modePlan.mode !== plan.mode || hasStatsPatch(settleResult.planStatsPatch)) {
        await updatePlan(modePlan)
      }

      const note = hasMoreWorkToday(dailyTask) ? noteIfMore : noteIfDone
      setRoundSummary(
        buildRoundSummary({
          kind: 'normal',
          activateKeys: activateSnapshot,
          reviewKeys: reviewSnapshot,
          outcomes: roundOutcomes,
          beforeRows: rows,
          afterRows: nextRows,
          starsEarned,
          note,
          vocab,
        }),
      )
      setDoneTitle('本轮完成')
      setDoneMessage(note)
      setIsImmersive(false)
      setPhase('done')
    } finally {
      setSettling(false)
    }
  }, [
    completePlanIfEligible,
    hasMoreWorkToday,
    masteryMap,
    plan,
    resetRoundState,
    rows,
    saveProgressBatch,
    setIsImmersive,
    settling,
    today,
    updatePlan,
    user,
    vocab,
    weeklyPlan,
  ])

  const settleBossSession = useCallback(async () => {
    if (!user || !plan || !task || settling) return
    setSettling(true)
    try {
      const firstPassResults = bossFirstPassOutcomesRef.current
      const sinkResults = bossSinkOutcomesRef.current
      const passPct = firstPassPct(firstPassResults)
      const passed = passPct >= BOSS_PASS_PCT && sinkCleared(sinkResults)

      const settleResult = settleBossFirstPass({
        progressRows: rows,
        firstPassResults,
        sinkResults,
        masteryByKey: masteryMap,
        consolidateExemptSet: buildConsolidateExemptSet(weeklyPlan, vocab),
        currentStats: plan.stats,
        today,
      })

      const updateByKey = new Map(settleResult.progressUpdates.map((row) => [row.wordKey, row]))
      let progressUpdates = settleResult.progressUpdates
      let nextRows = rows.map((row) => updateByKey.get(row.wordKey) ?? row)
      let nextPlan: AdaptiveWordPlan = {
        ...plan,
        stats: { ...plan.stats, ...settleResult.planStatsPatch },
      }
      let shouldForceUnlock = false

      if (passed) {
        nextPlan = {
          ...nextPlan,
          mode: 'normal',
          stats: {
            ...nextPlan.stats,
            bossFailStreak: 0,
            lastBossActivatedCount: nextPlan.stats.totalActivatedCount,
          },
        }
      } else if ((nextPlan.stats.bossFailStreak ?? 0) >= BOSS_FORCE_UNLOCK_STREAK) {
        shouldForceUnlock = window.confirm(
          '已连续 3 次 Boss 未通过。强制解锁并恢复新词？顽固词将打回 Box 1 继续复习。',
        )

        if (shouldForceUnlock) {
          const forcedRows = demoteBossStubbornRows(
            nextRows,
            bossPassWrongKeysRef.current,
            today,
          )
          const forcedByKey = new Map(forcedRows.map((row) => [row.wordKey, row]))
          nextRows = nextRows.map((row) => forcedByKey.get(row.wordKey) ?? row)
          progressUpdates = [
            ...progressUpdates.filter((row) => !forcedByKey.has(row.wordKey)),
            ...forcedRows,
          ]
          nextPlan = {
            ...nextPlan,
            mode: 'normal',
            stats: {
              ...nextPlan.stats,
              bossFailStreak: 0,
              lastBossActivatedCount: nextPlan.stats.totalActivatedCount,
            },
          }
        }
      }

      await saveProgressBatch(progressUpdates)
      setRows(nextRows)
      await upsertMasteryPatches(user.id, settleResult.masteryPatches)

      const bossOutcomes = [...firstPassResults, ...sinkResults]
      const bossReviewKeys = uniqueKeys(firstPassResults.map((item) => item.wordKey))
      const starsEarned = starsAwardedThisRoundRef.current

      if (isPlanCompletable(nextRows, false)) {
        const completed = await completePlanIfEligible(plan.id)
        if (completed) {
          nextPlan = { ...nextPlan, status: 'completed' }
          setPlan(nextPlan)
          await updatePlan(nextPlan)
          setRoundSummary(
            buildRoundSummary({
              kind: 'boss',
              activateKeys: [],
              reviewKeys: bossReviewKeys,
              outcomes: bossOutcomes,
              beforeRows: rows,
              afterRows: nextRows,
              starsEarned,
              note: 'Boss 已通过，全部进度已完成并软归档。',
              vocab,
            }),
          )
          setDoneTitle('计划已完成')
          setDoneMessage('Boss 已通过，全部进度已完成并软归档。')
          setIsImmersive(false)
          setPhase('done')
          return
        }
      }

      const { modePlan, dailyTask } = resetRoundState(nextPlan, nextRows)
      await updatePlan(modePlan)

      let note: string
      if (shouldForceUnlock) {
        note = hasMoreWorkToday(dailyTask)
          ? '连续 Boss 受阻，顽固单词已降到 1 号箱；今天还可以继续练。'
          : '连续 Boss 受阻，顽固单词已降到 1 号箱；计划回到普通模式。'
        setDoneTitle('已强制解锁')
      } else if (passed) {
        note = hasMoreWorkToday(dailyTask)
          ? `首轮正确率 ${Math.round(passPct)}%，计划回到普通模式。今天还可以再练一轮。`
          : `首轮正确率 ${Math.round(passPct)}%，沉底题已清空，计划回到普通模式。`
        setDoneTitle('Boss 已通过')
      } else {
        note = hasMoreWorkToday(dailyTask)
          ? `首轮正确率 ${Math.round(passPct)}%，已保存本轮箱位变化。今天可以继续挑战。`
          : `首轮正确率 ${Math.round(passPct)}%，已保存本轮箱位变化，继续留在 Boss 模式。`
        setDoneTitle('Boss 还没通过')
      }

      setRoundSummary(
        buildRoundSummary({
          kind: 'boss',
          activateKeys: [],
          reviewKeys: bossReviewKeys,
          outcomes: bossOutcomes,
          beforeRows: rows,
          afterRows: nextRows,
          starsEarned,
          note,
          vocab,
        }),
      )
      setDoneMessage(note)
      setIsImmersive(false)
      setPhase('done')
    } finally {
      setSettling(false)
    }
  }, [
    completePlanIfEligible,
    hasMoreWorkToday,
    masteryMap,
    plan,
    resetRoundState,
    rows,
    saveProgressBatch,
    setIsImmersive,
    settling,
    task,
    today,
    updatePlan,
    user,
    vocab,
    weeklyPlan,
  ])

  const startStudyOrFinal = useCallback(() => {
    // Prefer keys that resolve in current vocab; fall back to raw activateKeys for study.
    const studyKeys =
      activateEntries.length > 0
        ? activateEntries.map((entry) => wordKey(entry))
        : (task?.activateKeys ?? [])

    if (studyKeys.length > 0 && activateEntries.length > 0) {
      void applyActivations()
      setStudyIdx(0)
      setNewStudyDone(0)
      setPhase('study')
      return
    }

    // activateKeys exist in plan but vocab not loaded / key mismatch — still try final quiz by key
    if ((task?.activateKeys.length ?? 0) > 0 && activateEntries.length === 0) {
      void applyActivations()
      startFinalQuiz(task!.activateKeys)
      return
    }

    const wrongReviewKeys = [...collapseSessionOutcomes(reviewOutcomesRef.current)]
      .filter(([, correct]) => !correct)
      .map(([key]) => key)
    const finalKeys = uniqueKeys(wrongReviewKeys)
    if (finalKeys.length === 0) {
      // Truly nothing to do today — show hub message, do NOT auto-settle as "completed day"
      const note =
        task?.mode === 'review_only'
          ? '当前为纯复习模式，但今天没有到期复习词。明天再来，或先在管理页调整每日新词。'
          : '今天没有待复习词，也没有可新学的词（可能词库尚未加载，或计划内单词已全部引入）。请返回后刷新再试，或到管理页检查计划范围。'
      setDoneTitle('今天暂无新任务')
      setDoneMessage(note)
      setRoundSummary({
        kind: 'empty',
        newLearnedCount: 0,
        reviewedCount: 0,
        correctCount: 0,
        wrongCount: 0,
        questionCount: 0,
        starsEarned: 0,
        promotedCount: 0,
        masteredCount: 0,
        words: [],
        note,
      })
      setPhase('done')
      return
    }

    startFinalQuiz(finalKeys)
  }, [activateEntries, applyActivations, startFinalQuiz, task])

  const beginSession = useCallback(() => {
    if (!task || settling) return
    sessionStartedRef.current = true
    starsAwardedThisRoundRef.current = 0
    roundActivateKeysRef.current = activateKeys
    roundReviewKeysRef.current =
      task.mode === 'boss' ? task.bossKeys : dayReviewKeys
    setRoundSummary(null)
    if (task.mode === 'boss') {
      if (task.bossKeys.length === 0) {
        setDoneTitle('今天暂无 Boss 词')
        setDoneMessage('Boss 模式已触发，但题包为空。请返回后刷新，或联系家长检查计划进度。')
        setRoundSummary({
          kind: 'empty',
          newLearnedCount: 0,
          reviewedCount: 0,
          correctCount: 0,
          wrongCount: 0,
          questionCount: 0,
          starsEarned: 0,
          promotedCount: 0,
          masteredCount: 0,
          words: [],
          note: 'Boss 模式已触发，但题包为空。',
        })
        setPhase('done')
        return
      }
      startBossQuiz(task.bossKeys, 'boss')
      return
    }
    if (dayReviewKeys.length > 0) {
      const firstKeys = dayReviewKeys.slice(0, Math.max(reviewCursor, batchSize))
      const slots = buildSlots(firstKeys, true)
      if (slots.length === 0) {
        // Review keys present but no quiz slots (vocab miss) — skip to study
        startStudyOrFinal()
        return
      }
      startReview()
      return
    }
    startStudyOrFinal()
  }, [
    activateKeys,
    batchSize,
    buildSlots,
    dayReviewKeys,
    reviewCursor,
    settling,
    startBossQuiz,
    startReview,
    startStudyOrFinal,
    task,
  ])

  const currentQuestion = useMemo<QuizQuestion | null>(() => {
    const slot = quizSlots[curQ]
    if (!slot) return null
    const entry = findWordByKey(vocab, slot.key)
    return entry ? { word: entry, type: slot.type } : null
  }, [curQ, quizSlots, vocab])

  const quizOptions = useMemo(() => {
    if (!currentQuestion) return []
    return buildQuizOptions(currentQuestion.word, vocab, curQ * 997 + quizSlots.length)
  }, [curQ, currentQuestion, quizSlots.length, vocab])

  const handleQuizCommit = useCallback(
    (info: QuizCommitInfo) => {
      const q = currentQuestion
      if (!q) return
      const key = wordKey(q.word)
      const outcome = { wordKey: key, correct: info.finalCorrect }

      if (phase === 'review') {
        reviewOutcomesRef.current.push(outcome)
        setReviewDoneKeys((prev) => new Set(prev).add(key))
      } else if (phase === 'final') {
        finalOutcomesRef.current.push(outcome)
        if (!info.finalCorrect) finalPassWrongKeysRef.current.add(key)
      } else if (phase === 'boss') {
        bossFirstPassOutcomesRef.current.push(outcome)
        if (!info.finalCorrect) bossPassWrongKeysRef.current.add(key)
      } else if (phase === 'boss_sink') {
        if (info.finalCorrect) {
          bossSinkOutcomesRef.current.push(outcome)
        } else {
          bossSinkWrongKeysRef.current.add(key)
        }
      }

      if (info.finalCorrect) {
        setScore((prev) => prev + 1)
        starsAwardedThisRoundRef.current += 1
        void awardStars('red', 1, { soundOnly: true })
      }
    },
    [awardStars, currentQuestion, phase],
  )

  const advanceQuiz = useCallback(() => {
    const next = curQ + 1
    if (next < quizSlots.length) {
      setCurQ(next)
      return
    }

    if (phase === 'review') {
      if (reviewCursor < dayReviewKeys.length) {
        const nextCursor = Math.min(reviewCursor + batchSize, dayReviewKeys.length)
        const nextKeys = dayReviewKeys.slice(reviewCursor, nextCursor)
        setReviewCursor(nextCursor)
        setQuizSlots((prev) => [...prev, ...buildSlots(nextKeys, true)])
        setCurQ(next)
        return
      }
      setIsImmersive(false)
      startStudyOrFinal()
      return
    }

    if (phase === 'final') {
      const wrongKeys = [...finalPassWrongKeysRef.current]
      if (wrongKeys.length > 0) {
        startFinalQuiz(wrongKeys)
        return
      }
      void settleSession()
      return
    }

    if (phase === 'boss') {
      const wrongKeys = [...bossPassWrongKeysRef.current]
      if (wrongKeys.length > 0) {
        startBossQuiz(wrongKeys, 'boss_sink')
        return
      }
      void settleBossSession()
      return
    }

    if (phase === 'boss_sink') {
      const wrongKeys = [...bossSinkWrongKeysRef.current]
      if (wrongKeys.length > 0) {
        startBossQuiz(wrongKeys, 'boss_sink')
        return
      }
      void settleBossSession()
    }
  }, [
    batchSize,
    buildSlots,
    curQ,
    dayReviewKeys,
    phase,
    quizSlots.length,
    reviewCursor,
    setIsImmersive,
    settleBossSession,
    settleSession,
    startBossQuiz,
    startFinalQuiz,
    startStudyOrFinal,
  ])

  const handleHelpReveal = useCallback(() => {
    if (!currentQuestion) return
    const key = wordKey(currentQuestion.word)
    setHelpClicks((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }))
  }, [currentQuestion])

  const runner = useQuizRunner({
    question: currentQuestion,
    onCommit: handleQuizCommit,
    onAdvance: advanceQuiz,
    allowRetry: phase !== 'boss' && phase !== 'boss_sink',
  })

  if (plansLoading || isLoadingRows) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--wm-text-dim)]">
        加载中…
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-[560px] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="text-[1.05rem] font-extrabold text-[#f0abfc]">计划数据异常</div>
        <div className="text-sm leading-relaxed text-[var(--wm-text-dim)]">{loadError}</div>
        <div className="text-[.75rem] text-[var(--wm-text-dim)]">
          新计划第一次执行本应有「今日新学」。若进度表为空，新词不会出现。
        </div>
        <button
          type="button"
          onClick={onBack}
          className="font-nunito cursor-pointer rounded-full border border-[var(--wm-border)] px-4 py-2 text-sm font-bold text-[#93c5fd]"
        >
          ← 返回
        </button>
      </div>
    )
  }

  if (!plan || !task) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="text-sm text-[var(--wm-text-dim)]">自适应计划不存在或已删除</div>
        <button
          onClick={onBack}
          className="font-nunito cursor-pointer rounded-full border border-[var(--wm-border)] px-4 py-2 text-sm font-bold text-[var(--wm-text-dim)]"
        >
          ← 返回
        </button>
      </div>
    )
  }

  if (task.mode === 'boss' && phase === 'hub') {
    return (
      <div className="mx-auto max-w-[980px] px-4 py-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="font-nunito cursor-pointer rounded-full border border-[var(--wm-border)] px-4 py-2 text-sm font-bold text-[var(--wm-text-dim)]"
          >
            ← 返回
          </button>
        </div>
        <div className="rounded-[22px] border border-[rgba(245,158,11,.35)] bg-[rgba(245,158,11,.08)] p-8">
          <div className="font-fredoka mb-3 text-center text-3xl text-[#fbbf24]">
            今日关卡 Boss
          </div>
          <div className="mx-auto mb-6 max-w-[620px] text-center text-sm font-bold text-[var(--wm-text-dim)]">
            首轮正确率达到 85%，并把沉底错题清空，就能退出 Boss 模式继续推进计划。
          </div>
          <div className="mb-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-[16px] border border-white/[.08] bg-white/[.045] p-4 text-center">
              <div className="text-2xl font-black text-[#fbbf24]">{task.bossKeys.length}</div>
              <div className="mt-1 text-xs font-extrabold text-[var(--wm-text-dim)]">Boss 题数</div>
            </div>
            <div className="rounded-[16px] border border-white/[.08] bg-white/[.045] p-4 text-center">
              <div className="text-2xl font-black text-[#f0abfc]">{plan.stats.bossFailStreak}</div>
              <div className="mt-1 text-xs font-extrabold text-[var(--wm-text-dim)]">连续受阻</div>
            </div>
            <div className="rounded-[16px] border border-white/[.08] bg-white/[.045] p-4 text-center">
              <div className="text-2xl font-black text-[#93c5fd]">{plan.stats.bossQuestionTier}</div>
              <div className="mt-1 text-xs font-extrabold text-[var(--wm-text-dim)]">题目层级</div>
            </div>
          </div>
          <button
            onClick={beginSession}
            disabled={settling || task.bossKeys.length === 0}
            className="font-nunito w-full cursor-pointer rounded-[14px] border-0 bg-gradient-to-br from-[#f59e0b] to-[#ef4444] px-6 py-3.5 text-base font-extrabold text-white shadow-[0_4px_18px_rgba(245,158,11,.28)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {settling ? '保存中…' : task.bossKeys.length === 0 ? '暂无 Boss 题' : '开始 Boss 挑战 →'}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'study') {
    const entry = activateEntries[studyIdx]
    if (!entry) {
      // Vocab race or empty — fall through to final / empty-state instead of blank flash
      return (
        <div className="mx-auto max-w-[560px] px-4 py-16 text-center">
          <div className="mb-3 text-sm font-bold text-[var(--wm-text-dim)]">正在准备新词…</div>
          <button
            type="button"
            className="font-nunito cursor-pointer rounded-full border border-[var(--wm-border)] px-4 py-2 text-sm font-bold text-[#93c5fd]"
            onClick={() => {
              const wrongReviewKeys = [...collapseSessionOutcomes(reviewOutcomesRef.current)]
                .filter(([, correct]) => !correct)
                .map(([key]) => key)
              const keys = uniqueKeys([...activateKeys, ...wrongReviewKeys])
              if (keys.length === 0) {
                setPhase('hub')
                return
              }
              startFinalQuiz(keys)
            }}
          >
            跳过认读，直接闯关 →
          </button>
        </div>
      )
    }

    return (
      <StudyPhase
        entry={entry}
        currentIdx={studyIdx}
        totalCount={activateEntries.length}
        title="今日新学"
        studyDefOnly={studyDefOnly}
        onStudyDefOnlyChange={setStudyDefOnly}
        isImmersive={isImmersive}
        onExitImmersive={() => setIsImmersive(false)}
        progressGradientClasses="from-[#60a5fa] via-[#a78bfa] to-[#f0abfc]"
        nextButtonGradientClasses="from-[#2563eb] to-[#a855f7]"
        nextButtonShadowClass="shadow-[0_3px_12px_rgba(96,165,250,.35)]"
        wordBadge={
          <span className="rounded-full border border-[rgba(96,165,250,.35)] bg-[rgba(96,165,250,.16)] px-2 py-0.5 text-[.6rem] font-extrabold tracking-wider text-[#93c5fd] uppercase">
            新学
          </span>
        }
        onBack={() => setPhase('hub')}
        onPrev={() => setStudyIdx((idx) => Math.max(0, idx - 1))}
        onNext={() => {
          setNewStudyDone((done) => Math.max(done, studyIdx + 1))
          setStudyIdx((idx) => Math.min(idx + 1, activateEntries.length - 1))
        }}
        onComplete={() => {
          setNewStudyDone(activateEntries.length)
          const wrongReviewKeys = [...collapseSessionOutcomes(reviewOutcomesRef.current)]
            .filter(([, correct]) => !correct)
            .map(([key]) => key)
          startFinalQuiz(uniqueKeys([...activateKeys, ...wrongReviewKeys]))
        }}
        completeButtonText="开始闯关 →"
      />
    )
  }

  if ((phase === 'review' || phase === 'final' || phase === 'boss' || phase === 'boss_sink') && !currentQuestion) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-16 text-center">
        <div className="mb-3 text-sm font-bold text-[var(--wm-text-dim)]">题目准备中…</div>
        <button
          type="button"
          className="font-nunito cursor-pointer rounded-full border border-[var(--wm-border)] px-4 py-2 text-sm font-bold text-[#93c5fd]"
          onClick={() => {
            setIsImmersive(false)
            sessionStartedRef.current = false
            setPhase('hub')
          }}
        >
          ← 返回计划首页
        </button>
      </div>
    )
  }

  if ((phase === 'review' || phase === 'final' || phase === 'boss' || phase === 'boss_sink') && currentQuestion) {
    const title =
      phase === 'review'
        ? 'Step 1 · 今日复习'
        : phase === 'final'
          ? 'Step 3 · 混合闯关'
          : phase === 'boss'
            ? 'Boss · 首轮挑战'
            : 'Boss · 沉底清空'
    const possibleStars = quizSlots.reduce(
      (sum, slot) => sum + (slot.type === 'C' || slot.type === 'D' ? 2 : 1),
      0,
    )
    return (
      <div className="mx-auto max-w-[1280px] px-4 py-5">
        <div className="mb-3 flex flex-wrap items-center gap-3 py-2">
          <button
            onClick={() => {
              setIsImmersive(false)
              setPhase('hub')
            }}
            className="font-nunito shrink-0 cursor-pointer rounded-full border-[1.5px] border-[var(--wm-border)] bg-transparent px-3.5 py-1.5 text-[0.875rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent4)] hover:text-[var(--wm-accent4)]"
          >
            ← 回到计划
          </button>
          <div className="font-fredoka text-[1.1rem] text-[var(--wm-text)]">{title}</div>
          <div className="ml-auto text-[.78rem] font-bold text-[var(--wm-text-dim)]">
            {phase === 'boss' || phase === 'boss_sink' ? (
              <>
                首轮 {bossFirstPassOutcomesRef.current.filter((item) => item.correct).length}/
                {task.bossKeys.length}
                <span className="mx-2 text-white/20">·</span>
                沉底错题 {phase === 'boss_sink' ? quizSlots.length : bossPassWrongKeysRef.current.size}
              </>
            ) : (
              <>
                今日新学 {newStudyDone}/{activateKeys.length}
                <span className="mx-2 text-white/20">·</span>
                今日复习 {reviewDoneKeys.size}/{visibleReviewKeys.length}
              </>
            )}
          </div>
        </div>
        <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5">
          <StarProgressBar
            color="red"
            target={Math.max(1, possibleStars)}
            label="本次练习红月亮"
            compact
          />
          <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] font-bold text-rose-700/70">
            <span>本次已得 {starSession.red} 红🌙</span>
            <span>本轮目标 {possibleStars} 红🌙</span>
            <span>
              题型 {currentQuestion.type} ·{' '}
              {currentQuestion.type === 'C' || currentQuestion.type === 'D' ? '+2⭐/题' : '+1⭐/题'}
            </span>
          </div>
        </div>
        <QuizQuestionBody
          question={currentQuestion}
          options={quizOptions}
          score={score}
          total={quizSlots.length}
          runner={runner}
          questionKey={`${phase}-${curQ}-${currentQuestion.word.word}`}
          helpRevealed={helpClicks[wordKey(currentQuestion.word)] ?? 0}
          onHelpReveal={handleHelpReveal}
        />
      </div>
    )
  }

  if (phase === 'done') {
    const canContinue =
      plan.status !== 'completed' &&
      task != null &&
      (task.reviewKeys.length > 0 || task.activateKeys.length > 0 || task.bossKeys.length > 0)
    const summary = roundSummary
    const accuracy =
      summary && summary.correctCount + summary.wrongCount > 0
        ? Math.round((summary.correctCount / (summary.correctCount + summary.wrongCount)) * 100)
        : null

    return (
      <div className="mx-auto max-w-[720px] px-4 py-8">
        <div className="rounded-[22px] border border-[rgba(74,222,128,.35)] bg-[rgba(74,222,128,.08)] p-6 sm:p-8">
          <div className="text-center">
            <div className="mb-2 text-[2.5rem]">
              {summary && accuracy != null
                ? accuracy >= 90
                  ? '🏆'
                  : accuracy >= 70
                    ? '🎉'
                    : accuracy >= 50
                      ? '👍'
                      : '💪'
                : '✨'}
            </div>
            <div className="font-fredoka mb-2 text-3xl text-[#86efac]">{doneTitle}</div>
            <div className="mb-5 text-sm font-bold text-[var(--wm-text-dim)]">{doneMessage}</div>
          </div>

          {summary && summary.kind !== 'empty' && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/[.08] bg-white/[.04] px-3 py-3 text-center">
                  <div className="text-[.68rem] font-extrabold text-[var(--wm-text-dim)]">新学</div>
                  <div className="font-fredoka text-2xl text-[#93c5fd]">{summary.newLearnedCount}</div>
                </div>
                <div className="rounded-2xl border border-white/[.08] bg-white/[.04] px-3 py-3 text-center">
                  <div className="text-[.68rem] font-extrabold text-[var(--wm-text-dim)]">复习</div>
                  <div className="font-fredoka text-2xl text-[#c4b5fd]">{summary.reviewedCount}</div>
                </div>
                <div className="rounded-2xl border border-white/[.08] bg-white/[.04] px-3 py-3 text-center">
                  <div className="text-[.68rem] font-extrabold text-[var(--wm-text-dim)]">答错</div>
                  <div className="font-fredoka text-2xl text-[#f87171]">{summary.wrongCount}</div>
                </div>
                <div className="rounded-2xl border border-white/[.08] bg-white/[.04] px-3 py-3 text-center">
                  <div className="text-[.68rem] font-extrabold text-[var(--wm-text-dim)]">红月亮</div>
                  <div className="font-fredoka text-2xl text-[#fbbf24]">{summary.starsEarned}</div>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[.78rem] font-bold text-[var(--wm-text-dim)]">
                {accuracy != null && <span>正确率 {accuracy}%</span>}
                <span>成长 {summary.promotedCount}</span>
                <span>新掌握 {summary.masteredCount}</span>
                <span>答题 {summary.questionCount}</span>
              </div>

              {summary.words.length > 0 && (
                <div className="mb-5 max-h-[280px] overflow-y-auto rounded-2xl border border-[var(--wm-border)] bg-[var(--wm-surface)]">
                  <div className="sticky top-0 border-b border-[var(--wm-border)] bg-[var(--wm-surface)] px-4 py-2 text-left text-[.72rem] font-extrabold tracking-wide text-[var(--wm-text-dim)] uppercase">
                    本轮单词状态
                  </div>
                  <div className="divide-y divide-white/[.06]">
                    {summary.words.map((item) => (
                      <div
                        key={item.wordKey}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 text-left"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[.95rem] font-extrabold text-[var(--wm-text)]">
                            {item.word}
                          </div>
                          <div className="text-[.72rem] font-bold text-[var(--wm-text-dim)]">
                            {item.statusLabel}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[.68rem] font-extrabold ${
                            item.mastered
                              ? 'border-[rgba(74,222,128,.35)] bg-[rgba(74,222,128,.12)] text-[#86efac]'
                              : item.correct
                                ? 'border-[rgba(96,165,250,.35)] bg-[rgba(96,165,250,.12)] text-[#93c5fd]'
                                : 'border-[rgba(248,113,113,.35)] bg-[rgba(248,113,113,.12)] text-[#f87171]'
                          }`}
                        >
                          {item.mastered ? '已掌握' : item.correct ? '答对' : '答错'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            {canContinue && (
              <button
                type="button"
                onClick={() => {
                  setRoundSummary(null)
                  setPhase('hub')
                }}
                className="font-nunito cursor-pointer rounded-[12px] border-0 bg-gradient-to-br from-[#2563eb] to-[#a855f7] px-6 py-3 text-sm font-extrabold text-white"
              >
                再练一轮 →
              </button>
            )}
            <button
              type="button"
              onClick={onBack}
              className="font-nunito cursor-pointer rounded-[12px] border border-[rgba(74,222,128,.4)] bg-transparent px-6 py-3 text-sm font-extrabold text-[#86efac]"
            >
              返回单词页
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="font-nunito cursor-pointer rounded-full border border-[var(--wm-border)] px-4 py-2 text-sm font-bold text-[var(--wm-text-dim)]"
        >
          ← 返回
        </button>
        <div className="rounded-full border border-[rgba(96,165,250,.3)] bg-[rgba(96,165,250,.08)] px-3 py-1 text-[.72rem] font-extrabold text-[#93c5fd]">
          {task.mode === 'review_only' ? 'Review Only' : 'Normal'}
        </div>
      </div>

      <div className="mb-4 rounded-[24px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-6">
        <div className="mb-5">
          <div className="font-fredoka bg-gradient-to-br from-[#60a5fa] to-[#f0abfc] bg-clip-text text-3xl text-transparent">
            {plan.title}
          </div>
          <div className="mt-1 text-sm font-bold text-[var(--wm-text-dim)]">
            每日至少练一轮：复习 → 新学（每轮最多 {plan.newWordsPerDay} 词）→ 闯关；同日可多轮，错词会继续出现
            <span className="mt-1 block text-[.72rem] font-bold text-[#93c5fd]">
              成长阶段：🥚蛋 → 🐛虫 → 🦋蝴蝶 → 🌸花 → 🌳树；题型随阶段递进
            </span>
            <span className="mt-1 block text-[.72rem] font-bold text-[var(--wm-text-dim)]">
              计划内 {rows.filter((r) => r.archivedAt == null).length} 词 · 本轮新学名额{' '}
              {activateKeys.length} · 本轮复习 {dayReviewKeys.length}
            </span>
          </div>
        </div>

        <div className="mb-5">
          <AdaptivePlanProgressBar rows={rows} />
        </div>

        <div className="mb-5">
          <AdaptivePlanStageBoard rows={rows} vocab={vocab} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[16px] border border-white/[.08] bg-white/[.035] p-4">
            <div className="mb-1 text-[.72rem] font-extrabold text-[#c4b5fd]">Step 1</div>
            <div className="text-lg font-black text-[var(--wm-text)]">本轮复习</div>
            <div className="mt-1 text-sm font-bold text-[var(--wm-text-dim)]">
              {reviewDoneKeys.size} / {visibleReviewKeys.length}
            </div>
          </div>
          <div className="rounded-[16px] border border-white/[.08] bg-white/[.035] p-4">
            <div className="mb-1 text-[.72rem] font-extrabold text-[#93c5fd]">Step 2</div>
            <div className="text-lg font-black text-[var(--wm-text)]">本轮新学</div>
            <div className="mt-1 text-sm font-bold text-[var(--wm-text-dim)]">
              {newStudyDone} / {activateKeys.length}
            </div>
          </div>
          <div className="rounded-[16px] border border-white/[.08] bg-white/[.035] p-4">
            <div className="mb-1 text-[.72rem] font-extrabold text-[#86efac]">Step 3</div>
            <div className="text-lg font-black text-[var(--wm-text)]">混合闯关</div>
            <div className="mt-1 text-sm font-bold text-[var(--wm-text-dim)]">
              新词 + Step 1 错题
            </div>
          </div>
        </div>

        <button
          onClick={beginSession}
          disabled={settling}
          className="font-nunito mt-6 w-full cursor-pointer rounded-[14px] border-0 bg-gradient-to-br from-[#2563eb] to-[#a855f7] px-6 py-3.5 text-base font-extrabold text-white shadow-[0_4px_18px_rgba(96,165,250,.28)] disabled:cursor-wait disabled:opacity-60"
        >
          {settling ? '保存中…' : '开始本轮练习 →'}
        </button>
      </div>
    </div>
  )
}
