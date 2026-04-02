'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { PROBLEMS } from '@/utils/lesson37-data'
import { useLesson37 } from '@/components/math/lesson37/Lesson37Provider'
import FilterPanel from '@/components/math/lesson37/FilterPanel'

type MasteryFilter = 'all' | 'unstarted' | 'reinforce' | 'mastered'

function AlltestContent() {
  const { solveCount } = useLesson37()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')

  const [filters, setFilters] = useState({
    source: new Set(['lesson', 'homework', 'workbook', 'supplement', 'pretest']),
    type: new Set(['type1', 'type2', 'type3', 'type4', 'type5']),
    mastery: 'all' as MasteryFilter,
  })

  useEffect(() => {
    if (typeParam) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilters(f => ({ ...f, type: new Set([typeParam]) }))
    }
  }, [typeParam])

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
