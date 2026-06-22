'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLesson12 } from '@/components/math/lesson12/Lesson12Provider'
import { PROBLEMS } from '@/utils/lesson12-data'
import type { ProblemDifficulty } from '@/utils/difficulty'
import FilterPanel from '@/components/math/lesson12/FilterPanel'

type MasteryFilter = 'all' | 'unstarted' | 'reinforce' | 'mastered'

function AlltestContent() {
  const { solveCount } = useLesson12()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')

  const [filters, setFilters] = useState(() => ({
    source: new Set(['pretest', 'lesson', 'homework', 'workbook']),
    type: typeParam ? new Set([typeParam]) : new Set(['type1', 'type2', 'type3', 'type4', 'type5']),
    mastery: 'all' as MasteryFilter,
    difficulty: new Set<ProblemDifficulty>([1, 2, 3, 4, 5]),
  }))

  const toggleFilter = (axis: 'source' | 'type' | 'difficulty', value: string) => {
    if (axis === 'difficulty') {
      const level = Number(value) as ProblemDifficulty
      setFilters(f => {
        const next = new Set(f.difficulty)
        if (next.has(level)) next.delete(level)
        else next.add(level)
        return { ...f, difficulty: next }
      })
      return
    }
    setFilters(f => {
      const next = new Set(f[axis])
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...f, [axis]: next }
    })
  }

  const setMastery = (value: MasteryFilter) => {
    setFilters(f => ({ ...f, mastery: value }))
  }

  return (
    <FilterPanel
      problems={PROBLEMS}
      solveCount={solveCount}
      filters={filters}
      onToggleFilter={toggleFilter}
      onSetMastery={setMastery}
    />
  )
}

export default function AlltestPage() {
  return (
    <Suspense>
      <AlltestContent />
    </Suspense>
  )
}
