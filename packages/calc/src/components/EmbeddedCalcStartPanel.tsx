'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, type CalcTimingMode } from '@rosie/core'
import { DarkScope, LoadingOverlay } from '@rosie/ui'
import { useCalcSettings, useCalcStrategies } from '../hooks/useCalcSettings'
import { calcPlannedQuestionCount, calcExpandedQuestionCount } from '../utils/calc-planned-question-count'
import { playSfx } from './audio'
import CalcStartPanel from './CalcStartPanel'

export default function EmbeddedCalcStartPanel() {
  const { user } = useAuth()
  const router = useRouter()
  const { settings: defaults, isLoading } = useCalcSettings(user)
  const { strategies, isLoading: strategiesLoading } = useCalcStrategies(user)
  const [count, setCount] = useState<number | null>(null)
  const [timing, setTiming] = useState<CalcTimingMode | null>(null)
  const [bonus, setBonus] = useState<number | null>(null)
  const strategy = strategies.find(item => item.isActive)
  const settings = strategy?.settings ?? defaults
  const total = calcPlannedQuestionCount(settings)
  const selectedCount = count ?? total
  const selectedTiming = timing ?? settings.timingMode
  const selectedBonus = bonus ?? settings.bonusSec
  if (isLoading || strategiesLoading) return <div className="relative flex min-h-64 flex-col"><LoadingOverlay visible placement="content" /></div>
  return <DarkScope><div className="rounded-3xl bg-[#0f0f1a] p-2">
    <CalcStartPanel totalQuestions={total} currentSessionCount={selectedCount} expandedSessionCount={calcExpandedQuestionCount(settings, selectedCount)}
      currentTimingMode={selectedTiming} currentBonusSec={selectedBonus} setSessionCount={setCount} setSessionTimingMode={setTiming} setSessionBonusSec={setBonus}
      handleStart={() => {
        playSfx('coin', settings.soundEnabled)
        const query = new URLSearchParams({ mode: 'daily', start: '1', count: String(selectedCount), timing: selectedTiming, bonus: String(selectedBonus) })
        if (strategy) query.set('strategy', strategy.id)
        router.push(`/calc/session?${query}`)
      }} />
  </div></DarkScope>
}
