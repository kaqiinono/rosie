'use client'

import { use } from 'react'
import { ChineseUnitPage, UNITS, useChineseContext } from '@rosie/chinese'

export default function ChineseUnitRoute({ params }: { params: Promise<{ unit: string }> }) {
  const { unit: unitStr } = use(params)
  const unitNum = Number(unitStr)
  const unit = UNITS.find((u) => u.unit === unitNum)
  const { lessonGroups, lessons, isCharDataLoading, isCharDataReady } = useChineseContext()

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
