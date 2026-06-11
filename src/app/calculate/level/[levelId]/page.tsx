'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useCalculateLevelState } from '@/hooks/useCalculateLevelState'
import { getLevel, getTreeForLevel, TIER_CONFIG } from '@/utils/calculate-trees'
import type { LevelId, Tier, TierStatus } from '@/utils/calculate-types'
import Link from 'next/link'
import { use } from 'react'

export default function LevelPage({ params }: { params: Promise<{ levelId: string }> }) {
  const { levelId: rawId } = use(params)
  const levelId = rawId as LevelId
  const { user } = useAuth()
  const { getTierStatus, levels } = useCalculateLevelState(user)

  const level = getLevel(levelId)
  const tree = getTreeForLevel(levelId)
  if (!level || !tree) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white">
        关卡不存在
      </div>
    )
  }

  const levelState = levels.get(levelId)
  const bestAccuracy = (t: Tier) => {
    if (!levelState) return null
    if (t === 'beginner') return levelState.bestAccuracyBeginner
    if (t === 'advanced') return levelState.bestAccuracyAdvanced
    return levelState.bestAccuracyChallenge
  }

  const tiers: { tier: Tier; label: string; status: TierStatus; accuracy: number | null }[] = [
    { tier: 'beginner', label: '入门', status: getTierStatus(levelId, 'beginner'), accuracy: bestAccuracy('beginner') },
    { tier: 'advanced', label: '进阶', status: getTierStatus(levelId, 'advanced'), accuracy: bestAccuracy('advanced') },
    { tier: 'challenge', label: '挑战', status: getTierStatus(levelId, 'challenge'), accuracy: bestAccuracy('challenge') },
  ]

  return (
    <div className="mx-auto max-w-lg px-4 pb-12 pt-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href={`/calculate/tree/${tree.id}`} className="text-white/60 hover:text-white">
          ◀
        </Link>
        <div>
          <h1 className="text-lg font-bold text-white">
            {levelId} {level.name}
          </h1>
          <div className="text-xs text-white/40">{level.description}</div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {tiers.map(({ tier, label, status, accuracy }, i) => {
          const cfg = TIER_CONFIG[tier]
          const prevPassed = i === 0 || tiers[i - 1].status === 'passed'
          const locked = !prevPassed
          const pct = accuracy !== null ? Math.round(accuracy * 100) : null

          return (
            <div
              key={tier}
              className={`rounded-2xl p-4 ${
                locked ? 'bg-white/[0.04] opacity-50' : 'bg-white/[0.07]'
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-white">
                  {label}
                  {status === 'passed' && (
                    <span className="ml-2 text-green-400">⭐ 已通关</span>
                  )}
                  {status === 'practicing' && (
                    <span className="ml-2 text-amber-400">● 进行中</span>
                  )}
                </span>
                {pct !== null && (
                  <span className="text-xs text-white/40">最高 {pct}%</span>
                )}
              </div>

              {pct !== null && (
                <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${pct >= cfg.passRate * 100 ? 'bg-green-500' : 'bg-amber-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}

              <div className="mb-2 text-xs text-white/40">
                {cfg.questionCount} 题 · 通关线 {Math.round(cfg.passRate * 100)}%
                {cfg.hasTimeLimit && ' · 含时间限制'}
                {cfg.includesVariants && ' · 含变体'}
              </div>

              {!locked && (
                <Link
                  href={`/calculate/session?level=${levelId}&tier=${tier}`}
                  className={`mt-2 block rounded-xl py-2.5 text-center text-sm font-bold ${
                    status === 'passed'
                      ? 'bg-white/10 text-white/70 hover:bg-white/15'
                      : 'bg-blue-600 text-white hover:bg-blue-500'
                  }`}
                >
                  {status === 'passed' ? '再练一次' : status === 'practicing' ? '继续闯关 →' : '开始闯关 →'}
                </Link>
              )}

              {locked && (
                <div className="mt-2 text-xs text-white/30">🔒 需通过{tiers[i - 1].label}档</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
