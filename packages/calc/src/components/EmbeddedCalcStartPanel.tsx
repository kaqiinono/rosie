'use client'

import dynamic from 'next/dynamic'
import { useCallback, useRef, useState } from 'react'
import { useAuth, type CalcTimingMode } from '@rosie/core'
import { AppDialog, DarkScope, LoadingOverlay } from '@rosie/ui'
import { useCalcSettings, useCalcStrategies } from '../hooks/useCalcSettings'
import { calcPlannedQuestionCount, calcExpandedQuestionCount } from '../utils/calc-planned-question-count'
import { playSfx } from './audio'
import CalcStartPanel from './CalcStartPanel'

const CalcSession = dynamic(() => import('../pages/session').then(module => module.CalcSession), {
  loading: () => <LoadingOverlay visible placement="content" />,
})

export default function EmbeddedCalcStartPanel({ beforeStart, disabled, taskId }: {
  taskId?: string
  beforeStart?: () => Promise<boolean>
  disabled?: boolean
}) {
  const { user } = useAuth()
  const { settings: defaults, isLoading } = useCalcSettings(user)
  const { strategies, isLoading: strategiesLoading } = useCalcStrategies(user)
  const [count, setCount] = useState<number | null>(null)
  const [timing, setTiming] = useState<CalcTimingMode | null>(null)
  const [bonus, setBonus] = useState<number | null>(null)
  const [sessionParams, setSessionParams] = useState<URLSearchParams | null>(null)
  const startButtonRef = useRef<HTMLButtonElement>(null)
  const exitRef = useRef<(() => void) | null>(null)
  const closeSession = useCallback(() => setSessionParams(null), [])
  const strategy = strategies.find(item => item.isActive)
  const settings = strategy?.settings ?? defaults
  const total = calcPlannedQuestionCount(settings)
  const selectedCount = count ?? total
  const selectedTiming = timing ?? settings.timingMode
  const selectedBonus = bonus ?? settings.bonusSec
  if (isLoading || strategiesLoading) return <div className="relative flex min-h-64 flex-col"><LoadingOverlay visible placement="content" /></div>
  async function start() {
    if (!user || disabled || (beforeStart && !(await beforeStart()))) return
    playSfx('coin', settings.soundEnabled)
    const query = new URLSearchParams({
      mode: 'daily', start: '1', count: String(selectedCount), timing: selectedTiming, bonus: String(selectedBonus),
    })
    if (strategy) query.set('strategy', strategy.id)
    setSessionParams(query)
  }

  return <>
    <CalcStartPanel
      totalQuestions={total}
      currentSessionCount={selectedCount}
      expandedSessionCount={calcExpandedQuestionCount(settings, selectedCount)}
      currentTimingMode={selectedTiming}
      currentBonusSec={selectedBonus}
      setSessionCount={setCount}
      setSessionTimingMode={setTiming}
      setSessionBonusSec={setBonus}
      startButtonRef={startButtonRef}
      startDisabled={disabled || !user}
      handleStart={start}
    />
    {sessionParams && user && (
      <AppDialog open title="每日口算练习" presentation="bottom-drawer" chrome="none" contentLayout="fill" returnFocusRef={startButtonRef}
        onOpenChange={open => {
          if (!open) (exitRef.current ?? closeSession)()
        }}>
        <div className="relative h-full overflow-hidden bg-[#06071a] [contain:paint]">
          <div className="h-full overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
            <DarkScope>
              <CalcSession params={sessionParams} taskScope={taskId ? `task:${user.id}:${taskId}` : `embedded:${user.id}:daily`}
                onReturnToTask={closeSession} exitRef={exitRef} />
            </DarkScope>
          </div>
        </div>
      </AppDialog>
    )}
  </>
}
