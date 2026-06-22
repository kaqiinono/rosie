'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useWordsContext } from '@/contexts/WordsContext'
import type { WeeklyPlan } from '@/utils/type'
import WeeklyPlanSession from '@/components/english/words/WeeklyPlanSession'
import { loadWeeklyPlanById } from '@/lib/loadWeeklyPlanById'

export default function WeeklyPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { user } = useAuth()
  const { vocab } = useWordsContext()
  const [plan, setPlan] = useState<WeeklyPlan | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      const { id } = await params
      if (cancelled) return
      setIsLoading(true)
      const loaded = await loadWeeklyPlanById(user.id, id)
      if (!cancelled) {
        setPlan(loaded)
        setIsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user, params])

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
      onBack={() => router.push('/english/words/daily')}
    />
  )
}
