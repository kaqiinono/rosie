'use client'

import { use } from 'react'
import { redirect } from 'next/navigation'
import { GrammarUnitPage } from '@rosie/english'

export default function GrammarUnitRoute({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = use(params)
  const unitNumber = Number.parseInt(unitId, 10)
  // 1-115 正文单元 + 116-169 延展位（附录/补充练习/学习指导，见 extract-grammar-unit.mjs BACKMATTER）
  if (!Number.isInteger(unitNumber) || unitNumber < 1 || unitNumber > 169) {
    redirect('/english/grammar')
  }
  return <GrammarUnitPage unitNumber={unitNumber} />
}
