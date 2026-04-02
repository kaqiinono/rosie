'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PROBLEMS } from '@/utils/lesson36-data'
import { useLesson36 } from '@/components/math/lesson36/Lesson36Provider'
import FilterPanel from '@/components/math/lesson36/FilterPanel'

type MasteryFilter = 'all' | 'unstarted' | 'reinforce' | 'mastered'

function AlltestContent() {
  const { solveCount } = useLesson36()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')

  const [filters, setFilters] = useState(() => ({
    source: new Set(['lesson', 'homework', 'workbook', 'pretest']),
    type: typeParam ? new Set([typeParam]) : new Set(['type1', 'type2', 'type3', 'type4', 'type5', 'type6']),
    mastery: 'all' as MasteryFilter,
  }))

  const toggleFilter = (axis: 'source' | 'type', value: string) => {
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
