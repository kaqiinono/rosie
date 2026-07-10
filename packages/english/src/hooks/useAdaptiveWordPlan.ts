'use client'

import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase, type WordMasteryMap } from '@rosie/core'
import { allWordsMastered, mapWordToPlanInit } from '../utils/adaptivePlanInit'
import {
  ADAPTIVE_PLAN_DEFAULTS,
  clampBacklogFuse,
  clampBossEveryNNew,
  clampBossPackLimit,
  clampBossStubbornThreshold,
  clampNewWordsPerDay,
  clampReviewCap,
  defaultReviewCap,
} from '../utils/adaptivePlanDefaults'
import {
  mapPlanModelToRow,
  mapPlanRowToModel,
  mapProgressModelToRow,
  mapProgressRowToModel,
  type AdaptivePlanProgressRow,
  type AdaptiveWordPlanRow,
} from '../utils/adaptivePlanMappers'
import { isPlanCompletable } from '../utils/adaptivePlanScheduler'
import type {
  AdaptivePlanScope,
  AdaptivePlanWordProgress,
  AdaptiveWordPlan,
} from '../utils/adaptivePlanTypes'

type CreatePlanInput = {
  title: string
  scope: AdaptivePlanScope
  wordKeys: string[]
  masteryMap: WordMasteryMap
  forceChallenge?: boolean
  /** Daily new-word intake; clamped 1–20, default 10 */
  newWordsPerDay?: number
  /** Quantitative Boss trigger; 0 disables. Default 50 */
  bossEveryNNew?: number
  /** Qualitative Boss trigger (stubborn LEARNING count). Default 15 */
  bossStubbornThreshold?: number
  /** Max LEARNING words in a Boss-day pack. Default 50 */
  bossPackLimit?: number
  reviewCap?: number
  backlogFuse?: number
}

type CreatePlanResult = { ok: true; planId: string } | { ok: false; reason: 'all_mastered' }

const PLAN_SELECT =
  'id, user_id, title, scope, new_words_per_day, review_cap, review_batch_size, backlog_fuse, boss_every_n_new, boss_stubborn_threshold, boss_pack_limit, mode, status, stats, created_at, updated_at, archived_at'

const PROGRESS_SELECT =
  'id, plan_id, user_id, word_key, status, box_index, target_box, streak_wrong, next_review_date, introduced_on, archived_at'

const PROGRESS_INSERT_CHUNK_SIZE = 200
const PROGRESS_FETCH_PAGE_SIZE = 1000

const PLAN_DEFAULTS = ADAPTIVE_PLAN_DEFAULTS

function createUuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16)
    const nibble = char === 'x' ? value : (value & 0x3) | 0x8
    return nibble.toString(16)
  })
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size))
  }
  return chunks
}

async function loadAllPlansFromCloud(userId: string): Promise<AdaptiveWordPlan[]> {
  try {
    const { data, error } = await supabase
      .from('adaptive_word_plans')
      .select(PLAN_SELECT)
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('updated_at', { ascending: false })

    if (error || !data) return []
    return (data as AdaptiveWordPlanRow[]).map(mapPlanRowToModel)
  } catch {
    return []
  }
}

async function loadPlanFromCloud(
  userId: string,
  planId: string,
): Promise<AdaptiveWordPlan | null> {
  const { data, error } = await supabase
    .from('adaptive_word_plans')
    .select(PLAN_SELECT)
    .eq('user_id', userId)
    .eq('id', planId)
    .single()

  if (error || !data) return null
  return mapPlanRowToModel(data as AdaptiveWordPlanRow)
}

async function upsertPlanToCloud(plan: AdaptiveWordPlan): Promise<AdaptiveWordPlan> {
  const { data, error } = await supabase
    .from('adaptive_word_plans')
    .upsert(mapPlanModelToRow(plan), { onConflict: 'id' })
    .select(PLAN_SELECT)
    .single()

  if (error || !data) throw error ?? new Error('Failed to save adaptive word plan')
  return mapPlanRowToModel(data as AdaptiveWordPlanRow)
}

async function insertPlanToCloud(plan: AdaptiveWordPlan): Promise<AdaptiveWordPlan> {
  const { data, error } = await supabase
    .from('adaptive_word_plans')
    .insert(mapPlanModelToRow(plan))
    .select(PLAN_SELECT)
    .single()

  if (error || !data) throw error ?? new Error('Failed to create adaptive word plan')
  return mapPlanRowToModel(data as AdaptiveWordPlanRow)
}

