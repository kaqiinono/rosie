'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PROBLEMS } from '@rosie/math/utils/lesson35-data'
import { useLesson35 } from '@rosie/math/components/lesson35/Lesson35Provider'
import type { ProblemDifficulty } from '@rosie/core'
import FilterPanel from '@rosie/math/components/lesson35/FilterPanel'

type MasteryFilter = 'all' | 'unstarted' | 'reinforce' | 'mastered'

function AlltestContent() {
  const { solveCount } = useLesson35()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')

  const [filters, setFilters] = useState(() => ({
    source: new Set(['lesson', 'homework', 'workbook', 'pretest']),
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
