'use client'

import { use } from 'react'
import { redirect } from 'next/navigation'
import { GrammarUnitPage } from '@rosie/english'

export default function GrammarUnitRoute({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = use(params)
  const unitNumber = Number.parseInt(unitId, 10)
  if (!Number.isInteger(unitNumber) || unitNumber < 1 || unitNumber > 116) {
    redirect('/english/grammar')
  }
  return <GrammarUnitPage unitNumber={unitNumber} />
}
