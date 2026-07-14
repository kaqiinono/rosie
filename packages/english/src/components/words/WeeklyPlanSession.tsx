'use client'

import { useState, useMemo, useCallback, useRef, useEffect, type MutableRefObject } from 'react'
import type { WordEntry, WeeklyPlan, WeekDayProgress, RescueRole, WeeklyPlanSessionStash } from '@rosie/core'
import {
  encodeWeeklyPlanProgress,
  pickBestPendingSnapshot,
  weeklySessionStorageKey,
} from '../../utils/weeklyPlanProgress'
import {
  buildQuizOptions,
  buildReinforcementQuestions,
  classifyPlanWords,
  getDailySessionWords,
  interleaveOrderedQuizSlots,
  normalizeQuizTypes,
  shuffle,
  wordKey,
  ALL_CN_DAYS,
  fmtDate,
  fmtWeekRange,
  formatPlanLessonLabel,
  lessonChipTag,
} from '../../utils/english-helpers'
import { getWordMasteryLevel, MASTERY_ICON, CONSOLIDATE_PASS_STAGE } from '@rosie/core'
import { findPassage, findSentenceForWord } from '../../utils/reading-data'
import QuizQuestionBody from './QuizQuestionBody'
import { useQuizRunner } from './useQuizRunner'
import type { QuizCommitInfo } from './useQuizRunner'
import { useRescueQueue } from '../../hooks/useRescueQueue'
import MonsterEatScene from './MonsterEatScene'
import RescueListBadge from './RescueListBadge'
import RescueReviewCarousel from './RescueReviewCarousel'
import RescueCompletionView from './RescueCompletionView'
import MasteryStatusPanel from './MasteryStatusPanel'
import StudyPhase from './StudyPhase'
import DoneSummary from './DoneSummary'
import { useAuth } from '@rosie/core'
import { useWordsContext } from '../../WordsContext'
import { useImmersive } from '@rosie/core'
import { useStarHud } from '@rosie/rewards'
import { StarProgressBar } from '@rosie/rewards'
import { supabase } from '@rosie/core'
import { todayStr } from '@rosie/core'

interface WeeklyPlanSessionProps {
  initialPlan: WeeklyPlan
  vocab: WordEntry[]
  onBack: () => void
}

type Phase = 'week-view' | 'study' | 'quiz' | 'done'

type WordKind = 'consolidate' | 'preview'

interface DpQuizQ {
  word: WordEntry
  type: 'A' | 'B' | 'C' | 'D'
  kind: WordKind
  revealedHalf?: number
  rescueRole?: RescueRole
}

function getWeekDayLabels(startDay: number): string[] {
  return Array.from({ length: 7 }, (_, i) => ALL_CN_DAYS[(startDay + i) % 7])
}

function applySnapshotToState(
  snap: WeeklyPlanSessionStash,
  vocab: WordEntry[],
  handlers: {
    setSelectedDate: (d: string | null) => void
    setCurrentSubTask: (t: 'all' | 'consolidate' | 'preview') => void
    setWordKeys: (w: { key: string; kind: WordKind }[]) => void
    setStudyIdx: (n: number) => void
    setQuizQKeys: (q: { key: string; type: 'A' | 'B' | 'C' | 'D'; kind: WordKind; revealedHalf?: number; rescueRole?: RescueRole }[]) => void
    setCurQ: (n: number) => void
    setScore: (n: number) => void
    setPhase: (p: Phase) => void
    quizResultBuffer: MutableRefObject<{ entry: WordEntry; correct: boolean }[]>
  },
): void {
  handlers.setSelectedDate(snap.selectedDate || null)
  handlers.setCurrentSubTask(snap.subTask)
  handlers.setWordKeys(snap.words)
  handlers.setStudyIdx(snap.studyIdx)
  handlers.setQuizQKeys(
    snap.quizQs.map((q) => ({
      ...q,
      rescueRole: q.rescueRole as RescueRole | undefined,
    })),
  )
  handlers.setCurQ(snap.curQ)
  handlers.setScore(snap.quizResults.filter((r) => r.correct).length)
  handlers.quizResultBuffer.current = snap.quizResults
    .map(({ key, correct }) => {
      const entry = vocab.find((w) => wordKey(w) === key)
      return entry ? { entry, correct } : null
    })
    .filter((r): r is { entry: WordEntry; correct: boolean } => r !== null)
  handlers.setPhase(snap.phase)
}

