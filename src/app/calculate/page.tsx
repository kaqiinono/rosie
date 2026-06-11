'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useCalculateSettings } from '@/hooks/useCalculateSettings'
import { useCalculateLevelState } from '@/hooks/useCalculateLevelState'
import { fetchTodayStats } from '@/utils/calculate-persist'
import { SKILL_TREES } from '@/utils/calculate-trees'
import type { TreeConfig, LevelId } from '@/utils/calculate-types'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const TREE_COLORS: Record<string, string> = {
  emerald: '#10b981',
  amber: '#f59e0b',
  blue: '#3b82f6',
  sky: '#0ea5e9',
  orange: '#f97316',
  purple: '#a855f7',
  rose: '#f43f5e',
  slate: '#64748b',
  zinc: '#71717a',
  indigo: '#6366f1',
  yellow: '#eab308',
}

export default function CalculateHome() {
  const { user } = useAuth()
  const { settings } = useCalculateSettings(user)
  const { isFullyPassed } = useCalculateLevelState(user)

  const [todayQuestions, setTodayQuestions] = useState(0)
  const [todayStars, setTodayStars] = useState(0)

  useEffect(() => {
    if (!user) return
    const today = new Date().toISOString().slice(0, 10)
    void fetchTodayStats(user.id, today).then((stats) => {
      setTodayQuestions(stats.totalQuestions)
      setTodayStars(stats.totalStars)
    })
  }, [user])

  const dailyTarget = settings.dailyTarget
  const progressPct = dailyTarget > 0 ? Math.min(100, Math.round((todayQuestions / dailyTarget) * 100)) : 0

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-white/60 hover:text-white">
          ◀
        </Link>
        <h1 className="text-lg font-bold text-white">计算训练</h1>
        <Link href="/calculate/settings" className="text-white/60 hover:text-white">
          ⚙
        </Link>
      </div>

      {/* 摸底测推荐（仅新用户） */}
      {Object.keys(settings.thetaPerTree ?? {}).length === 0 && todayQuestions === 0 && (
        <Link
          href="/calculate/onboarding"
          className="mb-4 block rounded-2xl border border-blue-400/30 bg-blue-500/10 p-4 hover:bg-blue-500/20"
        >
          <div className="mb-1 flex items-center gap-2">
            <span>🎯</span>
            <span className="text-sm font-bold text-blue-300">先做个能力评估</span>
          </div>
          <div className="text-xs text-white/60">6-10 题摸底，找到最适合你的起点 →</div>
        </Link>
      )}

      {/* 今日进度 */}
      <div className="mb-6 rounded-2xl bg-white/[0.06] p-4 backdrop-blur-sm">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm text-white/50">今日进度</span>
          <span className="text-xs text-amber-400">⭐ {todayStars}</span>
        </div>
        <div className="mb-1 text-xs text-white/40">
          {todayQuestions}/{dailyTarget} 题
        </div>
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <Link
          href="/calculate/session?mode=daily"
          className="block rounded-xl bg-blue-600 py-3 text-center font-bold text-white hover:bg-blue-500"
        >
          开始今日练习 →
        </Link>
      </div>

      {/* 技能树 */}
      <div className="mb-4 text-sm font-medium text-white/40">技能树</div>
      <div className="grid grid-cols-3 gap-3">
        {SKILL_TREES.map((tree) => (
          <TreeCard
            key={tree.id}
            tree={tree}
            isFullyPassed={isFullyPassed}
          />
        ))}
      </div>

      {/* 底部导航 */}
      <nav className="fixed bottom-0 left-0 right-0 flex justify-around border-t border-white/10 bg-[#0a0918]/90 py-3 backdrop-blur-md">
        <Link href="/calculate" className="text-center text-xs text-blue-400">
          <div className="text-lg">🏠</div>
          首页
        </Link>
        <Link href="/calculate/report" className="text-center text-xs text-white/50 hover:text-white">
          <div className="text-lg">📊</div>
          报告
        </Link>
        <Link href="/calculate/mistakes" className="text-center text-xs text-white/50 hover:text-white">
          <div className="text-lg">📖</div>
          错题
        </Link>
        <Link href="/calculate/settings" className="text-center text-xs text-white/50 hover:text-white">
          <div className="text-lg">⚙</div>
          设置
        </Link>
      </nav>
    </div>
  )
}

type TreeCardProps = {
  tree: TreeConfig
  isFullyPassed: (id: LevelId) => boolean
}

function TreeCard({ tree, isFullyPassed }: TreeCardProps) {
  const total = tree.levels.length
  const passed = tree.levels.filter((l) => isFullyPassed(l.id)).length

  const isTreeUnlocked = tree.prerequisites.every((p) =>
    isFullyPassed(p as LevelId),
  )

  const progress = total > 0 ? (passed / total) * 100 : 0
  const barColor = TREE_COLORS[tree.color] ?? '#3b82f6'

  if (!isTreeUnlocked) {
    return (
      <div className="flex flex-col items-center rounded-2xl bg-white/[0.04] p-3 opacity-50">
        <div className="mb-1 text-2xl">{tree.icon}</div>
        <div className="mb-1 text-xs font-medium text-white/70">{tree.name}</div>
        <div className="text-xs text-white/30">🔒</div>
      </div>
    )
  }

  return (
    <Link
      href={`/calculate/tree/${tree.id}`}
      className="flex flex-col items-center rounded-2xl bg-white/[0.06] p-3 transition hover:bg-white/[0.10]"
    >
      <div className="mb-1 text-2xl">{tree.icon}</div>
      <div className="mb-1 text-xs font-medium text-white">{tree.name}</div>
      <div className="mb-1 text-[10px] text-white/50">
        {passed}/{total} {passed === total && '✓'}
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${progress}%`, backgroundColor: barColor }}
        />
      </div>
    </Link>
  )
}
