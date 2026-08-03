'use client'

import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase } from '@rosie/core'
import type { ChineseBookSlug } from '../utils/chinese-books'
import {
  mapPlanModelToRow,
  mapPlanRowToModel,
  mapRunModelToRow,
  mapRunRowToModel,
} from '../utils/chineseRoadmapPlanMappers'
import { resolveChinesePlanCreateStatus } from '../utils/chineseRoadmapPlanLogic'
import type {
  ChinesePlanQuizType,
  ChineseRoadmapPlan,
  ChineseRoadmapPlanLessonRun,
  ChineseRoadmapPlanLessonRunRow,
  ChineseRoadmapPlanRow,
} from '../utils/chineseRoadmapPlanTypes'

export type CreateChineseRoadmapPlanInput = {
  title: string
  bookSlug: ChineseBookSlug
  startLessonKey: string
  lessonsPerBatch?: number
  quizTypes: ChinesePlanQuizType[]
  /** if true and another active exists, pause it then create as active */
  activateNow?: boolean
}

export type AdvanceAfterSessionInput = {
  completedLessonKeysInBatch: string[]
  nextCurrentLessonKey: string
  bookFinished: boolean
}

type CreateChineseRoadmapPlanResult = {
  ok: true
  planId: string
  status: 'active' | 'paused'
}

const PLAN_SELECT =
  'id, user_id, title, book_slug, start_lesson_key, current_lesson_key, lessons_per_batch, quiz_types, status, completed_lesson_keys, created_at, updated_at, archived_at'

const RUN_SELECT =
  'id, plan_id, user_id, lesson_key, started_at, finished_at, completed, total, correct, accuracy, by_type, quiz_types'

const RUN_FETCH_PAGE_SIZE = 1000

function createUuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16)
    const nibble = char === 'x' ? value : (value & 0x3) | 0x8
    return nibble.toString(16)
  })
}

function clampLessonsPerBatch(value: number | undefined): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 1
  return Math.min(10, Math.max(1, n))
}

