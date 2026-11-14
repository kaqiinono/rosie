'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@rosie/core'
import { useWordsContext, WeeklyPlanSession } from '@rosie/english'
import type { WeeklyPlan } from '@rosie/core'
import { loadWeeklyPlanById } from '@/lib/loadWeeklyPlanById'
import { Button } from '@rosie/ui/themes'

/** Practice entry — load plan and start today's study immediately. */
export default function WeeklyPlanPracticePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const routeParams = useParams()
  const planId = typeof routeParams.id === 'string' ? routeParams.id : ''
  const { user } = useAuth()
  const { vocab } = useWordsContext()
  const [plan, setPlan] = useState<WeeklyPlan | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user || !planId) return
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      const loaded = await loadWeeklyPlanById(user.id, planId)
      if (!cancelled) {
        setPlan(loaded)
        setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, planId])

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--wm-text-dim)]">
        加载中…
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="text-sm text-[var(--wm-text-dim)]">计划不存在或已删除</div>
        <Button
          type="button"
          onClick={() => router.push('/english/words/daily')}
          variant="outline"
          color="gray"
          size="2"
        >
          ← 返回列表
        </Button>
      </div>
    )
  }

  const requestedDate = searchParams.get('date')
  const startDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : null
  return (
    <WeeklyPlanSession
      key={plan.id ?? plan.weekStart}
      initialPlan={plan}
      vocab={vocab}
      autoStart
      startDate={startDate}
      onBack={() => router.push(`/english/words/weekly/${planId}`)}
    />
  )
}
