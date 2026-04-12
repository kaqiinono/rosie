'use client'

import {useState, useCallback, useEffect, useMemo, useRef} from 'react'
import type {User} from '@supabase/supabase-js'
import {supabase} from '@/lib/supabase'
import {getWeekStart} from '@/utils/english-helpers'
import type {WeeklyPlan, WeekDayProgress} from '@/utils/type'

const SYSTEM_DEFAULTS = {weekStartDay: 4, newWordsPerDay: 3}

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
    const weeklyPlanRef = useRef<WeeklyPlan | null>(null)
    const [allPlans, setAllPlans] = useState<WeeklyPlan[]>([])
    const [isLoading, setIsLoading] = useState(() => user !== null)
    const [syncedUser, setSyncedUser] = useState(user)
    if (syncedUser !== user) {
        setSyncedUser(user)
        setDefaultParams(null)
    }

    weeklyPlanRef.current = weeklyPlan

    // 单次查询替代原来3次串行查询：
    // 1. 加载全部计划（原 loadAllPlansFromCloud）
    // 2. 从最新计划推导 defaultParams（原 loadMostRecentPlan）
    // 3. 从结果中直接找当周计划（原 loadFromCloud）
    useEffect(() => {
        if (!user) return
        void (async () => {
            setIsLoading(true)
            const plans = await loadAllPlansFromCloud(user.id)
            setAllPlans(plans)

            // 最新计划（按 week_start desc 排序，plans[0] 即最新）提供默认参数
            const params = plans.length > 0
                ? {weekStartDay: plans[0].weekStartDay, newWordsPerDay: plans[0].newWordsPerDay}
                : SYSTEM_DEFAULTS
            setDefaultParams(params)

            // 用推导出的 weekStartDay 算出当周起始日，直接从已加载列表里找
            const weekStart = getWeekStart(undefined, params.weekStartDay)
            setWeeklyPlan(plans.find(p => p.weekStart === weekStart) ?? null)
            setIsLoading(false)
        })()
    }, [user])

    const currentWeekStart = useMemo(() => {
        if (!defaultParams) return null
        return getWeekStart(undefined, defaultParams.weekStartDay)
    }, [defaultParams])

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
        const current = weeklyPlanRef.current
        if (!current) return
        const updated: WeeklyPlan = {...current, progress: {...current.progress, [date]: progress}}
        weeklyPlanRef.current = updated
        setWeeklyPlan(updated)
        setAllPlans(prev => prev.map(p => p.weekStart === updated.weekStart ? updated : p))
        if (user) void saveToCloud(user.id, updated)
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
