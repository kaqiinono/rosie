'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { MathPlanProblem, ProblemMasteryMap, MathRotatingReviewState } from '@/utils/type'
import { assignRotatingReviewForDay } from '@/utils/math-helpers'

function computeLessonOrder(priorLessonProbs: Record<string, MathPlanProblem[]>): string[] {
  return Object.entries(priorLessonProbs)
    .filter(([, probs]) => probs.length > 0)
    .map(([id]) => id)
    .sort((a, b) => Number(a) - Number(b))
}

function initialState(planLessonId: string, priorLessonProbs: Record<string, MathPlanProblem[]>): MathRotatingReviewState {
  return {
    planLessonId,
    lessonOrder: computeLessonOrder(priorLessonProbs),
    nextLessonIndex: 0,
    perLesson: {},
    dailyAssignments: {},
    dailyDoneKeys: {},
  }
}

async function loadFromCloud(userId: string, planLessonId: string, priorLessonProbs: Record<string, MathPlanProblem[]>): Promise<MathRotatingReviewState | null> {
  try {
    const { data, error } = await supabase
      .from('math_rotating_review')
      .select('state_data')
      .eq('user_id', userId)
      .single()
    if (error || !data) return null
    const s = data.state_data as MathRotatingReviewState
    if (s.planLessonId !== planLessonId) return null
    return {
      ...initialState(planLessonId, priorLessonProbs),
      ...s,
      dailyAssignments: s.dailyAssignments ?? {},
      dailyDoneKeys: s.dailyDoneKeys ?? {},
      perLesson: s.perLesson ?? {},
    }
  } catch {
    return null
  }
}

async function saveToCloud(userId: string, state: MathRotatingReviewState): Promise<void> {
  try {
    await supabase
      .from('math_rotating_review')
      .upsert(
        { user_id: userId, state_data: state, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
  } catch { /* ignore */ }
}

export function useMathRotatingReview(
  user: User | null,
  activeLessonId: string,
  selectedDate: string | null,
  priorLessonProbs: Record<string, MathPlanProblem[]>,
  masteryMap: ProblemMasteryMap,
  dailyRequiredCounts: Record<string, number>,
  problemsPerDay: number,
): {
  reviewProblems: MathPlanProblem[]
  markReviewDone: (key: string) => void
  isCompletedToday: (key: string) => boolean
} {
  const [state, setState] = useState<MathRotatingReviewState>(() =>
    initialState(activeLessonId, priorLessonProbs),
  )
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  // Load from cloud on mount / user change
  useEffect(() => {
    if (!user) return
    void loadFromCloud(user.id, activeLessonId, priorLessonProbs).then(cloud => {
      if (cloud) setState(cloud)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeLessonId])

  // Reset state when switching to a different lesson plan
  useEffect(() => {
    if (stateRef.current.planLessonId !== activeLessonId) {
      const fresh = initialState(activeLessonId, priorLessonProbs)
      setState(fresh)
      if (user) void saveToCloud(user.id, fresh)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLessonId])

  const allProbs = useMemo(() => {
    const map: Record<string, MathPlanProblem> = {}
    for (const probs of Object.values(priorLessonProbs)) {
      for (const p of probs) map[p.key] = p
    }
    return map
  }, [priorLessonProbs])

  // Assign review problems for selectedDate when first viewed
  useEffect(() => {
    if (activeLessonId === '' || !selectedDate) return
    if (stateRef.current.planLessonId !== activeLessonId) return
    if (stateRef.current.dailyAssignments[selectedDate]) return

    const requiredCount = dailyRequiredCounts[selectedDate] ?? 0
    const { newState } = assignRotatingReviewForDay(
      stateRef.current,
      selectedDate,
      priorLessonProbs,
      masteryMap,
      requiredCount,
      problemsPerDay,
    )
    setState(newState)
    if (user) void saveToCloud(user.id, newState)
  }, [activeLessonId, selectedDate, priorLessonProbs, masteryMap, dailyRequiredCounts, problemsPerDay, user])

  const reviewProblems = useMemo(() => {
    if (!selectedDate) return []
    const keys = state.dailyAssignments[selectedDate] ?? []
    return keys.map(k => allProbs[k]).filter(Boolean) as MathPlanProblem[]
  }, [state.dailyAssignments, selectedDate, allProbs])

  const markReviewDone = useCallback(
    (key: string) => {
      if (!selectedDate) return
      setState(prev => {
        const existing = prev.dailyDoneKeys[selectedDate] ?? []
        if (existing.includes(key)) return prev
        const next: MathRotatingReviewState = {
          ...prev,
          dailyDoneKeys: { ...prev.dailyDoneKeys, [selectedDate]: [...existing, key] },
        }
        if (user) void saveToCloud(user.id, next)
        return next
      })
    },
    [selectedDate, user],
  )

  const isCompletedToday = useCallback(
    (key: string): boolean => {
      if (!selectedDate) return false
      return (state.dailyDoneKeys[selectedDate] ?? []).includes(key)
    },
    [state.dailyDoneKeys, selectedDate],
  )

  if (activeLessonId === '' || stateRef.current.lessonOrder.length === 0) {
    return { reviewProblems: [], markReviewDone: () => {}, isCompletedToday: () => false }
  }

  return { reviewProblems, markReviewDone, isCompletedToday }
}
