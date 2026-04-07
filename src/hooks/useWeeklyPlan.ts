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

async function loadAllPlansFromCloud(userId: string): Promise<WeeklyPlan[]> {
    try {
        const {data, error} = await supabase
            .from('weekly_plans')
            .select('week_start, unit, lesson, week_start_day, new_words_per_day, plan_data, progress_data')
            .eq('user_id', userId)
            .order('week_start', {ascending: false})
        if (error || !data) return []
        return data.map(row => ({
            weekStart: row.week_start,
            unit: row.unit,
            lesson: row.lesson,
            weekStartDay: row.week_start_day ?? SYSTEM_DEFAULTS.weekStartDay,
            newWordsPerDay: row.new_words_per_day ?? SYSTEM_DEFAULTS.newWordsPerDay,
            days: row.plan_data as WeeklyPlan['days'],
            progress: (row.progress_data as WeeklyPlan['progress']) ?? {},
        }))
    } catch {
        return []
    }
}

export function useWeeklyPlan(user: User | null) {
    const [defaultParams, setDefaultParams] = useState<{ weekStartDay: number; newWordsPerDay: number } | null>(null)
    const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null)
    const [allPlans, setAllPlans] = useState<WeeklyPlan[]>([])
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

    // Step 4: load all plans for the list view
    useEffect(() => {
        if (!user) return
        void loadAllPlansFromCloud(user.id).then(setAllPlans)
    }, [user])

    const selectPlan = useCallback((plan: WeeklyPlan) => {
        setWeeklyPlan(plan)
    }, [])

    const deletePlan = useCallback(async (weekStart: string) => {
        setAllPlans(prev => prev.filter(p => p.weekStart !== weekStart))
        setWeeklyPlan(prev => prev?.weekStart === weekStart ? null : prev)
        if (user) {
            try {
                await supabase
                    .from('weekly_plans')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('week_start', weekStart)
            } catch { /* ignore */ }
        }
    }, [user])

    const savePlan = useCallback(async (plan: WeeklyPlan) => {
        setWeeklyPlan(plan)
        setAllPlans(prev => {
            const rest = prev.filter(p => p.weekStart !== plan.weekStart)
            return [plan, ...rest]
        })
        if (user) await saveToCloud(user.id, plan)
    }, [user])

    const updateDayProgress = useCallback(async (date: string, progress: WeekDayProgress) => {
        let updated: WeeklyPlan | null = null
        setWeeklyPlan(prev => {
            if (!prev) return prev
            updated = {...prev, progress: {...prev.progress, [date]: progress}}
            return updated
        })
        if (updated) {
            setAllPlans(prev => prev.map(p => p.weekStart === updated!.weekStart ? updated! : p))
            if (user) void saveToCloud(user.id, updated)
        }
    }, [user])

    return {
        weeklyPlan,
        allPlans,
        selectPlan,
        deletePlan,
        previousPlan: null,
        currentWeekStart,
        defaultParams,
        savePlan,
        updateDayProgress,
        isLoading,
    }
}
