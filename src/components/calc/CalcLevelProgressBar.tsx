'use client'

import { useMemo } from 'react'
import { bankFor, expectedBankSize } from '@/utils/calc-bank'
import type { CalcLevel, CalcLevelStateInfo, CalcProblemState } from '@/utils/type'

const ABC_MASTERY_RATIO = 0.8

const STEPS = ['达标', '复测1', '复测2', '升级'] as const

function statusToStep(status: CalcLevelStateInfo['status']): number {
  switch (status) {
    case 'practicing': return 0
    case 'abc_passed': return 1
    case 'review_r1': return 2
    case 'review_r2': return 3
    case 'review_r3':
    case 'mastered': return 4
  }
}

interface Props {
  levelState: CalcLevelStateInfo
  problemStates: Map<string, CalcProblemState>
  level: CalcLevel
  userId: string
}

export default function CalcLevelProgressBar({ levelState, problemStates, level, userId }: Props) {
  const currentStep = statusToStep(levelState.status)

  const masteryInfo = useMemo(() => {
    if (levelState.status !== 'practicing') return null
    const bank = bankFor(level, userId)
    if (!bank) return null
    const required = Math.ceil(expectedBankSize(level) * ABC_MASTERY_RATIO)
    const masteredCount = bank.filter((q) => {
      const s = problemStates.get(q.signature)
      return s !== undefined && (s.status === 'review' || s.status === 'mastered')
    }).length
    return { masteredCount, required, total: bank.length }
  }, [levelState.status, level, userId, problemStates])

  const detail = useMemo(() => {
    if (!levelState.warmupComplete) {
      const left = Math.max(0, 10 - levelState.warmupAnswered)
      return `热身中，还差 ${left} 题开始评估`
    }
    switch (levelState.status) {
      case 'practicing':
        return masteryInfo
          ? `已掌握 ${masteryInfo.masteredCount}/${masteryInfo.required} 题（需达 80%）`
          : '练习中'
      case 'abc_passed':
        return '✓ 达标！再完成一场复测'
      case 'review_r1':
        return '✓ 复测1通过！再完成一场复测'
      case 'review_r2':
        return '✓ 复测2通过！最后一场复测后升级'
      case 'review_r3':
      case 'mastered':
        return '✓ 全部通过，准备升级！'
    }
  }, [levelState, masteryInfo])

  const masteryPct = masteryInfo
    ? Math.min(100, Math.round((masteryInfo.masteredCount / masteryInfo.required) * 100))
    : 0

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'rgba(139,92,246,0.06)',
        border: '1px solid rgba(139,92,246,0.18)',
      }}
    >
      <div
        className="mb-3 text-[10px] font-extrabold tracking-widest uppercase"
        style={{ color: 'rgba(196,181,253,0.5)' }}
      >
        晋级进度
      </div>

      {/* Step nodes */}
      <div className="flex items-center mb-3">
        {STEPS.map((label, i) => {
          const done = i < currentStep
          const active = i === currentStep
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-black transition-all"
                  style={{
                    background: done
                      ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                      : active
                        ? 'rgba(139,92,246,0.3)'
                        : 'rgba(255,255,255,0.06)',
                    border: active
                      ? '2px solid #a855f7'
                      : done
                        ? 'none'
                        : '1px solid rgba(255,255,255,0.12)',
                    color: done ? '#fff' : active ? '#c4b5fd' : 'rgba(255,255,255,0.25)',
                    boxShadow: active ? '0 0 10px rgba(168,85,247,0.5)' : 'none',
                  }}
                >
                  {done ? '✓' : i + 1}
                </div>
                <span
                  className="text-[10px] font-bold whitespace-nowrap"
                  style={{
                    color: done
                      ? '#a78bfa'
                      : active
                        ? '#c4b5fd'
                        : 'rgba(255,255,255,0.2)',
                  }}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="h-px flex-1 mx-1 mb-5"
                  style={{
                    background: i < currentStep
                      ? 'linear-gradient(90deg, #7c3aed, #a855f7)'
                      : 'rgba(255,255,255,0.08)',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Mastery sub-bar (practicing only) */}
      {levelState.status === 'practicing' && masteryInfo && levelState.warmupComplete && (
        <div className="mb-2">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${masteryPct}%`,
                background: masteryPct >= 100
                  ? 'linear-gradient(90deg, #7c3aed, #a855f7)'
                  : 'linear-gradient(90deg, #4c1d95, #7c3aed)',
              }}
            />
          </div>
        </div>
      )}

      {/* Detail text */}
      <div className="text-[11px] font-semibold" style={{ color: 'rgba(196,181,253,0.55)' }}>
        {detail}
      </div>
    </div>
  )
}
