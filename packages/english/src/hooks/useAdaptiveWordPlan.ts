'use client'

import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase, type WordMasteryMap } from '@rosie/core'
import { allWordsMastered, mapWordToPlanInit } from '../utils/adaptivePlanInit'
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
}

type CreatePlanResult = { ok: true; planId: string } | { ok: false; reason: 'all_mastered' }

const PLAN_SELECT =
  'id, user_id, title, scope, new_words_per_day, review_cap, review_batch_size, backlog_fuse, boss_every_n_new, boss_stubborn_threshold, mode, status, stats, created_at, updated_at, archived_at'

const PROGRESS_SELECT =
  'id, plan_id, user_id, word_key, status, box_index, target_box, streak_wrong, next_review_date, introduced_on, archived_at'

const PROGRESS_INSERT_CHUNK_SIZE = 200

const PLAN_DEFAULTS = {
  newWordsPerDay: 10,
  reviewCap: 40,
  reviewBatchSize: 20,
  backlogFuse: 50,
  bossEveryNNew: 50,
  bossStubbornThreshold: 15,
} as const

function clampNewWordsPerDay(n: number): number {
  if (!Number.isFinite(n)) return PLAN_DEFAULTS.newWordsPerDay
  return Math.min(20, Math.max(1, Math.round(n)))
}

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

export const adaptiveWordPlansStore = createUserSessionStore<AdaptiveWordPlan[]>(
  'adaptive_word_plans',
  {
    fetch: loadAllPlansFromCloud,
    empty: [],
  },
)

export function useAdaptiveWordPlan(user: User | null) {
  const { data: plans, isLoading } = adaptiveWordPlansStore.useSessionData(user)

  const loadProgress = useCallback(
    async (planId: string): Promise<AdaptivePlanWordProgress[]> => {
      if (!user) return []

      const { data, error } = await supabase
        .from('adaptive_plan_word_progress')
        .select(PROGRESS_SELECT)
        .eq('user_id', user.id)
        .eq('plan_id', planId)
        .order('word_key', { ascending: true })

      if (error) {
        console.error('[adaptive_word_plan] loadProgress failed', error)
        throw error
      }
      return (data as AdaptivePlanProgressRow[]).map(mapProgressRowToModel)
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
      const plan: AdaptiveWordPlan = {
        id: createUuid(),
        userId: user.id,
        title: input.title,
        scope: input.scope,
        ...PLAN_DEFAULTS,
        newWordsPerDay,
        reviewCap: Math.max(PLAN_DEFAULTS.reviewCap, newWordsPerDay * 4),
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
          `计划单词进度写入不完整（期望 ${progressRows.length}，实际 ${count ?? 0}）。请确认已在 Supabase 执行 docs/sql/adaptive-word-plans.sql`,
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
    async (planId: string): Promise<boolean> => {
      if (!user) return false

      const progressRows = await loadProgress(planId)
      if (!isPlanCompletable(progressRows, false)) return false

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

  return {
    plans,
    isLoading,
    loadProgress,
    createPlan,
    updatePlan,
    deletePlan,
    saveProgressBatch,
    completePlanIfEligible,
  }
}
