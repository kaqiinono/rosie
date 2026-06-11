import { supabase } from '@/lib/supabase'
import type { CalculateQuestion, LevelId, Tier, QuestionResult } from './calculate-types'
import { detectErrorTag } from './calculate-mastery'

export async function saveSessionRecord(params: {
  userId: string
  date: string
  mode: 'daily' | 'level' | 'mistakes'
  levelId: LevelId | null
  tier: Tier | null
  results: QuestionResult[]
  timeSpentSec: number
  starsEarned: number
  maxStreak: number
  startedAt: string
}) {
  const correctCount = params.results.filter((r) => r.correct).length
  const wrongCount = params.results.length - correctCount

  const errorSummary: Record<string, number> = {}
  for (const r of params.results) {
    if (!r.correct) {
      const tag = r.errorTag ?? detectErrorTag(r.distractorType)
      if (tag) {
        errorSummary[tag] = (errorSummary[tag] ?? 0) + 1
      }
    }
  }

  await supabase.from('calculate_sessions').insert({
    user_id: params.userId,
    date: params.date,
    mode: params.mode,
    level_id: params.levelId,
    tier: params.tier,
    count: params.results.length,
    correct_count: correctCount,
    wrong_count: wrongCount,
    time_spent_sec: params.timeSpentSec,
    stars_earned: params.starsEarned,
    max_streak: params.maxStreak,
    error_summary: errorSummary,
    started_at: params.startedAt,
    finished_at: new Date().toISOString(),
  })
}

export async function saveMistakeRecords(
  userId: string,
  results: QuestionResult[],
  questions: CalculateQuestion[],
) {
  const rows = results
    .filter((r) => !r.correct)
    .map((r) => {
      const q = questions.find((q) => q.id === r.questionId)
      const errorTag = r.errorTag ?? detectErrorTag(r.distractorType)
      return {
        user_id: userId,
        question_signature: q?.display ?? r.questionId,
        level_id: r.levelId,
        user_answer: r.userAnswer,
        correct_answer: q?.answer ?? '',
        error_tag: errorTag,
        distractor_type: r.distractorType,
        consecutive_correct: 0,
        resolved: false,
      }
    })

  if (rows.length > 0) {
    await supabase.from('calculate_mistakes').insert(rows)
  }
}

/**
 * 错题专项练习模式：根据本次答对的题目，更新对应关卡的错题 consecutive_correct。
 * 连续答对 3 次后自动标记 resolved。
 */
export async function updateMistakeProgress(
  userId: string,
  correctLevelIds: LevelId[],
) {
  if (correctLevelIds.length === 0) return

  const { data } = await supabase
    .from('calculate_mistakes')
    .select('id, level_id, consecutive_correct')
    .eq('user_id', userId)
    .eq('resolved', false)
    .in('level_id', correctLevelIds)

  if (!data) return

  for (const row of data as { id: string; level_id: string; consecutive_correct: number }[]) {
    const next = row.consecutive_correct + 1
    await supabase
      .from('calculate_mistakes')
      .update({
        consecutive_correct: next,
        resolved: next >= 3,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
  }
}

export async function fetchTodayStats(
  userId: string,
  today: string,
): Promise<{ totalQuestions: number; totalStars: number }> {
  const { data } = await supabase
    .from('calculate_sessions')
    .select('count, stars_earned')
    .eq('user_id', userId)
    .eq('date', today)

  if (!data || data.length === 0) return { totalQuestions: 0, totalStars: 0 }

  return {
    totalQuestions: data.reduce((s, r) => s + (r.count as number), 0),
    totalStars: data.reduce((s, r) => s + (r.stars_earned as number), 0),
  }
}
