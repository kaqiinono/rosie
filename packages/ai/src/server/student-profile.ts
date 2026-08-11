import type { SupabaseClient } from '@supabase/supabase-js'
import type { AiSubject } from '../types'

export interface StudentSubjectProfile {
  activePlan: StudentActivePlan | null
  plan: {
    weekStart: string
    focus: string
    todayAssigned: number
    todayCompleted: boolean
  } | null
  mastery: {
    tracked: number
    due: number
    hard: number
    hardKeys: string[]
  }
  unresolved: {
    count: number
    keys: string[]
  }
}

export type StudentActivePlan =
  | {
      kind: 'english_adaptive'
      title: string
      mode: string
      newWordsPerDay: number
      total: number
      pending: number
      learning: number
      mastered: number
      dueToday: number
    }
  | {
      kind: 'chinese_roadmap'
      title: string
      currentLessonKey: string
      lessonsPerBatch: number
      completedLessons: number
      latestAccuracy: number | null
    }
  | {
      kind: 'math_multi_day'
      title: string
      startDate: string
      endDate: string
      lessonIds: string[]
      todayAssigned: number
      todayCompleted: boolean
      overdue: number
    }

export interface StudentProfile {
  generatedAt: string
  today: string
  subjects: Record<AiSubject, StudentSubjectProfile>
  calc: {
    unresolvedCount: number
    recentSignatures: string[]
  }
}

interface PlanRow {
  week_start?: string
  unit?: string
  lesson?: string
  lesson_id?: string
  lesson_key?: string
  plan_data?: unknown
  progress_data?: unknown
  days?: unknown
  progress?: unknown
}

