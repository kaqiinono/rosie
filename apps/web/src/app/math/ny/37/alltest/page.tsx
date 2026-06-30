'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { PROBLEMS } from '@rosie/math/utils/lesson37-data'
import { useLesson37 } from '@rosie/math/components/lesson37/Lesson37Provider'
import type { ProblemDifficulty } from '@rosie/core'
import { ALL_DIFFICULTY_LEVELS } from '@rosie/core'
import FilterPanel from '@rosie/math/components/lesson37/FilterPanel'

type MasteryFilter = 'all' | 'unstarted' | 'reinforce' | 'mastered'
type PracticeFilter = 'all' | 'unpracticed' | 'practiced'

function AlltestContent() {
  const { solveCount } = useLesson37()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')

  const [filters, setFilters] = useState({
    source: new Set(['lesson', 'homework', 'workbook', 'supplement', 'pretest']),
    type: new Set(['type1', 'type2', 'type3', 'type4', 'type5']),
    difficulty: new Set<ProblemDifficulty>(ALL_DIFFICULTY_LEVELS),
    mastery: 'all' as MasteryFilter,
    practice: 'all' as PracticeFilter,
  })

  useEffect(() => {
    if (typeParam) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilters(f => ({ ...f, type: new Set([typeParam]) }))
    }
  }, [typeParam])

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

  const setPractice = (value: PracticeFilter) => {
    setFilters(f => ({ ...f, practice: value }))
  }

  return (
    <FilterPanel
      problems={PROBLEMS}
      solveCount={solveCount}
      filters={filters}
      onToggleFilter={toggleFilter}
      onSetMastery={setMastery}
      onSetPractice={setPractice}
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