async function insertProgressRowsToCloud(rows: AdaptivePlanWordProgress[]): Promise<void> {
  for (const chunk of chunkRows(rows, PROGRESS_INSERT_CHUNK_SIZE)) {
    const { error } = await supabase
      .from('adaptive_plan_word_progress')
      .insert(chunk.map(mapProgressModelToRow))

    if (error) throw error
  }
}

async function saveProgressRowsToCloud(rows: AdaptivePlanWordProgress[]): Promise<void> {
  for (const chunk of chunkRows(rows, PROGRESS_INSERT_CHUNK_SIZE)) {
    const { error } = await supabase
      .from('adaptive_plan_word_progress')
      .upsert(chunk.map(mapProgressModelToRow), { onConflict: 'plan_id,word_key' })

    if (error) throw error
  }
}

async function loadProgressRowsFromCloud(
  userId: string,
  planId: string,
): Promise<AdaptivePlanWordProgress[]> {
  const all: AdaptivePlanWordProgress[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('adaptive_plan_word_progress')
      .select(PROGRESS_SELECT)
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .order('word_key', { ascending: true })
      .range(from, from + PROGRESS_FETCH_PAGE_SIZE - 1)

    if (error) {
      console.error('[adaptive_word_plan] loadProgress failed', error)
      throw error
    }
    if (!data || data.length === 0) break

    all.push(...(data as AdaptivePlanProgressRow[]).map(mapProgressRowToModel))
    if (data.length < PROGRESS_FETCH_PAGE_SIZE) break
    from += PROGRESS_FETCH_PAGE_SIZE
  }

  return all
}

