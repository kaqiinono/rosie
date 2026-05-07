'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLesson41 } from '@/components/math/lesson41/Lesson41Provider'
import { PROBLEMS } from '@/utils/lesson41-data'
import FilterPanel from '@/components/math/lesson41/FilterPanel'

type MasteryFilter = 'all' | 'unstarted' | 'reinforce' | 'mastered'

function AlltestContent() {
  const { solveCount } = useLesson41()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')

  const [filters, setFilters] = useState(() => ({
    source: new Set(['pretest', 'lesson', 'homework', 'workbook']),
    type: typeParam ? new Set([typeParam]) : new Set(['type1', 'type2', 'type3', 'type4']),
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