interface PlanDay {
  date?: unknown
  newWordKeys?: unknown
  problems?: unknown
  newRecognizeKeys?: unknown
  newWriteKeys?: unknown
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function planDays(row: PlanRow, subject: AiSubject): PlanDay[] {
  if (subject === 'chinese') return Array.isArray(row.days) ? (row.days as PlanDay[]) : []
  if (subject === 'math' && Array.isArray(row.plan_data)) return row.plan_data as PlanDay[]
  const plan = asRecord(row.plan_data)
  return Array.isArray(plan.days) ? (plan.days as PlanDay[]) : []
}

function summarizeMathMultiDayPlan(rows: PlanRow[], today: string): StudentActivePlan | null {
  for (const row of rows) {
    if (!row.week_start) continue
    const days = planDays(row, 'math')
    const progress = asRecord(row.progress_data)
    const meta = asRecord(progress.__planMeta)
    const lastDay = days.at(-1)?.date
    const endDate =
      typeof meta.planEnd === 'string'
        ? meta.planEnd
        : typeof lastDay === 'string'
          ? lastDay
          : row.week_start
    if (row.week_start > today || endDate < today) continue

    const todayPlan = days.find((day) => day.date === today)
    const assigned = arrayLength(todayPlan?.problems)
    const todayProgress = asRecord(progress[today])
    const doneToday = new Set(
      Array.isArray(todayProgress.doneKeys) ? todayProgress.doneKeys.map(String) : [],
    )
    let overdue = 0
    for (const day of days) {
      if (typeof day.date !== 'string' || day.date >= today || !Array.isArray(day.problems)) {
        continue
      }
      const dayProgress = asRecord(progress[day.date])
      const doneKeys = new Set(
        Array.isArray(dayProgress.doneKeys) ? dayProgress.doneKeys.map(String) : [],
      )
      overdue += day.problems.filter((problem) => {
        const key = asRecord(problem).key
        return typeof key === 'string' && !doneKeys.has(key)
      }).length
    }
    const lessonIds = Array.isArray(meta.lessonIds)
      ? meta.lessonIds.map(String)
      : row.lesson_id
        ? [row.lesson_id]
        : []

    return {
      kind: 'math_multi_day',
      title: typeof meta.name === 'string' && meta.name ? meta.name : '数学多日计划',
      startDate: row.week_start,
      endDate,
      lessonIds,
      todayAssigned: assigned,
      todayCompleted:
        assigned > 0 &&
        Array.isArray(todayPlan?.problems) &&
        todayPlan.problems.every((problem) => {
          const key = asRecord(problem).key
          return typeof key === 'string' && doneToday.has(key)
        }),
      overdue,
    }
  }
  return null
}

function summarizePlan(row: PlanRow | null, subject: AiSubject, today: string) {
  if (!row?.week_start) return null
  const day = planDays(row, subject).find((candidate) => candidate.date === today)
  const assigned =
    subject === 'english'
      ? arrayLength(day?.newWordKeys)
      : subject === 'math'
        ? arrayLength(day?.problems)
        : arrayLength(day?.newRecognizeKeys) + arrayLength(day?.newWriteKeys)
  const progress = asRecord(subject === 'chinese' ? row.progress : row.progress_data)
  const todayProgress = asRecord(progress[today])
  const completed =
    todayProgress.quizDone === true ||
    (assigned > 0 && arrayLength(todayProgress.doneKeys) >= assigned) ||
    typeof todayProgress.completedAt === 'string'
  const focus =
    subject === 'english'
      ? [row.unit, row.lesson].filter(Boolean).join(' / ')
      : subject === 'math'
        ? (row.lesson_id ?? '')
        : (row.lesson_key ?? '')
  return {
    weekStart: row.week_start,
    focus,
    todayAssigned: assigned,
    todayCompleted: completed,
  }
}

function countOf(result: { count: number | null }): number {
  return result.count ?? 0
}

function rowsOf<T>(result: { data: T[] | null }): T[] {
  return result.data ?? []
}

async function loadEnglishAdaptivePlan(
  supabase: SupabaseClient,
  userId: string,
  today: string,
): Promise<StudentActivePlan | null> {
  const plan = await supabase
    .from('adaptive_word_plans')
    .select('id,title,mode,new_words_per_day')
    .eq('user_id', userId)
    .eq('status', 'active')
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (plan.error) throw plan.error
  if (!plan.data) return null
  const planId = plan.data.id

  const base = () =>
    supabase
      .from('adaptive_plan_word_progress')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .is('archived_at', null)
  const [total, pending, learning, mastered, due] = await Promise.all([
    base(),
    base().eq('status', 'LEARNING_PENDING'),
    base().eq('status', 'LEARNING'),
    base().eq('status', 'MASTERED'),
    base().eq('status', 'LEARNING').lte('next_review_date', today),
  ])
  const failed = [total, pending, learning, mastered, due].find((result) => result.error)
  if (failed?.error) throw failed.error

  return {
    kind: 'english_adaptive',
    title: String(plan.data.title),
    mode: String(plan.data.mode),
    newWordsPerDay: Number(plan.data.new_words_per_day),
    total: countOf(total),
    pending: countOf(pending),
    learning: countOf(learning),
    mastered: countOf(mastered),
    dueToday: countOf(due),
  }
}

async function loadChineseRoadmapPlan(
  supabase: SupabaseClient,
  userId: string,
): Promise<StudentActivePlan | null> {
  const plan = await supabase
    .from('chinese_roadmap_plans')
    .select('id,title,current_lesson_key,lessons_per_batch,completed_lesson_keys')
    .eq('user_id', userId)
    .eq('status', 'active')
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (plan.error) throw plan.error
  if (!plan.data) return null

  const latestRun = await supabase
    .from('chinese_roadmap_plan_lesson_runs')
    .select('accuracy')
    .eq('user_id', userId)
    .eq('plan_id', plan.data.id)
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latestRun.error) throw latestRun.error

  return {
    kind: 'chinese_roadmap',
    title: String(plan.data.title),
    currentLessonKey: String(plan.data.current_lesson_key),
    lessonsPerBatch: Number(plan.data.lessons_per_batch),
    completedLessons: arrayLength(plan.data.completed_lesson_keys),
    latestAccuracy: latestRun.data?.accuracy == null ? null : Number(latestRun.data.accuracy),
  }
}

