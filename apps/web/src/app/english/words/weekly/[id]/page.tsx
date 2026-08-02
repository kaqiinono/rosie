'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@rosie/core'
import { useWordsContext } from '@rosie/english'
import type { WeeklyPlan } from '@rosie/core'
import { WeeklyPlanSession } from '@rosie/english'
import { loadWeeklyPlanById } from '@/lib/loadWeeklyPlanById'

function WeeklyPlanPageInner() {
  const router = useRouter()
  const routeParams = useParams()
  const searchParams = useSearchParams()
  const planId = typeof routeParams.id === 'string' ? routeParams.id : ''
  const { user } = useAuth()
  const { vocab } = useWordsContext()
  const [plan, setPlan] = useState<WeeklyPlan | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // Capture once so clearing `?start=1` from the URL doesn't cancel auto-start.
  const [autoStart] = useState(() => searchParams.get('start') === '1')

  useEffect(() => {
    if (!autoStart) return
    if (searchParams.get('start') !== '1') return
    const next = new URLSearchParams(searchParams.toString())
    next.delete('start')
    const qs = next.toString()
    router.replace(`/english/words/weekly/${planId}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [autoStart, searchParams, router, planId])

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
    return () => { cancelled = true }
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
        <button
          onClick={() => router.push('/english/words/daily')}
          className="font-nunito cursor-pointer rounded-full border border-[var(--wm-border)] px-4 py-2 text-sm text-[var(--wm-text-dim)]"
        >
          ← 返回列表
        </button>
      </div>
    )
  }

  return (
    <WeeklyPlanSession
      key={plan.id ?? plan.weekStart}
      initialPlan={plan}
      vocab={vocab}
      autoStart={autoStart}
      onBack={() => router.push('/english/words/daily')}
    />
  )
}

export default function WeeklyPlanPage({ params: _params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--wm-text-dim)]">
          加载中…
        </div>
      }
    >
      <WeeklyPlanPageInner />
    </Suspense>
  )
}
