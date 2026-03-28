'use client'

import {useState, useCallback, useEffect, useMemo} from 'react'
import type {User} from '@supabase/supabase-js'
import {supabase} from '@/lib/supabase'
import {getWeekStart} from '@/utils/english-helpers'
import type {WeeklyPlan, WeekDayProgress} from '@/utils/type'

const SYSTEM_DEFAULTS = {weekStartDay: 4, newWordsPerDay: 3}

async function loadMostRecentPlan(userId: string, beforeWeekStart: string): Promise<{
    weekStartDay: number;
    newWordsPerDay: number
} | null> {
    try {
        const {data} = await supabase
            .from('weekly_plans')
            .select('week_start_day, new_words_per_day')
            .eq('user_id', userId)
            .lt('week_start', beforeWeekStart)
            .order('week_start', {ascending: false})
            .limit(1)
            .maybeSingle()
        if (!data) return null
        return {
            weekStartDay: data.week_start_day ?? SYSTEM_DEFAULTS.weekStartDay,
            newWordsPerDay: data.new_words_per_day ?? SYSTEM_DEFAULTS.newWordsPerDay,
        }
    } catch {
        return null
    }
}

async function loadFromCloud(userId: string, weekStart: string): Promise<WeeklyPlan | null> {
    try {
        const {data, error} = await supabase
            .from('weekly_plans')
            .select('unit, lesson, week_start_day, new_words_per_day, plan_data, progress_data')
            .eq('user_id', userId)
            .eq('week_start', weekStart)
            .single()
        if (error || !data) return null
        return {
            weekStart,
            unit: data.unit,
            lesson: data.lesson,
            weekStartDay: data.week_start_day ?? SYSTEM_DEFAULTS.weekStartDay,
            newWordsPerDay: data.new_words_per_day ?? SYSTEM_DEFAULTS.newWordsPerDay,
            days: data.plan_data as WeeklyPlan['days'],
            progress: (data.progress_data as WeeklyPlan['progress']) ?? {},
        }
    } catch {
        return null
    }
}

async function saveToCloud(userId: string, plan: WeeklyPlan): Promise<void> {
    try {
        await supabase
            .from('weekly_plans')
            .upsert(
                {
                    user_id: userId,
                    week_start: plan.weekStart,
                    unit: plan.unit,
                    lesson: plan.lesson,
                    week_start_day: plan.weekStartDay,
                    new_words_per_day: plan.newWordsPerDay,
                    plan_data: plan.days,
                    progress_data: plan.progress,
                    updated_at: new Date().toISOString(),
                },
                {onConflict: 'user_id,week_start'},
            )
    } catch { /* ignore */
    }
}

export function useWeeklyPlan(user: User | null) {
    const [defaultParams, setDefaultParams] = useState<{ weekStartDay: number; newWordsPerDay: number } | null>(null)
    const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null)
    const [isLoading, setIsLoading] = useState(() => user !== null)
    const [syncedUser, setSyncedUser] = useState(user)
    if (syncedUser !== user) {
        setSyncedUser(user)
        setDefaultParams(null)
    }

    // Step 1: load defaultParams (most recent prior plan's params, or system defaults)
    // Use a far-future date so we include all existing plans (including the current week's if any)
    useEffect(() => {
        if (!user) return
        void loadMostRecentPlan(user.id, '9999-12-31').then(params => {
            setDefaultParams(params ?? SYSTEM_DEFAULTS)
        })
    }, [user])

    // Step 2: currentWeekStart derives from defaultParams.weekStartDay (null until defaultParams loads)
    const currentWeekStart = useMemo(() => {
        if (!defaultParams) return null
        return getWeekStart(undefined, defaultParams.weekStartDay)
    }, [defaultParams])

    // Step 3: load current plan once currentWeekStart is known
    useEffect(() => {
        if (!user || !currentWeekStart) return
        void (async () => {
            setIsLoading(true)
            const cloud = await loadFromCloud(user.id, currentWeekStart)
            setWeeklyPlan(cloud)
            setIsLoading(false)
        })()
    }, [user, currentWeekStart])

    const savePlan = useCallback(async (plan: WeeklyPlan) => {
        setWeeklyPlan(plan)
        if (user) await saveToCloud(user.id, plan)
    }, [user])

    const updateDayProgress = useCallback(async (date: string, progress: WeekDayProgress) => {
        setWeeklyPlan(prev => {
            if (!prev) return prev
            const updated: WeeklyPlan = {
                ...prev,
                progress: {...prev.progress, [date]: progress},
            }
            if (user) void saveToCloud(user.id, updated)
            return updated
        })
    }, [user])

    return {
        weeklyPlan,
        previousPlan: null,
        currentWeekStart,
        defaultParams,
        savePlan,
        updateDayProgress,
        isLoading,
    }
}