export function todayInShanghai(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export async function loadStudentProfile(
  supabase: SupabaseClient,
  userId: string,
  today = todayInShanghai(),
): Promise<StudentProfile> {
  const [
    englishAdaptivePlan,
    chineseRoadmapPlan,
    englishPlan,
    mathPlans,
    chinesePlan,
    wordTracked,
    wordDue,
    wordHard,
    wordHardRows,
    englishWrong,
    englishWrongRows,
    problemTracked,
    problemDue,
    problemHard,
    problemHardRows,
    mathWrong,
    mathWrongRows,
    charTracked,
    charDue,
    charHard,
    charHardRows,
    chineseWrong,
    chineseWrongRows,
    calcWrong,
    calcWrongRows,
  ] = await Promise.all([
    loadEnglishAdaptivePlan(supabase, userId, today),
    loadChineseRoadmapPlan(supabase, userId),
    supabase
      .from('weekly_plans')
      .select('week_start,unit,lesson,plan_data,progress_data')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('math_weekly_plans')
      .select('week_start,lesson_id,plan_data,progress_data')
      .eq('user_id', userId)
      .lte('week_start', today)
      .order('week_start', { ascending: false }),
    supabase
      .from('chinese_weekly_plans')
      .select('week_start,lesson_key,days,progress')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('word_mastery')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('word_mastery')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lte('next_review_date', today),
    supabase
      .from('word_mastery')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_hard', true),
    supabase
      .from('word_mastery')
      .select('word_key')
      .eq('user_id', userId)
      .eq('is_hard', true)
      .order('updated_at', { ascending: false })
      .limit(8),
    supabase
      .from('english_wrong')
      .select('word_key', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('resolved', false),
    supabase
      .from('english_wrong')
      .select('word_key')
      .eq('user_id', userId)
      .eq('resolved', false)
      .order('added_at', { ascending: false })
      .limit(8),
    supabase
      .from('problem_mastery')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('problem_mastery')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lte('next_review_date', today),
    supabase
      .from('problem_mastery')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_hard', true),
    supabase
      .from('problem_mastery')
      .select('problem_key')
      .eq('user_id', userId)
      .eq('is_hard', true)
      .order('updated_at', { ascending: false })
      .limit(8),
    supabase
      .from('math_wrong')
      .select('problem_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('resolved', false),
    supabase
      .from('math_wrong')
      .select('problem_id')
      .eq('user_id', userId)
      .eq('resolved', false)
      .order('added_at', { ascending: false })
      .limit(8),
    supabase
      .from('chinese_char_mastery')
      .select('char_key', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('chinese_char_mastery')
      .select('char_key', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lte('next_review_date', today),
    supabase
      .from('chinese_char_mastery')
      .select('char_key', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_hard', true),
    supabase
      .from('chinese_char_mastery')
      .select('char_key')
      .eq('user_id', userId)
      .eq('is_hard', true)
      .order('updated_at', { ascending: false })
      .limit(8),
    supabase
      .from('chinese_wrong_items')
      .select('item_key', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('resolved', false),
    supabase
      .from('chinese_wrong_items')
      .select('item_key,wrong_kind')
      .eq('user_id', userId)
      .eq('resolved', false)
      .order('added_at', { ascending: false })
      .limit(8),
    supabase
      .from('calc_mistakes')
      .select('signature', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('resolved', false),
    supabase
      .from('calc_mistakes')
      .select('signature')
      .eq('user_id', userId)
      .eq('resolved', false)
      .order('last_wrong_at', { ascending: false })
      .limit(8),
  ])

  const failed = [
    englishPlan,
    mathPlans,
    chinesePlan,
    wordTracked,
    wordDue,
    wordHard,
    wordHardRows,
    englishWrong,
    englishWrongRows,
    problemTracked,
    problemDue,
    problemHard,
    problemHardRows,
    mathWrong,
    mathWrongRows,
    charTracked,
    charDue,
    charHard,
    charHardRows,
    chineseWrong,
    chineseWrongRows,
    calcWrong,
    calcWrongRows,
  ].find((result) => result.error)
  if (failed?.error) throw failed.error

  const mathActivePlan = summarizeMathMultiDayPlan(rowsOf(mathPlans) as PlanRow[], today)
  const profile: StudentProfile = {
    generatedAt: new Date().toISOString(),
    today,
    subjects: {
      english: {
        activePlan: englishAdaptivePlan,
        plan: summarizePlan((englishPlan.data as PlanRow | null) ?? null, 'english', today),
        mastery: {
          tracked: countOf(wordTracked),
          due: countOf(wordDue),
          hard: countOf(wordHard),
          hardKeys: rowsOf(wordHardRows).map((row) => String(row.word_key)),
        },
        unresolved: {
          count: countOf(englishWrong),
          keys: rowsOf(englishWrongRows).map((row) => String(row.word_key)),
        },
      },
      math: {
        activePlan: mathActivePlan,
        plan: null,
        mastery: {
          tracked: countOf(problemTracked),
          due: countOf(problemDue),
          hard: countOf(problemHard),
          hardKeys: rowsOf(problemHardRows).map((row) => String(row.problem_key)),
        },
        unresolved: {
          count: countOf(mathWrong),
          keys: rowsOf(mathWrongRows).map((row) => String(row.problem_id)),
        },
      },
      chinese: {
        activePlan: chineseRoadmapPlan,
        plan: summarizePlan((chinesePlan.data as PlanRow | null) ?? null, 'chinese', today),
        mastery: {
          tracked: countOf(charTracked),
          due: countOf(charDue),
          hard: countOf(charHard),
          hardKeys: rowsOf(charHardRows).map((row) => String(row.char_key)),
        },
        unresolved: {
          count: countOf(chineseWrong),
          keys: rowsOf(chineseWrongRows).map((row) => `${row.item_key}:${row.wrong_kind}`),
        },
      },
    },
    calc: {
      unresolvedCount: countOf(calcWrong),
      recentSignatures: rowsOf(calcWrongRows).map((row) => String(row.signature)),
    },
  }

  return profile
}

export function buildStudentProfilePrompt(profile: StudentProfile, subject?: AiSubject): string {
  const subjects = subject ? [subject] : (['english', 'math', 'chinese'] as AiSubject[])
  const lines = subjects.map((key) => {
    const value = profile.subjects[key]
    const activePlan = value.activePlan
    const plan =
      activePlan?.kind === 'english_adaptive'
        ? `自适应计划“${activePlan.title}”（${activePlan.mode}），共${activePlan.total}词，学习中${activePlan.learning}，待激活${activePlan.pending}，已掌握${activePlan.mastered}，今日到期${activePlan.dueToday}`
        : activePlan?.kind === 'chinese_roadmap'
          ? `路线图计划“${activePlan.title}”，当前${activePlan.currentLessonKey}，每批${activePlan.lessonsPerBatch}课，已完成${activePlan.completedLessons}课${activePlan.latestAccuracy == null ? '' : `，最近正确率${activePlan.latestAccuracy}%`}`
          : activePlan?.kind === 'math_multi_day'
            ? `多日计划“${activePlan.title}”（${activePlan.startDate}至${activePlan.endDate}），覆盖课次${activePlan.lessonIds.join('、') || '未标注'}，今日${activePlan.todayAssigned}题、${activePlan.todayCompleted ? '已完成' : '未完成'}，逾期未完成${activePlan.overdue}题`
            : value.plan
              ? `今日任务${value.plan.todayAssigned}项，${value.plan.todayCompleted ? '已完成' : '未完成'}，重点${value.plan.focus || '未标注'}`
              : '暂无学习计划'
    return `${key}: ${plan}；掌握记录${value.mastery.tracked}，到期复习${value.mastery.due}，困难项${value.mastery.hard}；未解决错题${value.unresolved.count}`
  })
  if (!subject || subject === 'math') {
    lines.push(`calc: 未解决口算错题${profile.calc.unresolvedCount}`)
  }
  return lines.join('\n')
}
