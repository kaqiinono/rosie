import { supabase, type QuizType } from '@rosie/core'
import type { SessionOutcome } from './adaptivePlanSettle'
import type { AdaptiveMasteryPatch } from './adaptivePlanSettle'
import { mapProgressModelToRow } from './adaptivePlanMappers'
import type { AdaptivePlanWordProgress } from './adaptivePlanTypes'

export type AdaptiveLogPhase = 'step1_review' | 'step3_final' | 'boss' | 'boss_sink' | 'unknown'

export type AdaptiveLoggedOutcome = SessionOutcome & {
  phase: AdaptiveLogPhase
  quizType: QuizType
}

export type SaveAdaptivePracticeLogArgs = {
  sessionId: string
  planId: string
  userId: string
  practiceDate: string
  mode: 'normal' | 'boss'
  startedAt: string
  finishedAt: string
  newWordCount: number
  reviewWordCount: number
  starsEarned: number
  bossPassed?: boolean
  outcomes: AdaptiveLoggedOutcome[]
  beforeRows: AdaptivePlanWordProgress[]
  afterRows: AdaptivePlanWordProgress[]
}

export type AdaptivePracticeWordLog = {
  wordKey: string
  outcomes: {
    phase: AdaptiveLogPhase
    quizType: QuizType | null
    correct: boolean
    usedRetry: boolean
    inferred?: boolean
  }[]
  questionCount: number
  correctCount: number
  boxBefore: number | null
  boxAfter: number | null
  statusBefore: AdaptivePlanWordProgress['status'] | null
  statusAfter: AdaptivePlanWordProgress['status'] | null
  nextReviewBefore: string | null
  nextReviewAfter: string | null
}

export type AdaptivePracticeSessionLog = {
  id: string
  practiceDate: string
  mode: 'normal' | 'boss'
  startedAt: string
  finishedAt: string
  newWordCount: number
  reviewWordCount: number
  questionCount: number
  correctCount: number
  starsEarned: number
  bossPassed: boolean | null
  recordKind: 'exact' | 'inferred'
  inferenceBasis: string[]
  words: AdaptivePracticeWordLog[]
}

export type AdaptiveDailyProgress = {
  planId: string
  practiceDate: string
  newGoal: number
  reviewGoal: number
  newDone: number
  reviewDone: number
  allDone: boolean
  completedAt: string | null
}

export const ADAPTIVE_PROGRESS_CHANGED_EVENT = 'rosie:adaptive-progress-changed'

function masteryRows(userId: string, patches: AdaptiveMasteryPatch[]) {
  return patches.map(({ wordKey, info }) => ({
    user_id: userId,
    word_key: wordKey,
    correct: info.correct,
    incorrect: info.incorrect,
    last_seen: info.lastSeen || new Date().toISOString().slice(0, 10),
    stage: info.stage ?? null,
    next_review_date: info.nextReviewDate || null,
    is_hard: info.isHard ?? false,
    review_history: info.reviewHistory ?? [],
  }))
}

function buildPracticeWordRows(args: SaveAdaptivePracticeLogArgs) {
  const beforeByKey = new Map(args.beforeRows.map((row) => [row.wordKey, row]))
  const afterByKey = new Map(args.afterRows.map((row) => [row.wordKey, row]))
  const outcomesByKey = new Map<string, AdaptiveLoggedOutcome[]>()
  for (const outcome of args.outcomes) {
    const list = outcomesByKey.get(outcome.wordKey) ?? []
    list.push(outcome)
    outcomesByKey.set(outcome.wordKey, list)
  }

  return [...outcomesByKey].flatMap(([wordKey, outcomes]) => {
    const before = beforeByKey.get(wordKey)
    const after = afterByKey.get(wordKey)
    if (!before || !after) return []
    return [
      {
        word_key: wordKey,
        outcomes: outcomes.map(({ phase, quizType, correct, usedRetry, usedHelp }) => ({
          phase,
          quizType,
          correct,
          usedRetry: usedRetry === true,
          usedHelp: usedHelp === true,
        })),
        question_count: outcomes.length,
        correct_count: outcomes.filter((outcome) => outcome.correct).length,
        box_before: before.boxIndex,
        box_after: after.boxIndex,
        status_before: before.status,
        status_after: after.status,
        next_review_before: before.nextReviewDate,
        next_review_after: after.nextReviewDate,
      },
    ]
  })
}

