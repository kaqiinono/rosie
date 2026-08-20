'use client'

import { useCallback, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, getWeekStart, supabase, todayStr } from '@rosie/core'
import type { MathWeeklyPlan, MathDayProgress, MathDeferredBatch } from '@rosie/core'
import {
  addPlanDays,
  collectOverduePlanProblems,
  ensureMathPlanAssignmentIds,
  normalizeMathPlanProgress,
  isPlanProblemDone,
  planEndDate,
} from '@rosie/math-kit/utils/math-helpers'

const SYSTEM_DEFAULTS = { weekStartDay: 4, problemsPerDay: 3 }

type PlanMeta = Pick<
  MathWeeklyPlan,
  'planEnd' | 'originalPlanEnd' | 'deferredBatches' | 'name' | 'lessonIds' | 'sectionFilters' | 'tagFilters'
>

type ProgressPayload = Record<string, MathDayProgress | PlanMeta | undefined> & {
  __planMeta?: PlanMeta
}

function stripPlanMeta(raw: ProgressPayload): { progress: MathWeeklyPlan['progress']; meta?: PlanMeta } {
  const entries = Object.entries(raw ?? {}).filter(([k]) => k !== '__planMeta')
  const progress = Object.fromEntries(entries) as MathWeeklyPlan['progress']
  return { progress, meta: raw?.__planMeta }
}

function withPlanMeta(plan: MathWeeklyPlan): ProgressPayload {
  return {
    ...plan.progress,
    __planMeta: {
      planEnd: plan.planEnd,
      originalPlanEnd: plan.originalPlanEnd,
      deferredBatches: plan.deferredBatches,
      name: plan.name,
      lessonIds: plan.lessonIds,
      sectionFilters: plan.sectionFilters,
      tagFilters: plan.tagFilters,
    },
  }
}

async function loadAllPlansFromCloud(userId: string): Promise<MathWeeklyPlan[]> {
  try {
    const { data } = await supabase
      .from('math_weekly_plans')
      .select('lesson_id, week_start, week_start_day, problems_per_day, plan_data, progress_data')
      .eq('user_id', userId)
    if (!data) return []
    return data.map((row) => {
      const days = ensureMathPlanAssignmentIds(row.plan_data as MathWeeklyPlan['days'])
      const { progress: rawProgress, meta } = stripPlanMeta((row.progress_data as ProgressPayload) ?? {})
      const progress = normalizeMathPlanProgress(days, rawProgress)
      return {
        weekStart: row.week_start,
        planEnd: meta?.planEnd,
        originalPlanEnd: meta?.originalPlanEnd,
        deferredBatches: meta?.deferredBatches,
        name: meta?.name,
        lessonId: row.lesson_id,
        lessonIds: meta?.lessonIds,
        sectionFilters: meta?.sectionFilters,
        tagFilters: meta?.tagFilters,
        weekStartDay: row.week_start_day ?? SYSTEM_DEFAULTS.weekStartDay,
        problemsPerDay: row.problems_per_day ?? SYSTEM_DEFAULTS.problemsPerDay,
        days,
        progress,
      }
    })
  } catch {
    return []
  }
}

