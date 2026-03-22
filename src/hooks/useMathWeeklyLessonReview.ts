'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { MathPlanProblem, MathWeeklyLessonReviewState } from '@/utils/type'
import { STORAGE_KEYS } from '@/utils/constant'
import { pickWeeklyLessonProblem } from '@/utils/math-helpers'

function initialState(planLessonId: string): MathWeeklyLessonReviewState {
  return {
    planLessonId,
    reviewCounts: {},
    dailyAssignments: {},
    dailyDoneKeys: {},
    dailySkipped: {},
  }
}

function loadLocal(planLessonId: string): MathWeeklyLessonReviewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MATH_WEEKLY_LESSON_REVIEW)
    if (!raw) return initialState(planLessonId)
    const parsed = JSON.parse(raw) as MathWeeklyLessonReviewState
    if (parsed.planLessonId !== planLessonId) return initialState(planLessonId)
    return {
      ...initialState(planLessonId),
      ...parsed,
      reviewCounts: parsed.reviewCounts ?? {},
      dailyAssignments: parsed.dailyAssignments ?? {},
      dailyDoneKeys: parsed.dailyDoneKeys ?? {},
      dailySkipped: parsed.dailySkipped ?? {},
    }
  } catch {
    return initialState(planLessonId)
  }
}

function saveLocal(state: MathWeeklyLessonReviewState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MATH_WEEKLY_LESSON_REVIEW, JSON.stringify(state))
  } catch { /* ignore */ }
}

async function loadFromCloud(userId: string, planLessonId: string): Promise<MathWeeklyLessonReviewState | null> {
  try {
    const { data, error } = await supabase
      .from('math_weekly_lesson_review')
      .select('state_data')
      .eq('user_id', userId)
      .single()
    if (error || !data) return null
    const s = data.state_data as MathWeeklyLessonReviewState
    if (s.planLessonId !== planLessonId) return null
    return {
      ...initialState(planLessonId),
      ...s,
      reviewCounts: s.reviewCounts ?? {},
      dailyAssignments: s.dailyAssignments ?? {},
      dailyDoneKeys: s.dailyDoneKeys ?? {},
      dailySkipped: s.dailySkipped ?? {},
    }
  } catch {
    return null
  }
}

async function saveToCloud(userId: string, state: MathWeeklyLessonReviewState): Promise<void> {
  try {
    await supabase
      .from('math_weekly_lesson_review')
      .upsert(
        { user_id: userId, state_data: state, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
  } catch { /* ignore */ }
}

export function useMathWeeklyLessonReview(
  user: User | null,
  activeLessonId: string,
  selectedDate: string | null,
  priorLessonProbs: Record<string, MathPlanProblem[]>,
  excludeKeys: Set<string>,
): {
  todayProblem: MathPlanProblem | null
  todayLessonId: string | null
  reviewCounts: Record<string, number>
  isDone: boolean
  isSkipped: boolean
  markDone: (key: string) => void
  markSkipped: () => void
} {
  const [state, setState] = useState<MathWeeklyLessonReviewState>(() =>
    loadLocal(activeLessonId),
  )
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  // Load from cloud on mount / user change
  useEffect(() => {
    if (!user) {
      setState(loadLocal(activeLessonId))
      return
    }
    void loadFromCloud(user.id, activeLessonId).then(cloud => {
      if (cloud) {
        setState(cloud)
        saveLocal(cloud)
      } else {
        setState(loadLocal(activeLessonId))
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeLessonId])

  // Reset state when switching to a different lesson plan
  useEffect(() => {
    if (stateRef.current.planLessonId !== activeLessonId) {
      const fresh = initialState(activeLessonId)
      setState(fresh)
      saveLocal(fresh)
      if (user) void saveToCloud(user.id, fresh)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLessonId])

  // Assign problem for selectedDate when first viewed; re-pick if current assignment conflicts with excludeKeys
  useEffect(() => {
    if (activeLessonId === '' || !selectedDate) return
    if (stateRef.current.planLessonId !== activeLessonId) return

    const existing = stateRef.current.dailyAssignments[selectedDate]
    // Skip if already assigned and not excluded by rotating review
    if (existing !== undefined && !excludeKeys.has(existing)) return

    const hasProblems = Object.values(priorLessonProbs).some(p => p.length > 0)
    if (!hasProblems) return

    const result = pickWeeklyLessonProblem(priorLessonProbs, stateRef.current.reviewCounts, excludeKeys)
    if (!result) return

    const newState: MathWeeklyLessonReviewState = {
      ...stateRef.current,
      dailyAssignments: { ...stateRef.current.dailyAssignments, [selectedDate]: result.problem.key },
    }
    setState(newState)
    saveLocal(newState)
    if (user) void saveToCloud(user.id, newState)
  }, [activeLessonId, selectedDate, priorLessonProbs, excludeKeys, user])

  const assignedKey = selectedDate ? state.dailyAssignments[selectedDate] : undefined
  const allProbs = Object.values(priorLessonProbs).flat()
  const todayProblem = assignedKey ? (allProbs.find(p => p.key === assignedKey) ?? null) : null
  const todayLessonId = todayProblem?.lessonId ?? null

  const isDone = !!(selectedDate && assignedKey && (state.dailyDoneKeys[selectedDate] ?? []).includes(assignedKey))
  const isSkipped = !!(selectedDate && state.dailySkipped[selectedDate])

  const markDone = useCallback(
    (key: string) => {
      if (!selectedDate) return
      setState(prev => {
        const existing = prev.dailyDoneKeys[selectedDate] ?? []
        if (existing.includes(key)) return prev
        const next: MathWeeklyLessonReviewState = {
          ...prev,
          reviewCounts: { ...prev.reviewCounts, [key]: (prev.reviewCounts[key] ?? 0) + 1 },
          dailyDoneKeys: { ...prev.dailyDoneKeys, [selectedDate]: [...existing, key] },
        }
        saveLocal(next)
        if (user) void saveToCloud(user.id, next)
        return next
      })
    },
    [selectedDate, user],
  )

  const markSkipped = useCallback(() => {
    if (!selectedDate) return
    setState(prev => {
      if (prev.dailySkipped[selectedDate]) return prev
      const next: MathWeeklyLessonReviewState = {
        ...prev,
        dailySkipped: { ...prev.dailySkipped, [selectedDate]: true },
      }
      saveLocal(next)
      if (user) void saveToCloud(user.id, next)
      return next
    })
  }, [selectedDate, user])

  if (activeLessonId === '') {
    return { todayProblem: null, todayLessonId: null, reviewCounts: {}, isDone: false, isSkipped: false, markDone: () => {}, markSkipped: () => {} }
  }

  return { todayProblem, todayLessonId, reviewCounts: state.reviewCounts, isDone, isSkipped, markDone, markSkipped }
}