export async function settleAdaptivePracticeRound(
  args: SaveAdaptivePracticeLogArgs & {
    progressUpdates: AdaptivePlanWordProgress[]
    masteryPatches: AdaptiveMasteryPatch[]
    newGoal: number
    reviewGoal: number
    allDone: boolean
  },
): Promise<AdaptiveDailyProgress> {
  const correctCount = args.outcomes.filter((outcome) => outcome.correct).length
  const { data, error } = await supabase.rpc('settle_adaptive_practice_round', {
    p_plan_id: args.planId,
    p_practice_date: args.practiceDate,
    p_session: {
      id: args.sessionId,
      mode: args.mode,
      started_at: args.startedAt,
      finished_at: args.finishedAt,
      new_word_count: args.newWordCount,
      review_word_count: args.reviewWordCount,
      question_count: args.outcomes.length,
      correct_count: correctCount,
      stars_earned: args.starsEarned,
      boss_passed: args.bossPassed ?? null,
    },
    p_progress_rows: args.progressUpdates.map(mapProgressModelToRow),
    p_mastery_rows: masteryRows(args.userId, args.masteryPatches),
    p_word_logs: buildPracticeWordRows(args),
    p_new_goal: args.newGoal,
    p_review_goal: args.reviewGoal,
    p_all_done: args.allDone,
  })
  if (error || !data) throw error ?? new Error('Failed to settle adaptive practice round')

  const row = data as Record<string, unknown>
  const daily: AdaptiveDailyProgress = {
    planId: String(row.plan_id),
    practiceDate: String(row.practice_date),
    newGoal: Number(row.new_goal),
    reviewGoal: Number(row.review_goal),
    newDone: Number(row.new_done),
    reviewDone: Number(row.review_done),
    allDone: row.all_done === true,
    completedAt: typeof row.completed_at === 'string' ? row.completed_at : null,
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ADAPTIVE_PROGRESS_CHANGED_EVENT, { detail: daily }))
  }
  return daily
}

export async function loadAdaptivePracticeLogs(
  userId: string,
  planId: string,
): Promise<AdaptivePracticeSessionLog[]> {
  const { data: sessions, error: sessionsError } = await supabase
    .from('adaptive_practice_sessions')
    .select(
      'id,practice_date,mode,started_at,finished_at,new_word_count,review_word_count,question_count,correct_count,stars_earned,boss_passed,record_kind,inference_basis',
    )
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .order('started_at', { ascending: true })
  if (sessionsError) throw sessionsError
  if (!sessions || sessions.length === 0) return []

  const sessionIds = sessions.map((session) => session.id as string)
  const { data: words, error: wordsError } = await supabase
    .from('adaptive_practice_word_logs')
    .select(
      'session_id,word_key,outcomes,question_count,correct_count,box_before,box_after,status_before,status_after,next_review_before,next_review_after',
    )
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .in('session_id', sessionIds)
    .order('id', { ascending: true })
  if (wordsError) throw wordsError

  const wordsBySession = new Map<string, AdaptivePracticeWordLog[]>()
  for (const row of words ?? []) {
    const item: AdaptivePracticeWordLog = {
      wordKey: row.word_key as string,
      outcomes: row.outcomes as AdaptivePracticeWordLog['outcomes'],
      questionCount: row.question_count as number,
      correctCount: row.correct_count as number,
      boxBefore: row.box_before as number | null,
      boxAfter: row.box_after as number | null,
      statusBefore: row.status_before as AdaptivePlanWordProgress['status'] | null,
      statusAfter: row.status_after as AdaptivePlanWordProgress['status'] | null,
      nextReviewBefore: row.next_review_before as string | null,
      nextReviewAfter: row.next_review_after as string | null,
    }
    const sessionId = row.session_id as string
    const list = wordsBySession.get(sessionId) ?? []
    list.push(item)
    wordsBySession.set(sessionId, list)
  }

  return sessions.map((row) => ({
    id: row.id as string,
    practiceDate: row.practice_date as string,
    mode: row.mode as 'normal' | 'boss',
    startedAt: row.started_at as string,
    finishedAt: row.finished_at as string,
    newWordCount: row.new_word_count as number,
    reviewWordCount: row.review_word_count as number,
    questionCount: row.question_count as number,
    correctCount: row.correct_count as number,
    starsEarned: row.stars_earned as number,
    bossPassed: row.boss_passed as boolean | null,
    recordKind: row.record_kind as 'exact' | 'inferred',
    inferenceBasis: row.inference_basis as string[],
    words: wordsBySession.get(row.id as string) ?? [],
  }))
}

export async function saveAdaptivePracticeLog(args: SaveAdaptivePracticeLogArgs): Promise<void> {
  const correctCount = args.outcomes.filter((outcome) => outcome.correct).length
  const { error: sessionError } = await supabase.from('adaptive_practice_sessions').upsert({
    id: args.sessionId,
    plan_id: args.planId,
    user_id: args.userId,
    practice_date: args.practiceDate,
    mode: args.mode,
    started_at: args.startedAt,
    finished_at: args.finishedAt,
    new_word_count: args.newWordCount,
    review_word_count: args.reviewWordCount,
    question_count: args.outcomes.length,
    correct_count: correctCount,
    stars_earned: args.starsEarned,
    boss_passed: args.bossPassed ?? null,
  })
  if (sessionError) throw sessionError

  const wordRows = buildPracticeWordRows(args).map((row) => ({
    session_id: args.sessionId,
    plan_id: args.planId,
    user_id: args.userId,
    ...row,
  }))

  if (wordRows.length === 0) return
  const { error: wordsError } = await supabase
    .from('adaptive_practice_word_logs')
    .upsert(wordRows, { onConflict: 'session_id,word_key' })
  if (wordsError) throw wordsError
}
