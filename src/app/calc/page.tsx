'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useCalcSettings } from '@/hooks/useCalcSettings'
import { useCalcWallet } from '@/hooks/useCalcWallet'
import { useCalcMistakes } from '@/hooks/useCalcMistakes'
import { useCalcLevelState } from '@/hooks/useCalcLevelState'
import { useCalcProblemState } from '@/hooks/useCalcProblemState'
import CalcAppHeader from '@/components/calc/CalcAppHeader'
import CalcConfigBar from '@/components/calc/CalcConfigBar'
import CalcLevelProgressBar from '@/components/calc/CalcLevelProgressBar'
import { formatLevel, levelSpec } from '@/utils/calc-levels'
import { playSfx } from '@/components/calc/audio'

export default function CalcHomePage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { settings, update, isLoading: settingsLoading } = useCalcSettings(user)
  const wallet = useCalcWallet(user)
  const { mistakes } = useCalcMistakes(user)
  const levelState = useCalcLevelState(user)
  const problemState = useCalcProblemState(user)

  useEffect(() => {
    if (!settingsLoading && !settings.freeMode) {
      void levelState.loadForLevels([settings.currentLevel])
      void problemState.loadForLevels([settings.currentLevel])
    }
  }, [settingsLoading, settings.freeMode, settings.currentLevel]) // eslint-disable-line react-hooks/exhaustive-deps

  const unresolvedMistakes = useMemo(
    () => mistakes.filter(m => !m.resolved),
    [mistakes],
  )

  const todayTarget = useMemo(() => {
    const fromQuery = Number(searchParams.get('count'))
    return Number.isFinite(fromQuery) && fromQuery > 0 ? fromQuery : settings.lastCount
  }, [searchParams, settings.lastCount])

  const todayProgressPct = todayTarget > 0
    ? Math.min(100, Math.round((wallet.todayQuestionsDone / todayTarget) * 100))
    : 0

  const handleStart = () => {
    playSfx('coin', settings.soundEnabled)
    const params = new URLSearchParams({
      count: String(settings.lastCount),
      time: String(settings.lastTimeLimit),
      mode: 'daily',
    })
    router.push(`/calc/session?${params.toString()}`)
  }

  if (settingsLoading || wallet.isLoading) {
    return (
      <>
        <CalcAppHeader
          balance={wallet.balance}
          soundEnabled={settings.soundEnabled}
          onToggleSound={() => update({ soundEnabled: !settings.soundEnabled })}
        />
        <div className="mx-auto max-w-[640px] px-4 py-10 text-center text-[13px]" style={{ color: 'rgba(196,181,253,0.5)' }}>
          加载中…
        </div>
      </>
    )
  }

  const currentSpec = levelSpec(settings.currentLevel)
  const todayAccuracy = wallet.todayQuestionsDone > 0
    ? Math.round((wallet.todayCorrect / wallet.todayQuestionsDone) * 100)
    : 0

  const weekly = wallet.sessions.slice(0, 30).reduce(
    (acc, s) => {
      const d = new Date(s.date + 'T00:00:00')
      const now = new Date()
      const diff = (now.getTime() - d.getTime()) / 86400000
      if (diff <= 7) {
        acc.questions += s.correctCount + s.retryCount + s.wrongCount
        acc.coins += s.coinsEarned
      }
      return acc
    },
    { questions: 0, coins: 0 },
  )

  return (
    <>
      <CalcAppHeader
        balance={wallet.balance}
        soundEnabled={settings.soundEnabled}
        onToggleSound={() => update({ soundEnabled: !settings.soundEnabled })}
      />

      <main className="mx-auto max-w-[640px] px-4 pt-5 pb-12 space-y-5 relative">

        {/* Level + Stats card */}
        <section
          className="rounded-2xl p-5"
          style={{
            background: 'rgba(139,92,246,0.08)',
            border: '1px solid rgba(139,92,246,0.22)',
            boxShadow: '0 4px 24px rgba(139,92,246,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <div
                className="text-[10px] font-extrabold tracking-widest uppercase mb-0.5"
                style={{ color: 'rgba(196,181,253,0.5)' }}
              >
                {settings.freeMode ? '自由练习' : '当前难度'}
              </div>
              <div
                className="font-fredoka text-[22px] font-black leading-none"
                style={{
                  background: 'linear-gradient(90deg, #c4b5fd, #f0abfc)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {settings.freeMode
                  ? `${settings.freeModeLevels.length} 种题型`
                  : formatLevel(settings.currentLevel)}
              </div>
              <div className="text-[11px] font-semibold mt-0.5" style={{ color: 'rgba(196,181,253,0.5)' }}>
                {settings.freeMode ? '混合出题 · 不评估升降级' : currentSpec.label}
              </div>
            </div>
            <Link
              href="/calc/settings"
              className="rounded-full px-3 py-1.5 text-[11px] font-extrabold no-underline transition-all"
              style={{
                background: 'rgba(139,92,246,0.15)',
                border: '1px solid rgba(139,92,246,0.3)',
                color: '#c4b5fd',
              }}
            >
              ⚙ 设置
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-xl px-3 py-3"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-wider mb-1"
                style={{ color: 'rgba(196,181,253,0.45)' }}
              >
                今日
              </div>
              <div className="font-fredoka text-[22px] font-black leading-none" style={{ color: '#f5f3ff' }}>
                {wallet.todayQuestionsDone}
                <span className="text-[12px] font-semibold ml-0.5" style={{ color: 'rgba(245,243,255,0.35)' }}>
                  /{todayTarget}
                </span>
              </div>
              <div className="text-[10px] font-medium mt-1 mb-1.5" style={{ color: 'rgba(196,181,253,0.5)' }}>
                正确率 {todayAccuracy}%
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${todayProgressPct}%`,
                    background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
                    boxShadow: '0 0 8px rgba(139,92,246,0.6)',
                  }}
                />
              </div>
            </div>

            <div
              className="rounded-xl px-3 py-3"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-wider mb-1"
                style={{ color: 'rgba(196,181,253,0.45)' }}
              >
                本周
              </div>
              <div className="font-fredoka text-[22px] font-black leading-none" style={{ color: '#f5f3ff' }}>
                {weekly.questions}
                <span className="text-[13px] font-semibold ml-0.5" style={{ color: 'rgba(245,243,255,0.35)' }}>题</span>
              </div>
              <div className="text-[10px] font-medium mt-1" style={{ color: 'rgba(245,158,11,0.7)' }}>
                ⭐ {weekly.coins} 星星
              </div>
            </div>
          </div>
        </section>

        {/* Level progress (daily mode only) */}
        {!settings.freeMode && (
          <CalcLevelProgressBar
            levelState={levelState.getLevelState(settings.currentLevel)}
            problemStates={problemState.states}
            level={settings.currentLevel}
            userId={user?.id ?? ''}
          />
        )}

        {/* Config */}
        <section>
          <div
            className="mb-2 flex items-center gap-2 text-[11px] font-extrabold tracking-widest uppercase"
            style={{ color: 'rgba(196,181,253,0.5)' }}
          >
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[11px]"
              style={{ background: 'rgba(139,92,246,0.25)' }}
            >
              📐
            </span>
            选择练习
          </div>
          <CalcConfigBar
            count={settings.lastCount}
            timeLimit={settings.lastTimeLimit}
            onChange={(patch) => update(patch.count !== undefined
              ? { lastCount: patch.count }
              : { lastTimeLimit: patch.timeLimit })}
          />
        </section>

        {/* CTA */}
        <button
          type="button"
          onClick={handleStart}
          className="w-full rounded-2xl px-5 py-4 text-[17px] font-black text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
          style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #d946ef 100%)',
            boxShadow: '0 6px 28px rgba(139,92,246,0.45), 0 1px 0 rgba(255,255,255,0.12) inset',
          }}
        >
          🚀 开始口算 →
        </button>

        {/* Secondary entries */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/calc/mistakes"
            className="flex items-center gap-2.5 rounded-2xl px-4 py-3 no-underline transition-all"
            style={{
              background: 'rgba(245,158,11,0.07)',
              border: '1px solid rgba(245,158,11,0.2)',
            }}
          >
            <span className="text-xl">📝</span>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-extrabold" style={{ color: '#fbbf24' }}>错题本</div>
              <div className="text-[11px] truncate" style={{ color: 'rgba(251,191,36,0.55)' }}>
                {unresolvedMistakes.length > 0 ? `${unresolvedMistakes.length} 题待掌握` : '暂无错题'}
              </div>
            </div>
            <span style={{ color: 'rgba(251,191,36,0.5)' }}>→</span>
          </Link>
          <Link
            href="/vouchers"
            className="flex items-center gap-2.5 rounded-2xl px-4 py-3 no-underline transition-all"
            style={{
              background: 'rgba(236,72,153,0.07)',
              border: '1px solid rgba(236,72,153,0.2)',
            }}
          >
            <span className="text-xl">🎁</span>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-extrabold" style={{ color: '#f9a8d4' }}>我的奖券</div>
              <div className="text-[11px] truncate" style={{ color: 'rgba(249,168,212,0.55)' }}>
                ⭐ {wallet.balance} 星星
              </div>
            </div>
            <span style={{ color: 'rgba(249,168,212,0.5)' }}>→</span>
          </Link>
        </div>

        <Link
          href="/calc/report"
          className="flex items-center gap-2.5 rounded-2xl px-4 py-3 no-underline transition-all"
          style={{
            background: 'rgba(125,211,252,0.06)',
            border: '1px solid rgba(125,211,252,0.18)',
          }}
        >
          <span className="text-xl">📊</span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-extrabold" style={{ color: '#7dd3fc' }}>练习报告</div>
            <div className="text-[11px] truncate" style={{ color: 'rgba(125,211,252,0.55)' }}>
              查看关卡进度 · 最弱题 · 关键事件
            </div>
          </div>
          <span style={{ color: 'rgba(125,211,252,0.5)' }}>→</span>
        </Link>

        {/* Recent sessions */}
        {wallet.sessions.length > 0 && (
          <section>
            <div
              className="mb-2 text-[11px] font-extrabold tracking-widest uppercase"
              style={{ color: 'rgba(196,181,253,0.4)' }}
            >
              最近练习
            </div>
            <div className="space-y-1.5">
              {wallet.sessions.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px]"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <span className="font-semibold tabular-nums" style={{ color: '#a78bfa' }}>
                    {s.date.slice(5).replace('-', '/')}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                  <span style={{ color: 'rgba(245,243,255,0.45)' }}>
                    {s.count} 题 {s.correctCount + s.retryCount} 对
                  </span>
                  <span
                    className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold tabular-nums"
                    style={{
                      background: 'rgba(245,158,11,0.15)',
                      color: '#fbbf24',
                    }}
                  >
                    ⭐ +{s.coinsEarned}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  )
}