async function saveProgressToCloud(
  userId: string,
  plan: WeeklyPlan,
  pendingSession?: WeeklyPlanSessionStash | null,
): Promise<void> {
  if (!plan.id) return
  try {
    await supabase
      .from('weekly_plans')
      .update({
        progress_data: encodeWeeklyPlanProgress(
          plan.progress,
          plan.weekCompletion,
          pendingSession ?? plan.pendingSession ?? null,
        ),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('id', plan.id)
  } catch {
    /* ignore */
  }
}

export default function WeeklyPlanSession({ initialPlan, vocab, onBack }: WeeklyPlanSessionProps) {
  const { user } = useAuth()
  const { masteryMap, recordBatch, practiceButtonStyle, setPracticeButtonStyle } =
    useWordsContext()
  const { isImmersive, setIsImmersive } = useImmersive()
  const { awardStars, session: starSession } = useStarHud()
  const exitImmersive = useCallback(() => setIsImmersive(false), [setIsImmersive])

  const [plan, setPlan] = useState<WeeklyPlan>(initialPlan)
  const planRef = useRef<WeeklyPlan>(initialPlan)
  useEffect(() => {
    planRef.current = plan
  }, [plan])

  // Read sessionStorage exactly once via a lazy-init state (immutable after mount, not a ref)
  const [snap0] = useState(() =>
    pickBestPendingSnapshot(initialPlan.id, initialPlan.pendingSession),
  )
  const hydrationDone = useRef(false)
  const [isStashing, setIsStashing] = useState(false)
  const [stashToast, setStashToast] = useState<string | null>(null)

  const [phase, setPhase] = useState<Phase>(() => snap0?.phase ?? 'week-view')
  const [selectedDate, setSelectedDate] = useState<string | null>(() => snap0?.selectedDate ?? null)
  // When restoring a session, skip the "first unfinished day" defaulting by pre-seeding syncedPlanId
  const [syncedPlanId, setSyncedPlanId] = useState<string | undefined>(() =>
    snap0 ? initialPlan.id : undefined,
  )
  if (plan.id !== syncedPlanId) {
    setSyncedPlanId(plan.id)
    // When restoring an in-progress session, keep the snapshotted day — don't
    // overwrite with "today / first unfinished".
    if (!snap0) {
      const today = todayStr()
      const todayDay = plan.days.find((d) => d.date === today)
      const firstUnfinished = plan.days.find((d) => !plan.progress[d.date]?.quizDone)
      setSelectedDate(
        todayDay?.date ?? firstUnfinished?.date ?? plan.days[plan.days.length - 1]?.date ?? null,
      )
    }
  }

  const [consolidateTypes, setConsolidateTypes] = useState<Set<'A' | 'B' | 'C' | 'D'>>(
    new Set(['A', 'C', 'D']),
  )
  const [previewTypes, setPreviewTypes] = useState<Set<'A' | 'B' | 'C' | 'D'>>(
    new Set(['A', 'B']),
  )

  // Type D is enabled per-word based on whether the word's own lesson has a
  // passage sentence — completely decoupled from the plan's ⭐ focus marker
  // (which is a plan-level annotation, not a feature gate).
  const isEligibleForTypeD = useCallback(
    (entry: WordEntry) => {
      const p = findPassage(entry.stage, entry.unit, entry.lesson)
      return p !== undefined && findSentenceForWord(p, entry.word) !== null
    },
    [],
  )

  // Words and quiz questions are stored as key arrays; actual WordEntry objects are derived via useMemo
  // so they hydrate automatically when vocab loads — no setState-in-effect required
  const [wordKeys, setWordKeys] = useState<{ key: string; kind: WordKind }[]>(
    () => snap0?.words ?? [],
  )
  const words = useMemo(
    () =>
      wordKeys
        .map(({ key, kind }) => {
          const entry = vocab.find((w) => wordKey(w) === key)
          return entry ? { entry, kind } : null
        })
        .filter((w): w is { entry: WordEntry; kind: WordKind } => w !== null),
    [wordKeys, vocab],
  )

  const [studyIdx, setStudyIdx] = useState(() => snap0?.studyIdx ?? 0)
  const [studyDefOnly, setStudyDefOnly] = useState(false)
  const [currentSubTask, setCurrentSubTask] = useState<'all' | 'consolidate' | 'preview'>(
    () => snap0?.subTask ?? 'all',
  )

  const [quizQKeys, setQuizQKeys] = useState<{ key: string; type: 'A' | 'B' | 'C' | 'D'; kind: WordKind; revealedHalf?: number; rescueRole?: RescueRole }[]>(
    () =>
      snap0?.quizQs.map((q) => ({
        ...q,
        rescueRole: q.rescueRole as RescueRole | undefined,
      })) ?? [],
  )
  const quizQs = useMemo(
    () =>
      quizQKeys
        .map(({ key, type, kind, revealedHalf, rescueRole }): DpQuizQ | null => {
          const entry = vocab.find((w) => wordKey(w) === key)
          return entry ? { word: entry, type, kind, revealedHalf, rescueRole } : null
        })
        .filter((q): q is DpQuizQ => q !== null),
    [quizQKeys, vocab],
  )

  const [curQ, setCurQ] = useState(() => snap0?.curQ ?? 0)
  const [score, setScore] = useState(() => snap0?.quizResults.filter((r) => r.correct).length ?? 0)
  const [lastStarsEarned, setLastStarsEarned] = useState(0)
  // Actual ⭐ awarded during the current quiz run (main pass + reinforcement/rescue + 连对加成).
  // The done-screen "获得 N 颗星星" must equal this, NOT a base-point recompute — otherwise it
  // is silently capped at the main-round target and never reflects the bonus rounds.
  const starsAwardedThisRunRef = useRef(0)
  const quizResultBuffer = useRef<{ entry: WordEntry; correct: boolean }[]>([])
  // 🎈 帮助按钮：每揭一个字母 helpClicks[wordKey] += 1；练习结束后按计数追加 Type-C 巩固题。
  const [helpClicks, setHelpClicks] = useState<Record<string, number>>({})
  const [reinforcementAppended, setReinforcementAppended] = useState(false)
  const [mainPassSnapshot, setMainPassSnapshot] = useState<{ score: number; total: number } | null>(null)

  const rescue = useRescueQueue({ planId: plan.id ?? '', dateKey: selectedDate ?? 'none' })
  const [eatenScene, setEatenScene] = useState<{ entry: WordEntry; monsterIdx: number; isAbbreviated: boolean } | null>(null)
  // Eaten words to review in the manual carousel before the practice round begins.
  const [rescueReview, setRescueReview] = useState<WordEntry[] | null>(null)
  const eatenShownCountRef = useRef(0)

  // One-time: hydrate quizResultBuffer (ref write — no setState) and activate immersive mode
  useEffect(() => {
    if (hydrationDone.current || !snap0 || !vocab.length) return
    hydrationDone.current = true
    quizResultBuffer.current = snap0.quizResults
      .map(({ key, correct }) => {
        const entry = vocab.find((w) => wordKey(w) === key)
        return entry ? { entry, correct } : null
      })
      .filter((r): r is { entry: WordEntry; correct: boolean } => r !== null)
    setIsImmersive(true)
  }, [snap0, vocab, setIsImmersive])

  // Persist active session to sessionStorage on every relevant state change.
  // Only clear on completion — returning to week-view (e.g. study ← 返回) must
  // keep the snapshot so leaving the page and coming back resumes progress.
  useEffect(() => {
    if (!plan.id) return
    const key = weeklySessionStorageKey(plan.id)
    if (phase === 'done') {
      try { sessionStorage.removeItem(key) } catch { /* noop */ }
      return
    }
    if (phase === 'week-view') return
    if (phase !== 'study' && phase !== 'quiz') return
    try {
      const stash: WeeklyPlanSessionStash = {
        version: 3,
        savedAt: new Date().toISOString(),
        phase,
        selectedDate: selectedDate ?? '',
        subTask: currentSubTask,
        studyIdx,
        words: wordKeys,
        quizQs: quizQKeys,
        curQ,
        quizResults: quizResultBuffer.current
          .slice(0, curQ)
          .map(({ entry, correct }) => ({ key: wordKey(entry), correct })),
      }
      sessionStorage.setItem(key, JSON.stringify(stash))
    } catch { /* noop */ }
  }, [plan.id, phase, selectedDate, currentSubTask, studyIdx, wordKeys, quizQKeys, curQ])

  const cnDays = useMemo(() => getWeekDayLabels(plan.weekStartDay), [plan.weekStartDay])

  /** Unique plan words in calendar order (Thu→Wed), for mastery panel scope. */
  const planOrderedVocab = useMemo(() => {
    const byKey = new Map(vocab.map((w) => [wordKey(w), w]))
    const out: WordEntry[] = []
    const seen = new Set<string>()
    for (const d of plan.days) {
      for (const k of d.newWordKeys) {
        if (seen.has(k)) continue
        seen.add(k)
        const e = byKey.get(k)
        if (e) out.push(e)
      }
    }
    return out
  }, [plan.days, vocab])

  const updateDayProgress = useCallback(
    async (date: string, progress: WeekDayProgress) => {
      const current = planRef.current
      const updated: WeeklyPlan = {
        ...current,
        progress: { ...current.progress, [date]: progress },
      }
      planRef.current = updated
      setPlan(updated)
      if (user) void saveProgressToCloud(user.id, updated)
    },
    [user],
  )

  const buildSessionWords = useCallback(
    (dateStr: string) => {
      const dayIndex = plan.days.findIndex((d) => d.date === dateStr)
      if (dayIndex === -1) return []
      return getDailySessionWords(plan, vocab, masteryMap, dayIndex)
    },
    [plan, vocab, masteryMap],
  )

  const clearPendingSession = useCallback(async () => {
    if (!plan.id) return
    try { sessionStorage.removeItem(weeklySessionStorageKey(plan.id)) } catch { /* noop */ }
    if (!planRef.current.pendingSession) return
    const updated: WeeklyPlan = { ...planRef.current, pendingSession: undefined }
    planRef.current = updated
    setPlan(updated)
    if (user) await saveProgressToCloud(user.id, updated, null)
  }, [user, plan.id])

  const buildCurrentStash = useCallback((): WeeklyPlanSessionStash | null => {
    if (phase !== 'study' && phase !== 'quiz') return null
    return {
      version: 3,
      savedAt: new Date().toISOString(),
      phase,
      selectedDate: selectedDate ?? '',
      subTask: currentSubTask,
      studyIdx,
      words: wordKeys,
      quizQs: quizQKeys,
      curQ,
      quizResults: quizResultBuffer.current
        .slice(0, curQ)
        .map(({ entry, correct }) => ({ key: wordKey(entry), correct })),
    }
  }, [phase, selectedDate, currentSubTask, studyIdx, wordKeys, quizQKeys, curQ])

  const stashSession = useCallback(async () => {
    if (!user || !plan.id) return
    const stash = buildCurrentStash()
    if (!stash) return
    setIsStashing(true)
    try {
      sessionStorage.setItem(weeklySessionStorageKey(plan.id), JSON.stringify(stash))
      const updated: WeeklyPlan = { ...planRef.current, pendingSession: stash }
      planRef.current = updated
      setPlan(updated)
      await saveProgressToCloud(user.id, updated, stash)
      setStashToast('已暂存到云端，换设备也可继续')
      setPhase('week-view')
      exitImmersive()
    } finally {
      setIsStashing(false)
    }
  }, [user, plan.id, buildCurrentStash, exitImmersive])

  useEffect(() => {
    if (!stashToast) return
    const timer = window.setTimeout(() => setStashToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [stashToast])

  useEffect(() => {
    if (phase !== 'done' || !plan.id || !planRef.current.pendingSession) return
    const updated: WeeklyPlan = { ...planRef.current, pendingSession: undefined }
    planRef.current = updated
    setPlan(updated)
    if (user) void saveProgressToCloud(user.id, updated, null)
  }, [phase, plan.id, user])

  const startStudy = useCallback(
    (dateStr: string, subTask: 'all' | 'consolidate' | 'preview' = 'all') => {
      const relevantTypes = subTask === 'preview' ? previewTypes : consolidateTypes
      const anyTypeSelected =
        subTask === 'all'
          ? consolidateTypes.size + previewTypes.size > 0
          : relevantTypes.size > 0
      if (!anyTypeSelected) {
        alert('请至少选择一种题型！')
        return
      }
      const session = buildSessionWords(dateStr)
      const filtered =
        subTask === 'all' ? session : session.filter((s) => s.kind === subTask)
      if (filtered.length === 0) return
      void clearPendingSession()
      setCurrentSubTask(subTask)
      setWordKeys(filtered.map(({ entry, kind }) => ({ key: wordKey(entry), kind })))
      setStudyIdx(0)
      setStudyDefOnly(false)
      setSelectedDate(dateStr)
      setPhase('study')
      setIsImmersive(true)
      setQuizQKeys([])
      setCurQ(0)
      setScore(0)
      quizResultBuffer.current = []
    },
    [consolidateTypes, previewTypes, buildSessionWords, setIsImmersive, clearPendingSession],
  )

  const resumePendingSession = useCallback(() => {
    const snap = pickBestPendingSnapshot(plan.id, plan.pendingSession)
    if (!snap) return
    applySnapshotToState(snap, vocab, {
      setSelectedDate,
      setCurrentSubTask,
      setWordKeys,
      setStudyIdx,
      setQuizQKeys,
      setCurQ,
      setScore,
      setPhase,
      quizResultBuffer,
    })
    setIsImmersive(true)
  }, [plan.id, plan.pendingSession, vocab])

  const startQuiz = useCallback(() => {
    const seed = Date.now()
    const shuffled = shuffle(words, seed)
    const groups = shuffled.map(w => {
      const raw = w.kind === 'consolidate' ? consolidateTypes : previewTypes
      let types = normalizeQuizTypes(Array.from(raw))
      // Type D requires the word to be in the focus lesson AND have a passage sentence.
      // Filter out D for ineligible words rather than skipping the whole word.
      if (types.includes('D') && !isEligibleForTypeD(w.entry)) {
        types = types.filter(t => t !== 'D')
      }
      return types.map(t => ({ key: wordKey(w.entry), type: t, kind: w.kind }))
    })
    const qs = interleaveOrderedQuizSlots(groups, seed + 1)
    rescue.clear()
    quizResultBuffer.current = []
    setQuizQKeys(qs)
    setCurQ(0)
    setScore(0)
    setLastStarsEarned(0)
    starsAwardedThisRunRef.current = 0
    setHelpClicks({})
    setReinforcementAppended(false)
    setMainPassSnapshot(null)
    setPhase('quiz')
  }, [words, consolidateTypes, previewTypes, isEligibleForTypeD, rescue])

  const handleAnswer = useCallback(
    (info: QuizCommitInfo) => {
      const q = quizQs[curQ]
      if (!q) return
      const k = wordKey(q.word)
      if (info.finalCorrect) setScore((s) => s + 1)

      if (!q.rescueRole) {
        // main-round original question
        if (info.finalCorrect && info.usedRetry) {
          rescue.enqueueHalf(q.word, q.type, k)
        } else if (!info.finalCorrect) {
          const { monsterIdx } = rescue.enqueueEaten(q.word, q.type, k)
          const isAbbreviated = eatenShownCountRef.current > 0
          eatenShownCountRef.current += 1
          setEatenScene({ entry: q.word, monsterIdx, isAbbreviated })
        }
        quizResultBuffer.current.push({ entry: q.word, correct: info.finalCorrect })
      } else {
        // reinforcement/rescue-ladder question: advance its queue stage
        rescue.advance(k, info.finalCorrect ? 'correct' : 'wrong')
      }
      if (info.finalCorrect) {
        const amount = q.type === 'C' || q.type === 'D' ? 2 : 1
        starsAwardedThisRunRef.current += amount
        void awardStars('red', amount, { soundOnly: true })
      }
    },
    [quizQs, curQ, awardStars, rescue],
  )

  const nextQ = useCallback(() => {
    const next = curQ + 1
    if (next < quizQs.length) {
      setCurQ(next)
      return
    }

    // End of current pass. Append rescue ladder (half/eaten batches) and/or
    // help-reveal reinforcement if any words need it, and we haven't done so yet.
    if (!reinforcementAppended) {
      const { reviewWords, practice } = rescue.buildBatches(Date.now())
      const helpExtras = Object.values(helpClicks).some((c) => c > 0)
        ? buildReinforcementQuestions(helpClicks, vocab, wordKey, Date.now() + 1)
        : []
      const extras = [...practice, ...helpExtras]
      if (extras.length > 0) {
        const mainScore = quizResultBuffer.current.filter((r) => r.correct).length
        setMainPassSnapshot({ score: mainScore, total: quizQs.length })
        const kindByKey = new Map<string, WordKind>()
        for (const q of quizQs) kindByKey.set(wordKey(q.word), q.kind)
        const newKeys = extras.map((q) => ({
          key: wordKey(q.word),
          type: q.type,
          kind: kindByKey.get(wordKey(q.word)) ?? ('consolidate' as WordKind),
          revealedHalf: q.revealedHalf,
          // help-reinforcement questions have no rescueRole; tag them so they are treated as
          // reinforcement (no buffer row, no monster) rather than main-round originals.
          rescueRole: q.rescueRole ?? ('reinforce-half' as RescueRole),
        }))
        setQuizQKeys((prev) => [...prev, ...newKeys])
        setReinforcementAppended(true)
        // Eaten words get a manual review carousel (回看) before practice begins.
        if (reviewWords.length > 0) setRescueReview(reviewWords)
        setCurQ(next)
        return
      }
    }

    // Truly done — day progress reflects main-pass score (snapshot if reinforcement ran).
    const baseScore = mainPassSnapshot?.score ?? quizResultBuffer.current.filter((r) => r.correct).length
    const baseTotal = mainPassSnapshot?.total ?? quizQs.length
    const pct = baseTotal > 0 ? Math.round((baseScore / baseTotal) * 100) : 0
    if (selectedDate) {
        const existing = planRef.current.progress[selectedDate] ?? {}

        if (currentSubTask === 'all') {
          // Original behavior: mark the whole day done
          void updateDayProgress(selectedDate, {
            quizDone: true,
            lastScore: pct,
            completedAt: todayStr(),
          })
        } else {
          // Sub-task behavior: only mark the sub-task done
          const consolidateDone =
            currentSubTask === 'consolidate' ? true : existing.consolidateDone
          const previewDone =
            currentSubTask === 'preview' ? true : existing.previewDone

          const dayIndex = planRef.current.days.findIndex((d) => d.date === selectedDate)
          const session = getDailySessionWords(planRef.current, vocab, masteryMap, dayIndex)
          const hasPreview = session.some((s) => s.kind === 'preview')
          const quizDone =
            consolidateDone === true && (!hasPreview || previewDone === true)

          void updateDayProgress(selectedDate, {
            ...existing,
            quizDone,
            lastScore: pct,
            completedAt: existing.completedAt ?? todayStr(),
            consolidateDone,
            previewDone,
            ...(currentSubTask === 'consolidate'
              ? { consolidateScore: pct }
              : { previewScore: pct }),
          })
        }
      }
    const allRescue = [...rescue.retryList, ...rescue.eatenList]
    const masteryBatch: { entry: WordEntry; correct: boolean }[] = []
    for (const r of quizResultBuffer.current) {
      const k = wordKey(r.entry)
      const queueItem = allRescue.find((i) => i.wordKey === k)
      if (queueItem) {
        // Record each rescued/half word's FINAL demonstrated outcome as one result.
        // recordBatch aggregates per word: all-correct advances the stage, majority-wrong
        // regresses it. A {true,false} pair counts as majority-wrong (1 of 2) and would
        // REGRESS — so we never mix; we record the single honest final verdict instead.
        if (queueItem.stage === 'consolidated' || queueItem.stage === 'saved') {
          // half word recovered, or eaten word climbed the rescue ladder → reward (advance)
          masteryBatch.push({ entry: r.entry, correct: true })
        } else if (queueItem.stage === 'still_half' || queueItem.stage === 'lost') {
          // reinforcement / rescue ladder ultimately failed → one gentle regress
          masteryBatch.push({ entry: r.entry, correct: false })
        } else {
          // unexpected intermediate stage at completion — fall back to the actual main result
          masteryBatch.push({ entry: r.entry, correct: r.correct })
        }
      } else {
        // plain main-round word that was never enqueued (answered cleanly or wrong-without-rescue)
        masteryBatch.push({ entry: r.entry, correct: r.correct })
      }
    }
    recordBatch(masteryBatch)
    // Stars are already awarded per-question via handleAnswer above. Surface the REAL running
    // total here (main pass + reinforcement/rescue + 连对加成) so "获得 N 颗星星" matches
    // "本次已得". A base-point recompute would miss the bonus rounds and cap at the target.
    setLastStarsEarned(starsAwardedThisRunRef.current)
    quizResultBuffer.current = []
    setPhase('done')
  }, [curQ, quizQs, helpClicks, reinforcementAppended, mainPassSnapshot, selectedDate, currentSubTask, vocab, masteryMap, updateDayProgress, recordBatch, rescue])

  const currentQuestion = quizQs[curQ] ?? null

  const quizOptions = useMemo(() => {
    if (!currentQuestion) return []
    const seed = curQ * 997 + quizQs.length
    return buildQuizOptions(currentQuestion.word, vocab, seed)
  }, [currentQuestion, curQ, quizQs.length, vocab])

  const runner = useQuizRunner({
    question: currentQuestion,
    onCommit: handleAnswer,
    onAdvance: nextQ,
  })

  const handleHelpReveal = useCallback(() => {
    if (!currentQuestion) return
    const k = wordKey(currentQuestion.word)
    setHelpClicks((prev) => ({ ...prev, [k]: (prev[k] ?? 0) + 1 }))
  }, [currentQuestion])

  const helpRevealedForCurrent = currentQuestion ? (helpClicks[wordKey(currentQuestion.word)] ?? 0) : 0
  const inReinforcement = reinforcementAppended && mainPassSnapshot !== null && curQ >= mainPassSnapshot.total

  const planClassification = useMemo(() => classifyPlanWords(plan, vocab), [plan, vocab])

  const { consolidateTotal, consolidateMet } = useMemo(() => {
    const keys: string[] = []
    for (const [k, kind] of planClassification) if (kind === 'consolidate') keys.push(k)
    const met = keys.filter(k => (masteryMap[k]?.stage ?? 0) >= 2).length
    return { consolidateTotal: keys.length, consolidateMet: met }
  }, [planClassification, masteryMap])

  const isLastDayToday = plan.days[plan.days.length - 1]?.date === todayStr()
  const showSundayBanner = isLastDayToday && consolidateTotal - consolidateMet > 0

  // ── WEEK VIEW ────────────────────────────────────────────────────────────
  if (phase === 'week-view') {
    const today = todayStr()
    const kindMap = classifyPlanWords(plan, vocab)
    const lastDay = plan.days[plan.days.length - 1]
    const isLastDay = lastDay?.date === today

    // Progress bar data
    const allConsolidateKeys = [...kindMap.entries()]
      .filter(([, k]) => k === 'consolidate')
      .map(([key]) => key)
    const consolidateTotal = allConsolidateKeys.length
    const consolidateDone = allConsolidateKeys.filter(k => {
      const m = masteryMap[k]
      return m !== undefined && (m.stage ?? 0) >= CONSOLIDATE_PASS_STAGE
    }).length

    // Sunday fallback: unmastered consolidate words
    const unmasteredConsolidate = consolidateTotal - consolidateDone

    const pendingSessionSnap = pickBestPendingSnapshot(plan.id, plan.pendingSession)
    const hasPendingResume = pendingSessionSnap !== null
    const pendingDate = pendingSessionSnap?.selectedDate ?? selectedDate
    const pendingDayIndex = pendingDate
      ? plan.days.findIndex((d) => d.date === pendingDate)
      : -1
    const pendingProgressLine = (() => {
      if (pendingSessionSnap?.phase === 'quiz') {
        const total = pendingSessionSnap.quizQs.length
        return `测试阶段 · 第 ${pendingSessionSnap.curQ + 1}/${total} 题`
      }
      if (pendingSessionSnap?.phase === 'study') {
        const total = pendingSessionSnap.words.length
        return `记忆阶段 · 第 ${pendingSessionSnap.studyIdx + 1}/${total} 个词`
      }
      if (quizQKeys.length > 0) {
        return `测试阶段 · 第 ${curQ + 1}/${quizQKeys.length} 题`
      }
      if (wordKeys.length > 0) {
        return `记忆阶段 · 第 ${studyIdx + 1}/${wordKeys.length} 个词`
      }
      return ''
    })()

    return (
      <>
        <div className="mx-auto max-w-[1280px] px-4 py-5">
          <div className="rounded-[20px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-7">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="font-fredoka bg-gradient-to-br from-[#f59e0b] to-[#f97316] bg-clip-text text-2xl text-transparent">
                  {formatPlanLessonLabel(plan.unit, plan.lesson)}
                </div>
                <div className="mt-1 text-[.75rem] font-bold text-[var(--wm-text-dim)]">
                  {fmtWeekRange(plan.weekStart, plan.weekStartDay)}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  onClick={onBack}
                  className="font-nunito cursor-pointer rounded-full border-[1.5px] border-[var(--wm-border)] bg-transparent px-4 py-1.5 text-[.75rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]"
                >
                  ← 返回列表
                </button>
                {isImmersive && (
                  <button
                    onClick={exitImmersive}
                    className="cursor-pointer rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[.72rem] font-bold text-white/55 transition-all hover:bg-white/20 hover:text-white/80"
                  >
                    ✕ 退出沉浸
                  </button>
                )}
              </div>
            </div>

            {stashToast && (
              <div className="mt-4 rounded-[12px] border border-[rgba(74,222,128,.45)] bg-[rgba(74,222,128,.1)] px-4 py-2.5 text-[.8rem] font-bold text-[#86efac]">
                ✓ {stashToast}
              </div>
            )}

            {hasPendingResume && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[rgba(245,158,11,.45)] bg-[rgba(245,158,11,.1)] px-4 py-3">
                <div className="min-w-0">
                  <div className="text-[.85rem] font-extrabold text-[#fbbf24]">你有未完成的练习</div>
                  <div className="mt-0.5 text-[.72rem] font-bold text-[var(--wm-text-dim)]">
                    {pendingDate && pendingDayIndex >= 0
                      ? `${fmtDate(pendingDate)} ${cnDays[pendingDayIndex]}`
                      : pendingDate
                        ? fmtDate(pendingDate)
                        : '本周练习'}
                    {pendingProgressLine ? ` · ${pendingProgressLine}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resumePendingSession}
                  className="font-nunito shrink-0 cursor-pointer rounded-full border-0 bg-gradient-to-br from-[#d97706] to-[#f59e0b] px-5 py-2 text-[.82rem] font-extrabold text-white shadow-[0_3px_12px_rgba(245,158,11,.35)] transition-all hover:-translate-y-px"
                >
                  ▶ 继续练习
                </button>
              </div>
            )}

            {consolidateTotal > 0 && (
              <div className="mt-3 rounded-[12px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-4 py-2.5">
                <div className="mb-1.5 flex items-center justify-between text-[.7rem] font-bold">
                  <span className="text-[#93c5fd]">本周必记达标</span>
                  <span className="text-[var(--wm-text-dim)]">{consolidateMet} / {consolidateTotal}</span>
                </div>
                <div className="h-[6px] w-full rounded-full bg-white/[.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#60a5fa] to-[#a78bfa] transition-[width] duration-400"
                    style={{ width: `${consolidateTotal === 0 ? 0 : Math.round((consolidateMet / consolidateTotal) * 100)}%` }}
                  />
                </div>
              </div>
            )}


            {/* 7-day grid */}
            <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto px-7 py-2 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0 sm:py-0">
              {plan.days.map((day, i) => {
                const isDone = plan.progress[day.date]?.quizDone === true
                const isToday = day.date === today
                const isPast = day.date < today && !isDone
                const introducedUpTo = new Set<string>()
                for (let j = 0; j <= i; j++) plan.days[j].newWordKeys.forEach(k => introducedUpTo.add(k))
                let consolidateCount = 0
                let previewCount = 0
                for (const k of introducedUpTo) {
                  const kind = planClassification.get(k)
                  if (kind === 'preview') previewCount += 1
                  else consolidateCount += 1
                }
                const isSelected = selectedDate === day.date

                let borderColor = 'rgba(255,255,255,.07)'
                let textColor = 'rgba(255,255,255,.35)'
                let bgColor = 'rgba(255,255,255,.03)'
                if (isDone) {
                  borderColor = '#4ade80'
                  textColor = '#4ade80'
                  bgColor = 'rgba(74,222,128,.08)'
                } else if (isToday) {
                  borderColor = '#f59e0b'
                  textColor = '#fbbf24'
                  bgColor = 'rgba(245,158,11,.1)'
                } else if (isPast) {
                  borderColor = 'rgba(248,113,113,.3)'
                  textColor = 'rgba(248,113,113,.6)'
                }
                let boxShadow: string | undefined
                if (isSelected) {
                  if (isDone) {
                    bgColor = 'rgba(74,222,128,.25)'
                    borderColor = '#4ade80'
                    textColor = '#6ee7a0'
                    boxShadow = '0 0 0 2px rgba(74,222,128,.4), 0 4px 16px rgba(74,222,128,.3)'
                  } else if (isToday) {
                    bgColor = 'rgba(245,158,11,.25)'
                    borderColor = '#f59e0b'
                    textColor = '#fcd34d'
                    boxShadow = '0 0 0 2px rgba(245,158,11,.5), 0 4px 16px rgba(245,158,11,.3)'
                  } else if (isPast) {
                    bgColor = 'rgba(248,113,113,.18)'
                    borderColor = 'rgba(248,113,113,.8)'
                    textColor = 'rgba(248,113,113,1)'
                    boxShadow = '0 0 0 2px rgba(248,113,113,.35), 0 4px 16px rgba(248,113,113,.2)'
                  } else {
                    bgColor = 'rgba(255,255,255,.14)'
                    borderColor = 'rgba(255,255,255,.7)'
                    textColor = 'rgba(255,255,255,.9)'
                    boxShadow = '0 0 0 2px rgba(255,255,255,.25), 0 4px 16px rgba(255,255,255,.1)'
                  }
                }

                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDate(isSelected ? null : day.date)}
                    className="flex min-w-[3.6rem] shrink-0 cursor-pointer flex-col items-center gap-1 rounded-[12px] border-[1.5px] px-2 py-3 transition-all select-none sm:min-w-0 sm:px-1"
                    style={{
                      borderColor,
                      background: bgColor,
                      color: textColor,
                      boxShadow,
                      transform: isSelected ? 'translateY(-2px) scale(1.05)' : undefined,
                    }}
                  >
                    <div className="text-[.6rem] font-extrabold opacity-70">{cnDays[i]}</div>
                    <div className="font-fredoka text-[1.05rem] leading-none">
                      {fmtDate(day.date)}
                    </div>
                    <div className="text-center text-[.58rem] leading-tight font-bold opacity-60">
                      {isDone ? '✓ 完成' : isToday ? '今天' : `必记 ${consolidateCount} · 预习 ${previewCount}`}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          {showSundayBanner && (
            <div className="mt-4 rounded-[14px] border border-[rgba(248,113,113,.5)] bg-[rgba(248,113,113,.1)] px-4 py-3 text-[.82rem] font-extrabold text-[#f87171]">
              ⚠️ 今日兜底：还有 {consolidateTotal - consolidateMet} 个必记词未达标，今天务必攻克。
            </div>
          )}

          {/* Selected day detail */}
          {selectedDate &&
            (() => {
              const dayIndex = plan.days.findIndex((d) => d.date === selectedDate)
              const dayPlan = plan.days[dayIndex]
              if (!dayPlan) return null
              const isDone = plan.progress[selectedDate]?.quizDone === true
              const session = getDailySessionWords(plan, vocab, masteryMap, dayIndex)
              const consolidateList = session.filter(s => s.kind === 'consolidate')
              const previewList = session.filter(s => s.kind === 'preview')
              const metCount = consolidateList.filter(s => s.met).length
              const total = session.length
              const consolidateDoneToday = plan.progress[selectedDate]?.consolidateDone === true
              const previewDoneToday = plan.progress[selectedDate]?.previewDone === true
              const consolidateScore = plan.progress[selectedDate]?.consolidateScore
              const previewScore = plan.progress[selectedDate]?.previewScore
              const hasBothKinds = consolidateList.length > 0 && previewList.length > 0
              // Type D 题型的可用性按当日必记词列表来判（之前用 session 级 words，
              // 冷启动时为空导致 D 永远隐藏）
              const dayHasTypeDEligible = consolidateList.some((s) => isEligibleForTypeD(s.entry))
              return (
                <div className="border-t border-[var(--wm-border)] pt-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-[.72rem] font-extrabold text-[var(--wm-text-dim)]">
                      {fmtDate(selectedDate)} {cnDays[dayIndex]}
                    </span>
                    <span className="rounded-full border border-[rgba(96,165,250,.3)] bg-[rgba(96,165,250,.15)] px-2 py-0.5 text-[.65rem] font-bold text-[#93c5fd]">
                      必记 {consolidateList.length}（已达标 {metCount}）
                    </span>
                    {previewList.length > 0 && (
                      <span className="rounded-full border border-[rgba(249,115,22,.3)] bg-[rgba(249,115,22,.15)] px-2 py-0.5 text-[.65rem] font-bold text-[#fb923c]">
                        预习 {previewList.length}
                      </span>
                    )}
                    <span className="text-[.68rem] text-[var(--wm-text-dim)]">共 {total} 词</span>
                    {isDone && plan.progress[selectedDate]?.lastScore !== undefined && (
                      <span className="ml-auto text-[.72rem] font-bold text-[#4ade80]">
                        上次 {plan.progress[selectedDate].lastScore}%
                      </span>
                    )}
                  </div>

                  {consolidateList.length > 0 && (
                    <div className="mb-3">
                      <div className="mb-1.5 text-[.6rem] font-extrabold tracking-widest text-[#93c5fd] uppercase">
                        必记（{consolidateList.length} 个，已达标 {metCount}）
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {consolidateList.map((s) => {
                          const level = getWordMasteryLevel(masteryMap[wordKey(s.entry)]?.correct ?? 0)
                          return (
                            <span
                              key={wordKey(s.entry)}
                              className={`inline-flex flex-col items-center rounded-2xl border-[1.5px] px-2.5 py-1 ${
                                s.met
                                  ? 'border-[rgba(74,222,128,.4)] bg-[rgba(74,222,128,.1)] text-[#86efac]'
                                  : 'border-[rgba(96,165,250,.35)] bg-[rgba(96,165,250,.08)] text-[#93c5fd]'
                              }`}
                            >
                              <span className="inline-flex items-center text-[0.875rem] font-bold leading-tight">
                                {level > 0 && (
                                  <span className="mr-1 text-[.65rem]">{MASTERY_ICON[level]}</span>
                                )}
                                {s.entry.word}
                              </span>
                              <span className="text-[.5rem] font-extrabold leading-none tracking-tight opacity-55">
                                {lessonChipTag(s.entry.unit, s.entry.lesson)}
                              </span>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {previewList.length > 0 && (
                    <div className="mb-3">
                      <div className="mb-1.5 text-[.6rem] font-extrabold tracking-widest text-[#fb923c] uppercase">
                        预习（{previewList.length} 个）
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {previewList.map((s) => {
                          const level = getWordMasteryLevel(masteryMap[wordKey(s.entry)]?.correct ?? 0)
                          return (
                            <span
                              key={wordKey(s.entry)}
                              className="inline-flex flex-col items-center rounded-2xl border-[1.5px] border-[rgba(249,115,22,.4)] bg-[rgba(249,115,22,.08)] px-2.5 py-1 text-[#fb923c]"
                            >
                              <span className="inline-flex items-center text-[0.875rem] font-bold leading-tight">
                                {level > 0 && (
                                  <span className="mr-1 text-[.65rem]">{MASTERY_ICON[level]}</span>
                                )}
                                {s.entry.word}
                              </span>
                              <span className="text-[.5rem] font-extrabold leading-none tracking-tight opacity-55">
                                {lessonChipTag(s.entry.unit, s.entry.lesson)}
                              </span>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {total === 0 && (
                    <div className="mb-4 text-[1.125rem] text-[var(--wm-text-dim)]">
                      暂无单词
                    </div>
                  )}

                  <div className="mb-2.5 text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
                    题型选择
                  </div>

                  {/* Two-row type selector */}
                  <div className="mb-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-[5.5rem] text-[.72rem] font-bold text-[#93c5fd]">必记词题型</span>
                      {((dayHasTypeDEligible ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C']) as ('A' | 'B' | 'C' | 'D')[]).map((t) => {
                        const labels = { A: '释义 → 选单词', B: '单词 → 选释义', C: '释义 → 默写', D: '📖 课文填空' }
                        const on = consolidateTypes.has(t)
                        return (
                          <button
                            key={`c-${t}`}
                            onClick={() =>
                              setConsolidateTypes((prev) => {
                                const n = new Set(prev)
                                if (n.has(t)) n.delete(t); else n.add(t)
                                return n
                              })
                            }
                            className={`flex cursor-pointer items-center gap-2 rounded-[10px] border-[1.5px] px-3 py-2 text-[.82rem] font-bold transition-all select-none ${
                              on
                                ? t === 'D'
                                  ? 'border-[rgba(245,158,11,.55)] bg-[rgba(245,158,11,.12)] text-[#fbbf24]'
                                  : 'border-[rgba(167,139,250,.5)] bg-[rgba(167,139,250,.1)] text-[#c4b5fd]'
                                : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)]'
                            }`}
                          >
                            <span
                              className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded-[5px] text-[.6rem] font-black ${
                                t === 'A'
                                  ? 'bg-[rgba(96,165,250,.15)] text-[#60a5fa]'
                                  : t === 'B'
                                    ? 'bg-[rgba(167,139,250,.15)] text-[#a78bfa]'
                                    : t === 'C'
                                      ? 'bg-[rgba(74,222,128,.12)] text-[#4ade80]'
                                      : 'bg-[rgba(245,158,11,.18)] text-[#fbbf24]'
                              }`}
                            >
                              {t}
                            </span>
                            {labels[t]}
                          </button>
                        )
                      })}
                    </div>
                    {previewList.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="min-w-[5.5rem] text-[.72rem] font-bold text-[#fb923c]">预习词题型</span>
                        {(['A', 'B', 'C'] as const).map((t) => {
                          // Preview lessons never use Type D — only consolidate/focus lesson uses passage context.
                          const labels = { A: '释义 → 选单词', B: '单词 → 选释义', C: '释义 → 默写' }
                          const on = previewTypes.has(t)
                          return (
                            <button
                              key={`p-${t}`}
                              onClick={() =>
                                setPreviewTypes((prev) => {
                                  const n = new Set(prev)
                                  if (n.has(t)) n.delete(t); else n.add(t)
                                  return n
                                })
                              }
                              className={`flex cursor-pointer items-center gap-2 rounded-[10px] border-[1.5px] px-3 py-2 text-[.82rem] font-bold transition-all select-none ${
                                on
                                  ? 'border-[rgba(167,139,250,.5)] bg-[rgba(167,139,250,.1)] text-[#c4b5fd]'
                                  : 'border-[var(--wm-border)] bg-transparent text-[var(--wm-text-dim)]'
                              }`}
                            >
                              <span
                                className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded-[5px] text-[.6rem] font-black ${
                                  t === 'A'
                                    ? 'bg-[rgba(96,165,250,.15)] text-[#60a5fa]'
                                    : t === 'B'
                                      ? 'bg-[rgba(167,139,250,.15)] text-[#a78bfa]'
                                      : 'bg-[rgba(74,222,128,.12)] text-[#4ade80]'
                                }`}
                              >
                                {t}
                              </span>
                              {labels[t]}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="min-w-[5.5rem] text-[.72rem] font-bold text-[#e879f9]"
                        title="默写题字母池按钮样式（candy = 水果造型，jelly = 果冻砖）"
                      >
                        字母砖样式
                      </span>
                      <button
                        onClick={() => setPracticeButtonStyle('candy')}
                        title="SVG 水果造型（草莓 / 蓝莓 / 爱心 / 糖果 / 棉花糖）"
                        className={`flex cursor-pointer items-center gap-2 rounded-[10px] border-[1.5px] px-3 py-2 text-[.82rem] font-bold transition-all select-none ${
                          practiceButtonStyle === 'candy'
                            ? 'border-[rgba(236,72,153,.55)] bg-[rgba(236,72,153,.12)] text-[#f9a8d4]'
                            : 'border-[var(--wm-border)] bg-transparent text-[var(--wm-text-dim)]'
                        }`}
                      >
                        🍓 糖果造型
                      </button>
                      <button
                        onClick={() => setPracticeButtonStyle('jelly')}
                        title="圆角果冻砖（5 色彩虹）"
                        className={`flex cursor-pointer items-center gap-2 rounded-[10px] border-[1.5px] px-3 py-2 text-[.82rem] font-bold transition-all select-none ${
                          practiceButtonStyle === 'jelly'
                            ? 'border-[rgba(167,139,250,.55)] bg-[rgba(167,139,250,.12)] text-[#c4b5fd]'
                            : 'border-[var(--wm-border)] bg-transparent text-[var(--wm-text-dim)]'
                        }`}
                      >
                        💎 果冻砖
                      </button>
                    </div>
                  </div>

                  {/* 练习按钮区：全部练习 + 可选分开练习（同一行） */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={() => startStudy(selectedDate)}
                      className="font-nunito cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#d97706] to-[#f59e0b] px-6 py-2.5 text-[.88rem] font-extrabold text-white shadow-[0_3px_12px_rgba(245,158,11,.35)] transition-all hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(245,158,11,.5)]"
                    >
                      {isDone ? '🔄 重新练习' : '🚀 开始练习'}
                    </button>

                    {hasBothKinds && (
                      <>
                        <span className="select-none text-[.7rem] font-bold text-[var(--wm-text-dim)] opacity-30">|</span>
                        <button
                          onClick={() => startStudy(selectedDate, 'consolidate')}
                          className={`font-nunito cursor-pointer rounded-full border-[1.5px] px-3 py-1 text-[.75rem] font-extrabold transition-all hover:-translate-y-px ${
                            consolidateDoneToday
                              ? 'border-[rgba(96,165,250,.6)] bg-[rgba(96,165,250,.15)] text-[#60a5fa]'
                              : 'border-[rgba(96,165,250,.35)] bg-[rgba(96,165,250,.07)] text-[#93c5fd] hover:border-[#60a5fa]'
                          }`}
                        >
                          {consolidateDoneToday
                            ? `✓ 必记${consolidateScore !== undefined ? ' ' + consolidateScore + '%' : ''}`
                            : `📘 必记 (${consolidateList.length})`}
                        </button>
                        <button
                          onClick={() => startStudy(selectedDate, 'preview')}
                          className={`font-nunito cursor-pointer rounded-full border-[1.5px] px-3 py-1 text-[.75rem] font-extrabold transition-all hover:-translate-y-px ${
                            previewDoneToday
                              ? 'border-[rgba(249,115,22,.6)] bg-[rgba(249,115,22,.15)] text-[#f97316]'
                              : 'border-[rgba(249,115,22,.35)] bg-[rgba(249,115,22,.07)] text-[#fb923c] hover:border-[#f97316]'
                          }`}
                        >
                          {previewDoneToday
                            ? `✓ 预习${previewScore !== undefined ? ' ' + previewScore + '%' : ''}`
                            : `🔖 预习 (${previewList.length})`}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })()}

          {!selectedDate &&
            (() => {
              const today2 = todayStr()
              const todayInPlan = plan.days.find((d) => d.date === today2)
              if (!todayInPlan) return null
              return (
                <button
                  onClick={() => startStudy(today2)}
                  className="flex cursor-pointer items-center gap-1 rounded-full border border-[rgba(245,158,11,.3)] bg-[rgba(245,158,11,.12)] px-2.5 py-1 text-[.65rem] font-extrabold text-[#fbbf24] transition-all hover:bg-[rgba(245,158,11,.2)]"
                >
                  ⚡ 开始今天的练习
                </button>
              )
            })()}
        </div>
        <MasteryStatusPanel
          vocab={vocab}
          masteryMap={masteryMap}
          orderedWordsInScope={planOrderedVocab}
          panelTitle="本周词汇学习状态"
        />
      </>
    )
  }

  // ── STUDY ────────────────────────────────────────────────────────────────
  if (phase === 'study' && words[studyIdx]) {
    const w = words[studyIdx]
    const total = words.length
    return (
      <StudyPhase
        entry={w.entry}
        currentIdx={studyIdx}
        totalCount={total}
        title="📖 记忆单词"
        studyDefOnly={studyDefOnly}
        onStudyDefOnlyChange={setStudyDefOnly}
        isImmersive={isImmersive}
        onExitImmersive={exitImmersive}
        progressGradientClasses="from-[#d97706] via-[#f59e0b] to-[#fbbf24]"
        nextButtonGradientClasses="from-[#d97706] to-[#f59e0b]"
        nextButtonShadowClass="shadow-[0_3px_12px_rgba(217,119,6,.4)]"
        wordBadge={
          <span
            className={`rounded-full border px-2 py-0.5 text-[.6rem] font-extrabold tracking-wider uppercase ${
              w.kind === 'consolidate'
                ? 'border-[rgba(96,165,250,.3)] bg-[rgba(96,165,250,.2)] text-[#93c5fd]'
                : 'border-[rgba(249,115,22,.3)] bg-[rgba(249,115,22,.2)] text-[#fb923c]'
            }`}
          >
            {w.kind === 'consolidate' ? '必记' : '预习'}
          </span>
        }
        onBack={() => setPhase('week-view')}
        onStash={() => void stashSession()}
        isStashing={isStashing}
        onPrev={() => setStudyIdx(studyIdx - 1)}
        onNext={() => setStudyIdx(studyIdx + 1)}
        onComplete={startQuiz}
        completeButtonText="✅ 开始测试 →"
      />
    )
  }

  // ── QUIZ ─────────────────────────────────────────────────────────────────
  if (phase === 'quiz' && currentQuestion) {
    // Stars available this run: A/B = 1, C/D = 2 per question
    const possibleStars = quizQs.reduce((sum, qq) => sum + (qq.type === 'C' || qq.type === 'D' ? 2 : 1), 0)
    return (
      <div className="mx-auto max-w-[1280px] px-4 py-5">
        <div className="mb-2 flex items-center gap-3 py-3">
          <button
            onClick={() => {
              setQuizQKeys([])
              setCurQ(0)
              setScore(0)
              quizResultBuffer.current = []
              setStudyIdx(0)
              setPhase('study')
            }}
            className="font-nunito shrink-0 cursor-pointer rounded-full border-[1.5px] border-[var(--wm-border)] bg-transparent px-3.5 py-1.5 text-[0.875rem] font-bold text-[var(--wm-text-dim)] transition-all hover:border-[var(--wm-accent4)] hover:text-[var(--wm-accent4)]"
          >
            ← 回到记忆
          </button>
          <button
            type="button"
            onClick={() => void stashSession()}
            disabled={isStashing}
            className="font-nunito shrink-0 cursor-pointer rounded-full border-[1.5px] border-[rgba(245,158,11,.45)] bg-[rgba(245,158,11,.12)] px-3.5 py-1.5 text-[0.875rem] font-bold text-[#fbbf24] transition-all hover:bg-[rgba(245,158,11,.2)] disabled:cursor-wait disabled:opacity-60"
          >
            {isStashing ? '暂存中…' : '💾 暂存'}
          </button>
          <div className="font-fredoka text-[1.1rem] text-[var(--wm-text)]">✏️ 单词测试</div>
          {inReinforcement && (
            <span className="font-fredoka inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 px-2.5 py-1 text-[10px] font-black tracking-wide text-white shadow-[0_2px_0_rgba(0,0,0,.15)]">
              🌱 巩固阶段
            </span>
          )}
          <div className="ml-auto hidden text-[11px] font-bold text-[var(--wm-text-dim)] sm:block">
            题型 {currentQuestion.type} · {currentQuestion.type === 'C' || currentQuestion.type === 'D' ? '+2⭐/题' : '+1⭐/题'}
          </div>
        </div>

        {/* Live red star progress for this quiz */}
        <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5">
          <StarProgressBar color="red" target={Math.max(1, possibleStars)} label="本次练习红月亮" compact />
          <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] font-bold text-rose-700/70">
            <span>本次已得 {starSession.red} 红🌙</span>
            <span>总目标 {possibleStars} 红🌙</span>
          </div>
        </div>

        {/*<RescueListBadge items={[...rescue.retryList, ...rescue.eatenList]} />*/}

        {rescueReview ? (
          <RescueReviewCarousel
            words={rescueReview}
            onStartPractice={() => {
              // Mark every reviewed word as seen (flashcard_done) before practice starts.
              rescueReview.forEach((w) => rescue.advance(wordKey(w), 'correct'))
              setRescueReview(null)
            }}
          />
        ) : (
          <QuizQuestionBody
            question={currentQuestion}
            options={quizOptions}
            score={score}
            total={quizQs.length}
            runner={runner}
            questionKey={curQ}
            helpRevealed={helpRevealedForCurrent}
            onHelpReveal={handleHelpReveal}
            spellButtonStyle={practiceButtonStyle}
            eatenSceneActive={eatenScene !== null}
          />
        )}

        <MonsterEatScene
          entry={eatenScene?.entry ?? null}
          monsterIdx={eatenScene?.monsterIdx ?? 0}
          isAbbreviated={eatenScene?.isAbbreviated ?? false}
          onDismiss={() => { setEatenScene(null); nextQ() }}
        />
      </div>
    )
  }

  // ── DONE ─────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const isSubTask = currentSubTask !== 'all'
    const otherSubTask: 'consolidate' | 'preview' =
      currentSubTask === 'consolidate' ? 'preview' : 'consolidate'
    const dayIndex2 = selectedDate
      ? plan.days.findIndex((d) => d.date === selectedDate)
      : -1
    const sessionForDone =
      isSubTask && dayIndex2 >= 0
        ? getDailySessionWords(plan, vocab, masteryMap, dayIndex2)
        : []
    const hasOtherWords = sessionForDone.some((s) => s.kind === otherSubTask)
    const otherAlreadyDone =
      otherSubTask === 'consolidate'
        ? plan.progress[selectedDate ?? '']?.consolidateDone === true
        : plan.progress[selectedDate ?? '']?.previewDone === true

    const total = quizQs.length
    const pct = total ? Math.round((score / total) * 100) : 0
    const masteredCount = words.filter(
      (w) =>
        getWordMasteryLevel(
          masteryMap[`${w.entry.unit}::${w.entry.lesson}::${w.entry.word}`]?.correct ?? 0,
        ) === 3,
    ).length

    return (
      <>
        <DoneSummary
          score={score}
          total={total}
          scoreGradientClasses="from-[#d97706] to-[#f59e0b]"
          starsEarned={lastStarsEarned}
          detailLine={
            <>
              正确率 {pct}% · {words.length} 个{currentSubTask === 'consolidate' ? '必记' : currentSubTask === 'preview' ? '预习' : ''}词
              {selectedDate &&
                ` · ${fmtDate(selectedDate)} ${cnDays[plan.days.findIndex((d) => d.date === selectedDate)]}`}
            </>
          }
          masteredCount={masteredCount}
          wordsCount={words.length}
          actions={
            <>
              <button
                onClick={() => startQuiz()}
                className="font-nunito cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#d97706] to-[#f59e0b] px-6 py-2.5 text-[.88rem] font-extrabold text-white shadow-[0_3px_12px_rgba(245,158,11,.35)]"
              >
                🔄 重新测试
              </button>
              <button
                onClick={() => { rescue.clear(); setPhase('week-view') }}
                className="font-nunito cursor-pointer rounded-[10px] border-[1.5px] border-[var(--wm-border)] bg-transparent px-5 py-2.5 text-[1rem] font-bold text-[var(--wm-text-dim)]"
              >
                返回多日计划
              </button>
              {isSubTask && hasOtherWords && !otherAlreadyDone && selectedDate && (
                <button
                  onClick={() => startStudy(selectedDate, otherSubTask)}
                  className={`font-nunito cursor-pointer rounded-[10px] border-0 px-6 py-2.5 text-[.88rem] font-extrabold text-white transition-all hover:-translate-y-px ${
                    otherSubTask === 'consolidate'
                      ? 'bg-gradient-to-br from-[#1e40af] to-[#60a5fa] shadow-[0_3px_12px_rgba(96,165,250,.3)]'
                      : 'bg-gradient-to-br from-[#9a3412] to-[#fb923c] shadow-[0_3px_12px_rgba(249,115,22,.3)]'
                  }`}
                >
                  {otherSubTask === 'consolidate' ? '📘 继续必记练习 →' : '🔖 继续预习练习 →'}
                </button>
              )}
            </>
          }
        />
        <RescueCompletionView eatenList={rescue.eatenList} />
        <MasteryStatusPanel
          vocab={vocab}
          masteryMap={masteryMap}
          orderedWordsInScope={planOrderedVocab}
          panelTitle="本周词汇学习状态"
        />
      </>
    )
  }

  return null
}