function mergeCompletedKeys(existing: string[], added: string[]): string[] {
  const out = [...existing]
  const seen = new Set(existing)
  for (const key of added) {
    if (seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

async function loadAllPlansFromCloud(userId: string): Promise<ChineseRoadmapPlan[]> {
  // Must throw on failure: swallowing it here makes an unreachable network /
  // missing column look like "this plan doesn't exist" to every consumer.
  const { data, error } = await supabase
    .from('chinese_roadmap_plans')
    .select(PLAN_SELECT)
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[chinese_roadmap_plan] load plans failed', error)
    throw error
  }
  return ((data ?? []) as ChineseRoadmapPlanRow[]).map(mapPlanRowToModel)
}

async function loadPlanFromCloud(
  userId: string,
  planId: string,
): Promise<ChineseRoadmapPlan | null> {
  const { data, error } = await supabase
    .from('chinese_roadmap_plans')
    .select(PLAN_SELECT)
    .eq('user_id', userId)
    .eq('id', planId)
    .maybeSingle()

  if (error) {
    console.error('[chinese_roadmap_plan] load plan failed', error)
    throw error
  }
  if (!data) return null
  return mapPlanRowToModel(data as ChineseRoadmapPlanRow)
}

async function insertPlanToCloud(plan: ChineseRoadmapPlan): Promise<ChineseRoadmapPlan> {
  const { data, error } = await supabase
    .from('chinese_roadmap_plans')
    .insert(mapPlanModelToRow(plan))
    .select(PLAN_SELECT)
    .single()

  if (error || !data) throw error ?? new Error('Failed to create chinese roadmap plan')
  return mapPlanRowToModel(data as ChineseRoadmapPlanRow)
}

async function upsertPlanToCloud(plan: ChineseRoadmapPlan): Promise<ChineseRoadmapPlan> {
  const { data, error } = await supabase
    .from('chinese_roadmap_plans')
    .upsert(mapPlanModelToRow(plan), { onConflict: 'id' })
    .select(PLAN_SELECT)
    .single()

  if (error || !data) throw error ?? new Error('Failed to save chinese roadmap plan')
  return mapPlanRowToModel(data as ChineseRoadmapPlanRow)
}

/** Update mutable fields only — never touches book_slug. */
async function updatePlanFieldsToCloud(
  userId: string,
  plan: ChineseRoadmapPlan,
): Promise<ChineseRoadmapPlan> {
  const { data, error } = await supabase
    .from('chinese_roadmap_plans')
    .update({
      title: plan.title,
      start_lesson_key: plan.startLessonKey,
      current_lesson_key: plan.currentLessonKey,
      lessons_per_batch: plan.lessonsPerBatch,
      quiz_types: plan.quizTypes,
      status: plan.status,
      completed_lesson_keys: plan.completedLessonKeys,
      updated_at: plan.updatedAt,
      archived_at: plan.archivedAt,
    })
    .eq('id', plan.id)
    .eq('user_id', userId)
    .select(PLAN_SELECT)
    .single()

  if (error || !data) throw error ?? new Error('Failed to update chinese roadmap plan')
  return mapPlanRowToModel(data as ChineseRoadmapPlanRow)
}

async function loadRunsForPlanFromCloud(
  userId: string,
  planId: string,
): Promise<ChineseRoadmapPlanLessonRun[]> {
  const all: ChineseRoadmapPlanLessonRun[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('chinese_roadmap_plan_lesson_runs')
      .select(RUN_SELECT)
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .order('finished_at', { ascending: false })
      .range(from, from + RUN_FETCH_PAGE_SIZE - 1)

    if (error) {
      console.error('[chinese_roadmap_plan] loadRuns failed', error)
      throw error
    }
    if (!data || data.length === 0) break

    all.push(...(data as ChineseRoadmapPlanLessonRunRow[]).map(mapRunRowToModel))
    if (data.length < RUN_FETCH_PAGE_SIZE) break
    from += RUN_FETCH_PAGE_SIZE
  }

  return all
}

async function insertRunsToCloud(runs: ChineseRoadmapPlanLessonRun[]): Promise<ChineseRoadmapPlanLessonRun[]> {
  if (runs.length === 0) return []

  const { data, error } = await supabase
    .from('chinese_roadmap_plan_lesson_runs')
    .insert(runs.map(mapRunModelToRow))
    .select(RUN_SELECT)

  if (error || !data) throw error ?? new Error('Failed to insert chinese roadmap plan runs')
  return (data as ChineseRoadmapPlanLessonRunRow[]).map(mapRunRowToModel)
}

export const chineseRoadmapPlansStore = createUserSessionStore<ChineseRoadmapPlan[]>(
  'chinese_roadmap_plans',
  {
    fetch: loadAllPlansFromCloud,
    empty: [],
  },
)

/** Lazy keyed cache: empty until `loadRunsForPlan` / `appendLessonRuns` patches entries. */
export const chineseRoadmapPlanRunsStore = createUserSessionStore<
  Record<string, ChineseRoadmapPlanLessonRun[]>
>('chinese_roadmap_plan_runs', {
  fetch: async () => ({}),
  empty: {},
})

export function useChineseRoadmapPlan(user: User | null) {
  const { data: plans, isLoading } = chineseRoadmapPlansStore.useSessionData(user)
  const { data: runsByPlanId } = chineseRoadmapPlanRunsStore.useSessionData(user)

  const activePlan = plans.find((item) => item.status === 'active') ?? null
  /** Most recently updated completed plan (plans are ordered by updated_at desc). */
  const completedPlan = plans.find((item) => item.status === 'completed') ?? null

  const pauseActivePlansInDb = useCallback(
    async (exceptPlanId?: string): Promise<void> => {
      if (!user) return
      const now = new Date().toISOString()

      // Pause ALL DB actives for this user (not only in-memory `plans`), so a
      // stale/missing session cache cannot leave a second active row.
      let query = supabase
        .from('chinese_roadmap_plans')
        .update({ status: 'paused', updated_at: now })
        .eq('user_id', user.id)
        .eq('status', 'active')
        .is('archived_at', null)

      if (exceptPlanId) {
        query = query.neq('id', exceptPlanId)
      }

      const { error } = await query
      if (error) {
        console.error('[chinese_roadmap_plan] pause actives failed', error)
        throw error
      }

      chineseRoadmapPlansStore.patchSessionData(user.id, (prev) =>
        prev.map((item) =>
          item.status === 'active' && item.id !== exceptPlanId
            ? { ...item, status: 'paused' as const, updatedAt: now }
            : item,
        ),
      )
    },
    [user],
  )

  const createPlan = useCallback(
    async (input: CreateChineseRoadmapPlanInput): Promise<CreateChineseRoadmapPlanResult> => {
      if (!user) throw new Error('Cannot create chinese roadmap plan without a user')

      const activateNow = input.activateNow === true

      // activateNow: pause every DB active first (unique partial index), even if
      // the session cache is missing a row.
      if (activateNow) {
        await pauseActivePlansInDb()
      }

      const hasActive = plans.some((item) => item.status === 'active')
      const initialStatus = activateNow
        ? 'active'
        : resolveChinesePlanCreateStatus(hasActive)

      const now = new Date().toISOString()
      const plan: ChineseRoadmapPlan = {
        id: createUuid(),
        userId: user.id,
        title: input.title,
        bookSlug: input.bookSlug,
        startLessonKey: input.startLessonKey,
        currentLessonKey: input.startLessonKey,
        lessonsPerBatch: clampLessonsPerBatch(input.lessonsPerBatch),
        quizTypes: input.quizTypes,
        status: initialStatus,
        completedLessonKeys: [],
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      }

      const savedPlan = await insertPlanToCloud(plan)
      chineseRoadmapPlansStore.patchSessionData(user.id, (prev) => [savedPlan, ...prev])

      return {
        ok: true,
        planId: savedPlan.id,
        status: savedPlan.status === 'paused' ? 'paused' : 'active',
      }
    },
    [pauseActivePlansInDb, plans, user],
  )

  const savePlan = useCallback(
    async (plan: ChineseRoadmapPlan): Promise<void> => {
      if (!user) return

      const existing =
        plans.find((item) => item.id === plan.id) ?? (await loadPlanFromCloud(user.id, plan.id))
      if (!existing) return

      // book_slug is immutable after create — preserve existing and omit from UPDATE.
      const savedPlan = await updatePlanFieldsToCloud(user.id, {
        ...plan,
        userId: user.id,
        bookSlug: existing.bookSlug,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      })

      chineseRoadmapPlansStore.patchSessionData(user.id, (prev) =>
        prev.map((item) => (item.id === savedPlan.id ? savedPlan : item)),
      )
    },
    [plans, user],
  )

  const pausePlan = useCallback(
    async (planId: string): Promise<void> => {
      if (!user) return
      const plan =
        plans.find((item) => item.id === planId) ?? (await loadPlanFromCloud(user.id, planId))
      if (!plan || plan.status !== 'active') return

      const savedPlan = await upsertPlanToCloud({
        ...plan,
        userId: user.id,
        status: 'paused',
        updatedAt: new Date().toISOString(),
      })

      chineseRoadmapPlansStore.patchSessionData(user.id, (prev) =>
        prev.map((item) => (item.id === savedPlan.id ? savedPlan : item)),
      )
    },
    [plans, user],
  )

  const activatePlan = useCallback(
    async (planId: string): Promise<void> => {
      if (!user) return
      const target =
        plans.find((item) => item.id === planId) ?? (await loadPlanFromCloud(user.id, planId))
      if (!target || target.status === 'archived' || target.status === 'completed') return
      if (target.status === 'active') return

      // Unique index: pause other actives in DB before activating target.
      await pauseActivePlansInDb(planId)

      const savedPlan = await upsertPlanToCloud({
        ...target,
        userId: user.id,
        status: 'active',
        updatedAt: new Date().toISOString(),
      })

      chineseRoadmapPlansStore.patchSessionData(user.id, (prev) =>
        prev.map((item) => (item.id === savedPlan.id ? savedPlan : item)),
      )
    },
    [pauseActivePlansInDb, plans, user],
  )

  const archivePlan = useCallback(
    async (planId: string): Promise<void> => {
      if (!user) return

      const plan =
        plans.find((item) => item.id === planId) ?? (await loadPlanFromCloud(user.id, planId))
      if (!plan) return

      const archivedAt = new Date().toISOString()
      await upsertPlanToCloud({
        ...plan,
        userId: user.id,
        status: 'archived',
        archivedAt,
        updatedAt: archivedAt,
      })

      chineseRoadmapPlansStore.patchSessionData(user.id, (prev) =>
        prev.filter((item) => item.id !== planId),
      )
      chineseRoadmapPlanRunsStore.patchSessionData(user.id, (prev) => {
        if (!(planId in prev)) return prev
        const next = { ...prev }
        delete next[planId]
        return next
      })
    },
    [plans, user],
  )

  const loadRunsForPlan = useCallback(
    async (planId: string): Promise<ChineseRoadmapPlanLessonRun[]> => {
      if (!user) return []
      const runs = await loadRunsForPlanFromCloud(user.id, planId)
      chineseRoadmapPlanRunsStore.patchSessionData(user.id, (prev) => ({
        ...prev,
        [planId]: runs,
      }))
      return runs
    },
    [user],
  )

  const appendLessonRuns = useCallback(
    async (
      planId: string,
      runs: Array<
        Omit<ChineseRoadmapPlanLessonRun, 'id' | 'planId' | 'userId'> & {
          id?: string
        }
      >,
    ): Promise<ChineseRoadmapPlanLessonRun[]> => {
      if (!user || runs.length === 0) return []

      const payload: ChineseRoadmapPlanLessonRun[] = runs.map((run) => ({
        id: run.id ?? createUuid(),
        planId,
        userId: user.id,
        lessonKey: run.lessonKey,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        completed: run.completed,
        total: run.total,
        correct: run.correct,
        accuracy: run.accuracy,
        byType: run.byType,
        quizTypes: run.quizTypes,
      }))

      const inserted = await insertRunsToCloud(payload)
      chineseRoadmapPlanRunsStore.patchSessionData(user.id, (prev) => {
        const existing = prev[planId] ?? []
        return {
          ...prev,
          [planId]: [...inserted, ...existing],
        }
      })
      return inserted
    },
    [user],
  )

  const advanceAfterSession = useCallback(
    async (planId: string, input: AdvanceAfterSessionInput): Promise<void> => {
      if (!user) return

      const plan =
        plans.find((item) => item.id === planId) ?? (await loadPlanFromCloud(user.id, planId))
      if (!plan) return
      if (plan.status === 'archived' || plan.status === 'completed') return

      const now = new Date().toISOString()
      const next: ChineseRoadmapPlan = {
        ...plan,
        userId: user.id,
        completedLessonKeys: mergeCompletedKeys(
          plan.completedLessonKeys,
          input.completedLessonKeysInBatch,
        ),
        currentLessonKey: input.nextCurrentLessonKey,
        status: input.bookFinished ? 'completed' : plan.status,
        updatedAt: now,
      }

      const savedPlan = await updatePlanFieldsToCloud(user.id, next)
      chineseRoadmapPlansStore.patchSessionData(user.id, (prev) =>
        prev.map((item) => (item.id === savedPlan.id ? savedPlan : item)),
      )
    },
    [plans, user],
  )

  return {
    plans,
    activePlan,
    completedPlan,
    isLoading,
    createPlan,
    savePlan,
    pausePlan,
    activatePlan,
    archivePlan,
    appendLessonRuns,
    advanceAfterSession,
    loadRunsForPlan,
    runsByPlanId,
  }
}
