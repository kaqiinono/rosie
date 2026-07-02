'use client'

import { use } from 'react'
import { ChineseUnitPage, getChineseBook, useChineseContext } from '@rosie/chinese'

export default function ChineseBookUnitRoute({ params }: { params: Promise<{ unit: string }> }) {
  const { unit: unitStr } = use(params)
  const unitNum = Number(unitStr)
  const { bookSlug, lessonGroups, lessons, isCharDataLoading, isCharDataReady } = useChineseContext()
  const unit = getChineseBook(bookSlug)?.units.find((u) => u.unit === unitNum)

  if (!unit) {
    return <p className="p-6 text-center text-sm text-slate-500">未找到该单元</p>
  }

  return (
    <ChineseUnitPage
      unit={unit}
      lessonGroups={lessonGroups}
      lessons={lessons}
      isLoading={isCharDataLoading && !isCharDataReady}
    />
  )
}
