'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { PROBLEMS } from '@/utils/lesson35-data'
import { useLesson35 } from '@/components/math/lesson35/Lesson35Provider'
import FilterPanel from '@/components/math/lesson35/FilterPanel'

function AlltestContent() {
  const { solved } = useLesson35()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')

  const [filters, setFilters] = useState({
    source: new Set(['lesson', 'homework', 'workbook', 'pretest']),
    type: new Set(['type1', 'type2', 'type3', 'type4', 'type5']),
  })

  useEffect(() => {
    if (typeParam) {
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

  return <FilterPanel problems={PROBLEMS} solved={solved} filters={filters} onToggleFilter={toggleFilter} />
}

export default function AlltestPage() {
  return (
    <Suspense>
      <AlltestContent />
    </Suspense>
  )
}