async function saveToCloud(userId: string, plan: MathWeeklyPlan): Promise<void> {
  try {
    await supabase
      .from('math_weekly_plans')
      .upsert(
        {
          user_id: userId,
          week_start: plan.weekStart,
          lesson_id: plan.lessonId,
          week_start_day: plan.weekStartDay,
          problems_per_day: plan.problemsPerDay,
          plan_data: plan.days,
          progress_data: withPlanMeta(plan),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,week_start' },
      )
  } catch {
    /* ignore */
  }
}

export const mathWeeklyPlansStore = createUserSessionStore<MathWeeklyPlan[]>('math_weekly_plans', {
  fetch: loadAllPlansFromCloud,
  empty: [],
})

export function useMathWeeklyPlan(user: User | null) {
  const { data: plansState, isLoading } = mathWeeklyPlansStore.useSessionData(user)

  const activePlans = useMemo(() => {
    const t = todayStr()
    return plansState
      .filter((plan) => plan.weekStart <= t && t <= planEndDate(plan))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  }, [plansState])
  const weeklyPlan = activePlans[0] ?? null

  const priorPlans = useMemo(
    () => plansState.filter((p) => p !== weeklyPlan),
    [plansState, weeklyPlan],
  )

  const defaultParams = useMemo((): { weekStartDay: number; problemsPerDay: number } => {
    if (plansState.length === 0) return SYSTEM_DEFAULTS
    const sorted = [...plansState].sort((a, b) => b.weekStart.localeCompare(a.weekStart))
    const recent = sorted[0]
    return {
      weekStartDay: recent.weekStartDay,
      problemsPerDay: recent.problemsPerDay,
    }
  }, [plansState])

  const currentWeekStart = useMemo(() => {
    return getWeekStart(undefined, defaultParams.weekStartDay)
  }, [defaultParams.weekStartDay])

  const savePlan = useCallback(
    async (plan: MathWeeklyPlan) => {
      if (!user) return
      const normalized = { ...plan, days: ensureMathPlanAssignmentIds(plan.days) }
      mathWeeklyPlansStore.patchSessionData(user.id, (prev) => {
        const idx = prev.findIndex((p) => p.weekStart === normalized.weekStart)
        if (idx >= 0) {
          const copy = [...prev]
          copy[idx] = normalized
          return copy
        }
        return [...prev, normalized]
      })
      await saveToCloud(user.id, normalized)
    },
    [user],
  )

  const addDoneKey = useCallback(
    async (planStart: string, date: string, assignmentId: string) => {
      if (!user) return
      let updatedPlan: MathWeeklyPlan | null = null
      mathWeeklyPlansStore.patchSessionData(user.id, (prev) => {
        const idx = prev.findIndex((plan) => plan.weekStart === planStart)
        if (idx < 0) return prev
        const plan = prev[idx]
        const existing = plan.progress[date] ?? { doneKeys: [] }
        if (existing.doneKeys.includes(assignmentId)) return prev
        const now = new Date().toISOString()
        const dayPlan = plan.days.find((d) => d.date === date)
        const newDoneKeys = [...existing.doneKeys, assignmentId]
        const allDone = dayPlan?.problems.every((p) =>
          isPlanProblemDone(p, date, newDoneKeys),
        ) ?? false
        updatedPlan = {
          ...plan,
          progress: {
            ...plan.progress,
            [date]: {
              doneKeys: newDoneKeys,
              completedAt: allDone ? (existing.completedAt ?? now) : existing.completedAt,
            },
          },
        }
        const copy = [...prev]
        copy[idx] = updatedPlan
        return copy
      })
      if (updatedPlan) void saveToCloud(user.id, updatedPlan)
    },
    [user],
  )

  const postponeAllOverdue = useCallback(async (): Promise<{
    problemCount: number
    batchCount: number
    newEndDates: Record<string, string>
  }> => {
    if (!user) return { problemCount: 0, batchCount: 0, newEndDates: {} }
    const today = todayStr()
    const updatedPlans: MathWeeklyPlan[] = []
    let problemCount = 0
    let batchCount = 0
    const newEndDates: Record<string, string> = {}

    mathWeeklyPlansStore.patchSessionData(user.id, (prev) => prev.map((rawPlan) => {
      const plan = { ...rawPlan, days: ensureMathPlanAssignmentIds(rawPlan.days) }
      const overdue = collectOverduePlanProblems(plan, today)
      if (overdue.length === 0) return plan

      const byDate = new Map<string, typeof overdue>()
      for (const item of overdue) {
        const list = byDate.get(item.date) ?? []
        list.push(item)
        byDate.set(item.date, list)
      }

      const currentEnd = planEndDate(plan)
      let targetDate = addPlanDays(currentEnd < today ? today : currentEnd, 1)
      const generationBase = (plan.deferredBatches ?? []).length + 1
      const newDays = [...plan.days]
      const newBatches: MathDeferredBatch[] = [...(plan.deferredBatches ?? [])]
      let batchIndex = 0

      for (const [sourceDate, items] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const targetProblems = items.map(({ problem, assignmentId }) => ({
          ...problem,
          assignmentId: `deferred::${plan.weekStart}::${targetDate}::${assignmentId}`,
          isDeferred: true,
          deferredFromDate: sourceDate,
          deferredFromPlanStart: plan.weekStart,
          deferredFromAssignmentId: assignmentId,
          deferGeneration: (problem.deferGeneration ?? 0) + 1,
        }))
        const batchId = `defer::${plan.weekStart}::${Date.now()}::${generationBase + batchIndex}`
        newDays.push({ date: targetDate, problems: targetProblems, optionalProblems: [] })
        newBatches.push({
          id: batchId,
          sourceDate,
          targetDate,
          sourceAssignmentIds: items.map((item) => item.assignmentId),
          targetAssignmentIds: targetProblems.map((problem) => problem.assignmentId!),
          deferredAt: new Date().toISOString(),
        })
        problemCount += items.length
        batchCount += 1
        batchIndex += 1
        targetDate = addPlanDays(targetDate, 1)
      }

      const nextEnd = addPlanDays(targetDate, -1)
      const updated: MathWeeklyPlan = {
        ...plan,
        originalPlanEnd: plan.originalPlanEnd ?? currentEnd,
        planEnd: nextEnd,
        deferredBatches: newBatches,
        days: newDays.sort((a, b) => a.date.localeCompare(b.date)),
      }
      newEndDates[plan.weekStart] = nextEnd
      updatedPlans.push(updated)
      return updated
    }))

    await Promise.all(updatedPlans.map((plan) => saveToCloud(user.id, plan)))
    return { problemCount, batchCount, newEndDates }
  }, [user])

  const updateDayProgress = useCallback(
    async (date: string, progress: MathDayProgress) => {
      if (!user) return
      let updatedPlan: MathWeeklyPlan | null = null
      mathWeeklyPlansStore.patchSessionData(user.id, (prev) => {
        const idx = prev.findIndex((plan) => plan.days.some((d) => d.date === date))
        if (idx < 0) return prev
        const plan = prev[idx]
        updatedPlan = {
          ...plan,
          progress: { ...plan.progress, [date]: progress },
        }
        const copy = [...prev]
        copy[idx] = updatedPlan
        return copy
      })
      if (updatedPlan) void saveToCloud(user.id, updatedPlan)
    },
    [user],
  )

  const deletePlan = useCallback(
    async (weekStart: string) => {
      if (!user) return
      try {
        await supabase
          .from('math_weekly_plans')
          .delete()
          .eq('user_id', user.id)
          .eq('week_start', weekStart)
      } catch {
        /* ignore */
      }
      mathWeeklyPlansStore.patchSessionData(user.id, (prev) =>
        prev.filter((p) => p.weekStart !== weekStart),
      )
    },
    [user],
  )

  const allPlans = useMemo(
    () => [...plansState].sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
    [plansState],
  )

  const allPriorKeys: string[] = useMemo(
    () =>
      priorPlans.flatMap((plan) =>
        plan.days.flatMap((day) =>
          [...day.problems, ...day.optionalProblems].map((p) => p.key),
        ),
      ),
    [priorPlans],
  )

  const priorProblemMap = useMemo(
    () =>
      Object.fromEntries(
        priorPlans.flatMap((plan) =>
          plan.days.flatMap((day) =>
            [...day.problems, ...day.optionalProblems].map((p) => [p.key, p]),
          ),
        ),
      ),
    [priorPlans],
  )

  return {
    weeklyPlan,
    activePlans,
    priorPlans,
    allPlans,
    allPriorKeys,
    priorProblemMap,
    currentWeekStart,
    defaultParams,
    savePlan,
    addDoneKey,
    postponeAllOverdue,
    updateDayProgress,
    deletePlan,
    isLoading,
  }
}
