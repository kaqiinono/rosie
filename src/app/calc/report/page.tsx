'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCalcWallet } from '@/hooks/useCalcWallet'
import { useCalcSettings } from '@/hooks/useCalcSettings'
import { supabase } from '@/lib/supabase'
import CalcAppHeader from '@/components/calc/CalcAppHeader'
import { ERROR_TAG_LABELS } from '@/utils/calc-diagnose'
import { sourceStats, sessionVerdict, type SourceStat } from '@/utils/calc-report-stats'
import { TIER_LABEL } from '@/utils/calc-time-targets'
import type { ErrorTag } from '@/utils/type'

export default function CalcReportPage() {
  const { user } = useAuth()
  const { settings, update } = useCalcSettings(user)
  const wallet = useCalcWallet(user)

  const [errorCounts, setErrorCounts] = useState<{ tag: ErrorTag; count: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      // Aggregate error-tag distribution across still-unresolved mistakes.
      const { data: mistakeRows } = await supabase
        .from('calc_mistakes')
        .select('error_tag,resolved')
        .eq('user_id', user.id)
        .eq('resolved', false)
        .not('error_tag', 'is', null)
      if (cancelled) return
      const counts = new Map<ErrorTag, number>()
      for (const r of (mistakeRows ?? []) as { error_tag: ErrorTag }[]) {
        counts.set(r.error_tag, (counts.get(r.error_tag) ?? 0) + 1)
      }
      setErrorCounts(
        [...counts.entries()]
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count),
      )

      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [user])

  const recentSessions = wallet.sessions.slice(0, 5)

  const mixedLabels = useMemo(
    () => new Map(settings.mixedOps.map((m) => [m.id, m.label ?? ''] as const)),
    [settings.mixedOps],
  )
  const mixedSkeletons = useMemo(
    () => new Map(settings.mixedOps.map((m) => [m.id, m.skeleton] as const)),
    [settings.mixedOps],
  )
  const stats = useMemo(
    () => sourceStats(wallet.sessions, mixedLabels, mixedSkeletons).sort((a, b) => a.accuracy - b.accuracy || a.avgSec - b.avgSec),
    [wallet.sessions, mixedLabels, mixedSkeletons],
  )
  const verdict = useMemo(() => sessionVerdict(wallet.sessions), [wallet.sessions])
  const needWork = useMemo(() => {
    const rank = { entry: 0, stable: 1, fluent: 2, auto: 3 } as const
    return [...stats]
      .sort((a, b) => (rank[a.tier ?? 'entry'] - rank[b.tier ?? 'entry']) || (a.deltaSec ?? 0) - (b.deltaSec ?? 0))
      .slice(0, 3)
  }, [stats])

  const hasData = stats.length > 0 || wallet.sessions.length > 0

  return (
    <>
      <CalcAppHeader
        balance={wallet.balance}
        soundEnabled={settings.soundEnabled}
        onToggleSound={() => update({ soundEnabled: !settings.soundEnabled })}
        title="练习报告"
        backHref="/calc"
        backLabel="口算"
      />

      <main className="mx-auto max-w-[640px] px-4 pt-5 pb-12 space-y-6">
        {loading && (
          <div className="text-center text-[13px] py-10" style={{ color: 'rgba(196,181,253,0.4)' }}>
            加载中…
          </div>
        )}

        {!loading && !hasData && (
          <div
            className="text-center text-[13px] py-12 rounded-2xl"
            style={{
              color: 'rgba(196,181,253,0.6)',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            还没有练习数据，先去练一练吧～
          </div>
        )}

        {!loading && hasData && (
          <>
            {/* 1. 本次速览 */}
            <section>
              <h2 className="mb-2 text-[11px] font-extrabold tracking-widest uppercase" style={{ color: 'rgba(196,181,253,0.45)' }}>
                本次速览
              </h2>
              <div className="rounded-2xl px-4 py-4" style={{ background: 'rgba(125,211,252,0.07)', border: '1px solid rgba(125,211,252,0.2)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-fredoka text-[22px] font-black leading-none" style={{ color: '#7dd3fc' }}>
                      {verdict.perMinute}<span className="ml-1 text-[12px] font-bold" style={{ color: 'rgba(125,211,252,0.6)' }}>题/分钟</span>
                    </div>
                    {verdict.trend === 'up' && <div className="mt-1 text-[12px] font-extrabold" style={{ color: '#4ade80' }}>📈 本次进步！平均每题快 {Math.abs(verdict.deltaSec ?? 0)}秒 · {verdict.improved} 个题型变快</div>}
                    {verdict.trend === 'down' && <div className="mt-1 text-[12px] font-extrabold" style={{ color: '#fbbf24' }}>📉 略有退步 · 平均每题慢 {Math.abs(verdict.deltaSec ?? 0)}秒</div>}
                    {verdict.trend === 'flat' && <div className="mt-1 text-[12px] font-bold" style={{ color: 'rgba(125,211,252,0.6)' }}>≈ 与上次持平</div>}
                    {verdict.trend === null && <div className="mt-1 text-[12px] font-bold" style={{ color: 'rgba(125,211,252,0.5)' }}>首场基准，继续加油～</div>}
                  </div>
                </div>
              </div>
            </section>

            {/* 2. 各题型一行 */}
            {stats.length > 0 && (
              <section>
                <h2 className="mb-2 text-[11px] font-extrabold tracking-widest uppercase" style={{ color: 'rgba(196,181,253,0.45)' }}>
                  各题型速度
                </h2>
                <div className="space-y-1.5">
                  {stats.map((s) => <SourceRow key={s.key} s={s} />)}
                </div>
              </section>
            )}

            {/* 3. 需加强 Top 3 */}
            {needWork.length > 0 && (
              <section>
                <h2 className="mb-2 text-[11px] font-extrabold tracking-widest uppercase" style={{ color: 'rgba(196,181,253,0.45)' }}>
                  需加强
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {needWork.map((s) => (
                    <span key={s.key} className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color: '#fbbf24', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
                      🎯 {s.label} · {s.tier ? TIER_LABEL[s.tier] : '未设目标'}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* 4. 错误类型分布 */}
            {errorCounts.length > 0 && (
              <section>
                <h2
                  className="mb-2 text-[11px] font-extrabold tracking-widest uppercase"
                  style={{ color: 'rgba(196,181,253,0.45)' }}
                >
                  错误类型分布
                </h2>
                <div className="space-y-1.5">
                  {errorCounts.map(({ tag, count }) => {
                    const max = errorCounts[0].count
                    return (
                      <div key={tag} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 text-[12px]" style={{ color: '#e9d5ff' }}>
                          {ERROR_TAG_LABELS[tag]}
                        </span>
                        <div
                          className="h-2 flex-1 overflow-hidden rounded-full"
                          style={{ background: 'rgba(255,255,255,0.07)' }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.round((count / max) * 100)}%`,
                              background: count >= 3 ? '#f87171' : '#fbbf24',
                            }}
                          />
                        </div>
                        <span
                          className="w-8 text-right text-[11px] font-extrabold tabular-nums"
                          style={{ color: 'rgba(196,181,253,0.6)' }}
                        >
                          {count}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* 5. 最近练习 */}
            {recentSessions.length > 0 && (
              <section>
                <h2
                  className="mb-2 text-[11px] font-extrabold tracking-widest uppercase"
                  style={{ color: 'rgba(196,181,253,0.45)' }}
                >
                  最近练习
                </h2>
                <div className="space-y-1">
                  {recentSessions.map((s, i) => {
                    const done = s.correctCount + s.retryCount + s.wrongCount
                    const right = s.correctCount + s.retryCount
                    return (
                      <div
                        key={s.id ?? `${s.finishedAt}-${i}`}
                        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px]"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.07)',
                        }}
                      >
                        <span className="text-[11px] tabular-nums shrink-0" style={{ color: 'rgba(245,243,255,0.45)' }}>
                          {s.date.slice(5)}
                        </span>
                        <span className="text-[11px] tabular-nums" style={{ color: '#e9d5ff' }}>
                          {done} 题
                        </span>
                        <span
                          className="text-[11px] font-extrabold tabular-nums"
                          style={{ color: '#4ade80' }}
                        >
                          对 {right}
                        </span>
                        <span className="ml-auto text-[11px] font-extrabold tabular-nums shrink-0" style={{ color: '#fbbf24' }}>
                          ⭐ {s.coinsEarned}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  )
}

function tierColor(tier: SourceStat['tier']): string {
  if (tier === 'auto') return '#22d3ee'
  if (tier === 'fluent') return '#4ade80'
  if (tier === 'stable') return '#fbbf24'
  if (tier === 'entry') return '#f87171'
  return 'rgba(196,181,253,0.4)'
}

function SourceRow({ s }: { s: SourceStat }) {
  const color = tierColor(s.tier)
  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-bold" style={{ color: '#e9d5ff' }}>{s.label}</div>
        <div className="text-[10px]" style={{ color: 'rgba(245,243,255,0.4)' }}>
          {s.avgSec}s/题 · 正确率 {Math.round(s.accuracy * 100)}%
          {s.deltaSec !== null && s.deltaSec !== 0 && (
            <span style={{ color: s.deltaSec > 0 ? '#4ade80' : '#fbbf24' }}> · {s.deltaSec > 0 ? '↑快' : '↓慢'}{Math.abs(s.deltaSec)}s</span>
          )}
          {s.tier && s.tier !== 'auto' && s.gapSec > 0 && (
            <span style={{ color: 'rgba(196,181,253,0.5)' }}> · 再快{s.gapSec}s升档</span>
          )}
        </div>
      </div>
      <div className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ color, background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}55` }}>
        {s.tier ? TIER_LABEL[s.tier] : '未设目标'}
      </div>
    </div>
  )
}