async function loadProgressRowsForPlansFromCloud(
  userId: string,
  planIds: string[],
): Promise<AdaptivePlanWordProgress[]> {
  const all: AdaptivePlanWordProgress[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('adaptive_plan_word_progress')
      .select(PROGRESS_SELECT)
      .eq('user_id', userId)
      .in('plan_id', planIds)
      .order('word_key', { ascending: true })
      .range(from, from + PROGRESS_FETCH_PAGE_SIZE - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    all.push(...(data as AdaptivePlanProgressRow[]).map(mapProgressRowToModel))
    if (data.length < PROGRESS_FETCH_PAGE_SIZE) break
    from += PROGRESS_FETCH_PAGE_SIZE
  }

  return all
}

export const adaptiveWordPlansStore = createUserSessionStore<AdaptiveWordPlan[]>(
  'adaptive_word_plans',
  {
    fetch: loadAllPlansFromCloud,
    empty: [],
  },
)

async function completePlanIfEligibleStandalone(userId: string, planId: string): Promise<void> {
  const progressRows = await loadProgressRowsFromCloud(userId, planId)
  if (!isPlanCompletable(progressRows, false)) return

  const plan = await loadPlanFromCloud(userId, planId)
  if (!plan || plan.status !== 'active') return

  const updatedAt = new Date().toISOString()
  const savedPlan = await upsertPlanToCloud({ ...plan, userId, status: 'completed', updatedAt })
  await saveProgressRowsToCloud(
    progressRows.map((row) => ({ ...row, userId, archivedAt: row.archivedAt ?? updatedAt })),
  )
  adaptiveWordPlansStore.patchSessionData(userId, (prev) =>
    prev.map((item) => (item.id === savedPlan.id ? savedPlan : item)),
  )
}

/**
 * Write-side consistency for word-library deletions: archive matching progress
 * rows across ALL of the user's plans (a row's existence already proves the
 * word was in the plan's scope — no scope parsing needed), then complete plans
 * that just became finishable. Never throws: word CRUD must not fail on plan
 * cleanup; the manage page's orphan detection is the safety net.
 */
export async function archiveAdaptiveProgressForDeletedKeys(
  userId: string,
  wordKeys: string[],
): Promise<void> {
  if (wordKeys.length === 0) return
  try {
    const affectedPlanIds = new Set<string>()
    for (const chunk of chunkRows(wordKeys, PROGRESS_INSERT_CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from('adaptive_plan_word_progress')
        .update({ archived_at: new Date().toISOString() })
        .eq('user_id', userId)
        .in('word_key', chunk)
        .is('archived_at', null)
        .select('plan_id')
      if (error) throw error
      for (const row of (data ?? []) as { plan_id: string }[]) {
        affectedPlanIds.add(row.plan_id)
      }
    }
    for (const planId of affectedPlanIds) {
      await completePlanIfEligibleStandalone(userId, planId)
    }
  } catch (err) {
    console.error('[adaptive_word_plan] cleanup after word deletion failed', err)
  }
}

/**
 * Write-side consistency for word renames (unit/lesson/word change): carry
 * plan progress over to the new key so fixing a typo doesn't reset learning.
 * Falls back to archiving the old key if a plan already tracks the new key
 * (unique plan_id+word_key). Never throws.
 */
export async function migrateAdaptiveProgressKey(
  userId: string,
  oldKey: string,
  newKey: string,
): Promise<void> {
  if (oldKey === newKey) return
  try {
    const { error } = await supabase
      .from('adaptive_plan_word_progress')
      .update({ word_key: newKey })
      .eq('user_id', userId)
      .eq('word_key', oldKey)
    if (error) {
      await archiveAdaptiveProgressForDeletedKeys(userId, [oldKey])
    }
  } catch (err) {
    console.error('[adaptive_word_plan] progress key migration failed', err)
  }
}

export function useAdaptiveWordPlan(user: User | null) {
  const { data: plans, isLoading } = adaptiveWordPlansStore.useSessionData(user)

  const loadProgress = useCallback(
    async (planId: string): Promise<AdaptivePlanWordProgress[]> => {
      if (!user) return []
      return loadProgressRowsFromCloud(user.id, planId)
    },
    [user],
  )

  /** Batch progress fetch for plan list views — one query for N plans (no N+1). */
  const loadProgressForPlans = useCallback(
    async (planIds: string[]): Promise<Record<string, AdaptivePlanWordProgress[]>> => {
      if (!user || planIds.length === 0) return {}

      const rows = await loadProgressRowsForPlansFromCloud(user.id, planIds)
      const grouped: Record<string, AdaptivePlanWordProgress[]> = {}
      for (const id of planIds) grouped[id] = []
      for (const row of rows) {
        ;(grouped[row.planId] ??= []).push(row)
      }
      return grouped
    },
    [user],
  )

  const createPlan = useCallback(
    async (input: CreatePlanInput): Promise<CreatePlanResult> => {
      if (!user) throw new Error('Cannot create adaptive word plan without a user')

      const forceChallenge = input.forceChallenge === true
      const initRows = input.wordKeys.map((wordKey) =>
        mapWordToPlanInit(wordKey, input.masteryMap[wordKey], forceChallenge),
      )

      if (allWordsMastered(initRows) && !forceChallenge) {
        return { ok: false, reason: 'all_mastered' }
      }

      const now = new Date().toISOString()
      const newWordsPerDay = clampNewWordsPerDay(
        input.newWordsPerDay ?? PLAN_DEFAULTS.newWordsPerDay,
      )
      const bossEveryNNew = clampBossEveryNNew(
        input.bossEveryNNew ?? PLAN_DEFAULTS.bossEveryNNew,
      )
      const bossStubbornThreshold = clampBossStubbornThreshold(
        input.bossStubbornThreshold ?? PLAN_DEFAULTS.bossStubbornThreshold,
      )
      const bossPackLimit = clampBossPackLimit(
        input.bossPackLimit ?? PLAN_DEFAULTS.bossPackLimit,
      )
      const reviewCap = clampReviewCap(
        input.reviewCap ?? defaultReviewCap(newWordsPerDay),
      )
      const backlogFuse = clampBacklogFuse(
        input.backlogFuse ?? PLAN_DEFAULTS.backlogFuse,
      )
      const plan: AdaptiveWordPlan = {
        id: createUuid(),
        userId: user.id,
        title: input.title,
        scope: input.scope,
        ...PLAN_DEFAULTS,
        newWordsPerDay,
        reviewCap,
        backlogFuse,
        bossEveryNNew,
        bossStubbornThreshold,
        bossPackLimit,
        mode: 'normal',
        status: 'active',
        stats: {
          bossFailStreak: 0,
          bossQuestionTier: 1,
          everActivatedCount: 0,
          totalActivatedCount: 0,
          lastBossActivatedCount: 0,
        },
        createdAt: now,
        updatedAt: now,
      }

      const savedPlan = await insertPlanToCloud(plan)
      const progressRows: AdaptivePlanWordProgress[] = initRows.map((row) => ({
        planId: savedPlan.id,
        userId: user.id,
        wordKey: row.word_key,
        status: row.status,
        boxIndex: null,
        targetBox: row.target_box,
        streakWrong: 0,
        nextReviewDate: null,
        introducedOn: null,
        archivedAt: null,
      }))

      await insertProgressRowsToCloud(progressRows)

      // Verify rows landed — empty progress makes day-1 look like "nothing to learn".
      const { count, error: countError } = await supabase
        .from('adaptive_plan_word_progress')
        .select('id', { count: 'exact', head: true })
        .eq('plan_id', savedPlan.id)
        .eq('user_id', user.id)
      if (countError || !count || count < progressRows.length) {
        console.error('[adaptive_word_plan] progress verify failed', {
          expected: progressRows.length,
          count,
          countError,
        })
        throw countError ?? new Error(
          `计划单词进度写入不完整（期望 ${progressRows.length}，实际 ${count ?? 0}）。请确认已在 Supabase 执行 packages/english/sql/adaptive-word-plans.sql`,
        )
      }

      adaptiveWordPlansStore.patchSessionData(user.id, (prev) => [savedPlan, ...prev])

      return { ok: true, planId: savedPlan.id }
    },
    [user],
  )

  const updatePlan = useCallback(
    async (plan: AdaptiveWordPlan): Promise<void> => {
      if (!user) return
      const savedPlan = await upsertPlanToCloud({
        ...plan,
        userId: user.id,
        updatedAt: new Date().toISOString(),
      })

      adaptiveWordPlansStore.patchSessionData(user.id, (prev) =>
        prev.map((item) => (item.id === savedPlan.id ? savedPlan : item)),
      )
    },
    [user],
  )

  const saveProgressBatch = useCallback(
    async (rows: AdaptivePlanWordProgress[]): Promise<void> => {
      if (!user || rows.length === 0) return
      await saveProgressRowsToCloud(rows.map((row) => ({ ...row, userId: user.id })))
    },
    [user],
  )

  const deletePlan = useCallback(
    async (planId: string): Promise<void> => {
      if (!user) return

      const plan = plans.find((item) => item.id === planId) ?? (await loadPlanFromCloud(user.id, planId))
      if (!plan) return

      const archivedAt = new Date().toISOString()
      await upsertPlanToCloud({
        ...plan,
        userId: user.id,
        status: 'archived',
        archivedAt,
        updatedAt: archivedAt,
      })

      const progressRows = await loadProgress(planId)
      await saveProgressRowsToCloud(
        progressRows.map((row) => ({ ...row, userId: user.id, archivedAt })),
      )

      adaptiveWordPlansStore.patchSessionData(user.id, (prev) =>
        prev.filter((item) => item.id !== planId),
      )
    },
    [loadProgress, plans, user],
  )

  const completePlanIfEligible = useCallback(
    async (planId: string, hasOpenSession = false): Promise<boolean> => {
      if (!user) return false

      const progressRows = await loadProgress(planId)
      if (!isPlanCompletable(progressRows, hasOpenSession)) return false

      const plan = plans.find((item) => item.id === planId) ?? (await loadPlanFromCloud(user.id, planId))
      if (!plan) return false

      const updatedAt = new Date().toISOString()
      const savedPlan = await upsertPlanToCloud({
        ...plan,
        userId: user.id,
        status: 'completed',
        updatedAt,
      })
      await saveProgressRowsToCloud(
        progressRows.map((row) => ({ ...row, userId: user.id, archivedAt: updatedAt })),
      )

      adaptiveWordPlansStore.patchSessionData(user.id, (prev) =>
        prev.map((item) => (item.id === savedPlan.id ? savedPlan : item)),
      )

      return true
    },
    [loadProgress, plans, user],
  )

  /**
   * Archive progress rows whose wordKey no longer exists in the vocab (词库删词
   * 留下的孤儿行) — they can never be quizzed and would block plan completion.
   * Returns the number of rows archived; completes the plan if that unblocked it.
   */
  const archiveOrphanWords = useCallback(
    async (planId: string, validWordKeys: Set<string>): Promise<number> => {
      if (!user) return 0

      const progressRows = await loadProgress(planId)
      const orphans = progressRows.filter(
        (row) => row.archivedAt == null && !validWordKeys.has(row.wordKey),
      )
      if (orphans.length === 0) return 0

      const archivedAt = new Date().toISOString()
      await saveProgressRowsToCloud(
        orphans.map((row) => ({ ...row, userId: user.id, archivedAt })),
      )
      await completePlanIfEligible(planId)
      return orphans.length
    },
    [completePlanIfEligible, loadProgress, user],
  )

  return {
    plans,
    isLoading,
    loadProgress,
    loadProgressForPlans,
    createPlan,
    updatePlan,
    deletePlan,
    saveProgressBatch,
    completePlanIfEligible,
    archiveOrphanWords,
  }
}
