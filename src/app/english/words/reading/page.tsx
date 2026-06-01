'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useWeeklyPlan } from '@/hooks/useWeeklyPlan'
import { readingPassages, findPassage } from '@/utils/reading-data'

export default function ReadingIndexPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { weeklyPlan, isLoading } = useWeeklyPlan(user)

  useEffect(() => {
    if (isLoading) return
    let key: string | null = null

    // Prefer the current week's focus lesson if it has a passage
    const focusKey = weeklyPlan?.focusLessonKey
    if (focusKey) {
      const [unit, lesson] = focusKey.split('::')
      const p = findPassage(unit, lesson)
      if (p) key = p.key
    }

    // Otherwise: first lesson in the current plan that has a passage
    if (!key && weeklyPlan) {
      const units = weeklyPlan.unit.split(',').map((s) => s.trim())
      const lessons = weeklyPlan.lesson.split(',').map((s) => s.trim())
      for (let i = 0; i < units.length; i++) {
        const p = findPassage(units[i], lessons[i] ?? lessons[0])
        if (p) {
          key = p.key
          break
        }
      }
    }

    // Final fallback: first available passage
    if (!key) key = readingPassages[0]?.key ?? null

    if (key) router.replace(`/english/words/reading/${key}`)
  }, [router, weeklyPlan, isLoading])

  return (
    <div className="flex min-h-[60vh] items-center justify-center text-[var(--wm-text-dim)]">
      <div className="text-center">
        <div className="mb-2 text-4xl">📖</div>
        <div className="font-nunito">正在打开课文…</div>
      </div>
    </div>
  )
}
