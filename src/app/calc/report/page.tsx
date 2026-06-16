'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useCalcWallet } from '@/hooks/useCalcWallet'
import { useCalcProblemState } from '@/hooks/useCalcProblemState'
import { useCalcSettings } from '@/hooks/useCalcSettings'
import CalcAppHeader from '@/components/calc/CalcAppHeader'
import { skeletonMeta } from '@/utils/calc-mixed'
import { supabase } from '@/lib/supabase'
import {
  sourceStats,
  weeklyAggregates,
  opGroupStats,
  type SourceStat,
  type PeriodData,
  type OpGroupStat,
} from '@/utils/calc-report-stats'
import { TIER_LABEL, type Tier } from '@/utils/calc-time-targets'
import type { CalcProblemState, CalcSession } from '@/utils/type'
import { todayStr } from '@/utils/constant'

// ── constants ────────────────────────────────────────────────────────────────

const TIER_BADGE_BG: Record<Tier, string> = {
  entry: 'bg-red-100 text-red-700',
  stable: 'bg-yellow-100 text-yellow-700',
  fluent: 'bg-green-100 text-green-700',
  auto: 'bg-cyan-100 text-cyan-700',
}

// ── helpers ──────────────────────────────────────────────────────────────────

function padTwo(n: number) { return String(n).padStart(2, '0') }

function thursdayWeekStart(date: Date): string {
  const d = new Date(date)
  const backToThu = (d.getDay() - 4 + 7) % 7
  d.setDate(d.getDate() - backToThu)
  return `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}`
}

interface MistakeRow {
  error_tag: string | null
  resolved: boolean
  created_at: string
}

// ── DeltaChip ────────────────────────────────────────────────────────────────

function DeltaChip({ d, unit = '', invert = false }: { d: number | null; unit?: string; invert?: boolean }) {
  if (d === null) return null
  const delta = invert ? -d : d
  const pos = delta > 0
  return <span className={`text-xs font-medium ${pos ? 'text-green-600' : 'text-red-500'}`}>{pos ? '↑' : '↓'}{Math.abs(d)}{unit}</span>
}

// ── Section 1 ────────────────────────────────────────────────────────────────

function Section1({
  breakthroughSource,
  slowestGroup,
  onDrill,
}: {
  breakthroughSource: SourceStat | null
  slowestGroup: OpGroupStat | null
  onDrill: (url: string) => void
}) {
  if (!breakthroughSource || !slowestGroup || slowestGroup.insufficient) {
    return (
      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5">
        <h2 className="font-bold text-amber-800 text-base mb-2">本周重点</h2>
        <p className="text-amber-700 text-sm text-center py-2">还没有足够数据，先去练几次吧～</p>
      </div>
    )
  }

  const currentTier = breakthroughSource.tier
  const tierKeys: Tier[] = ['entry', 'stable', 'fluent', 'auto']
  const curIdx = currentTier ? tierKeys.indexOf(currentTier) : 0
  const nextTier = tierKeys[curIdx + 1] as Tier | undefined
  const nextTierLabel = nextTier ? TIER_LABEL[nextTier] : TIER_LABEL['auto']

  // fill% = how far through the current tier toward the next
  // gapSec = avgSec - nextTier.hi (how many seconds to shave off to hit next tier)
  // fill = 1 when gap ≈ 0 (about to level up), ~0 when just entered tier
  const fill = Math.min(0.95, Math.max(0.05, 1 - breakthroughSource.gapSec / Math.max(breakthroughSource.avgSec, 0.1)))

  const bid = breakthroughSource.key.split(':')[1] ?? ''

  return (
    <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">⭐</span>
        <h2 className="font-bold text-amber-800 text-lg">本周重点</h2>
      </div>

      <p className="text-amber-900 text-sm leading-relaxed">
        <strong>{slowestGroup.label}法</strong>是当前最慢（{slowestGroup.avgSec}s/题
        {slowestGroup.tier ? `，${TIER_LABEL[slowestGroup.tier]}档` : ''}）。
        {' '}<strong>{breakthroughSource.label}</strong> 再快 {breakthroughSource.gapSec}s 就升到
        {nextTierLabel}档了！
      </p>

      <div>
        <div className="h-3 bg-amber-200 rounded-full overflow-hidden mb-1">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.round(fill * 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-amber-700">
          <span>{currentTier ? TIER_LABEL[currentTier] : '入门'}档</span>
          <span className="font-bold text-blue-600">还差 {breakthroughSource.gapSec}s ✦</span>
          <span>{nextTierLabel}档</span>
        </div>
      </div>

      <button
        onClick={() => onDrill(`/calc/session?drill=breakthrough&blockId=${bid}`)}
        className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold text-base active:scale-95 transition-transform"
      >
        突破练习 →
      </button>
    </div>
  )
}

// ── SVG Trend Chart ───────────────────────────────────────────────────────────

type ChartTab = 'day' | 'week' | 'month'

const CHART_W = 320
const CHART_H = 120
const CHART_PAD = { top: 16, right: 24, bottom: 24, left: 36 }

function TrendChart({ periodData }: { periodData: PeriodData }) {
  const [tab, setTab] = useState<ChartTab>('week')
  const svgRef = useRef<SVGSVGElement>(null)

  const points = periodData[tab]
  const valid = useMemo(() => points.filter((p) => p.avgSec !== null), [points])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    if (valid.length < 2) {
      while (svg.firstChild) svg.removeChild(svg.firstChild)
      return
    }

    const maxY = Math.max(...valid.map((p) => p.avgSec!))
    const minY = Math.min(...valid.map((p) => p.avgSec!))
    const rangeY = maxY - minY || 1

    const xOf = (i: number) =>
      CHART_PAD.left + (i / Math.max(points.length - 1, 1)) * (CHART_W - CHART_PAD.left - CHART_PAD.right)
    const yOf = (v: number) =>
      CHART_PAD.top + (1 - (v - minY) / rangeY) * (CHART_H - CHART_PAD.top - CHART_PAD.bottom)

    const segments: string[][] = []
    let cur: string[] = []
    for (let i = 0; i < points.length; i++) {
      if (points[i].avgSec === null) {
        if (cur.length > 0) { segments.push(cur); cur = [] }
      } else {
        cur.push(`${xOf(i).toFixed(1)},${yOf(points[i].avgSec!).toFixed(1)}`)
      }
    }
    if (cur.length > 0) segments.push(cur)

    const ns = 'http://www.w3.org/2000/svg'
    while (svg.firstChild) svg.removeChild(svg.firstChild)

    // Gridlines
    for (let k = 0; k < 3; k++) {
      const y = CHART_PAD.top + (k / 2) * (CHART_H - CHART_PAD.top - CHART_PAD.bottom)
      const line = document.createElementNS(ns, 'line')
      line.setAttribute('x1', String(CHART_PAD.left)); line.setAttribute('x2', String(CHART_W - CHART_PAD.right))
      line.setAttribute('y1', String(y)); line.setAttribute('y2', String(y))
      line.setAttribute('stroke', '#e5e7eb'); line.setAttribute('stroke-width', '1')
      svg.appendChild(line)
      const val = (maxY - (k / 2) * rangeY).toFixed(1)
      const text = document.createElementNS(ns, 'text')
      text.setAttribute('x', String(CHART_PAD.left - 4)); text.setAttribute('y', String(y + 4))
      text.setAttribute('text-anchor', 'end'); text.setAttribute('font-size', '9')
      text.setAttribute('fill', '#9ca3af'); text.textContent = val
      svg.appendChild(text)
    }

    // Polylines
    for (const seg of segments) {
      if (seg.length < 2) continue
      const poly = document.createElementNS(ns, 'polyline')
      poly.setAttribute('points', seg.join(' '))
      poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', '#3b82f6')
      poly.setAttribute('stroke-width', '2'); poly.setAttribute('stroke-linecap', 'round')
      poly.setAttribute('stroke-linejoin', 'round')
      svg.appendChild(poly)
    }

    // Dots
    for (let i = 0; i < points.length; i++) {
      if (points[i].avgSec === null) continue
      const c = document.createElementNS(ns, 'circle')
      c.setAttribute('cx', xOf(i).toFixed(1)); c.setAttribute('cy', yOf(points[i].avgSec!).toFixed(1))
      c.setAttribute('r', '3'); c.setAttribute('fill', '#3b82f6')
      svg.appendChild(c)
    }

    // Last point label
    for (let i = points.length - 1; i >= 0; i--) {
      if (points[i].avgSec === null) continue
      const text = document.createElementNS(ns, 'text')
      text.setAttribute('x', xOf(i).toFixed(1)); text.setAttribute('y', String(yOf(points[i].avgSec!) - 6))
      text.setAttribute('text-anchor', 'middle'); text.setAttribute('font-size', '10')
      text.setAttribute('fill', '#1d4ed8'); text.setAttribute('font-weight', 'bold')
      text.textContent = `${points[i].avgSec}s`
      svg.appendChild(text)
      break
    }

    // X axis labels (first, middle, last)
    const labelIdxs = [0, Math.floor(points.length / 2), points.length - 1]
    for (const li of labelIdxs) {
      const text = document.createElementNS(ns, 'text')
      text.setAttribute('x', xOf(li).toFixed(1)); text.setAttribute('y', String(CHART_H - 4))
      text.setAttribute('text-anchor', 'middle'); text.setAttribute('font-size', '9')
      text.setAttribute('fill', '#9ca3af'); text.textContent = points[li].label
      svg.appendChild(text)
    }
  }, [tab, points, valid])

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {(['day', 'week', 'month'] as ChartTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              tab === t ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {t === 'day' ? '日' : t === 'week' ? '周' : '月'}
          </button>
        ))}
      </div>
      {valid.length < 2 ? (
        <div className="h-[120px] flex items-center justify-center text-gray-400 text-sm bg-gray-50 rounded-xl">
          数据不足，多练几次就有趋势图啦
        </div>
      ) : (
        <svg ref={svgRef} viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-auto" style={{ maxHeight: 120 }} />
      )}
    </div>
  )
}

// ── Section 2 ────────────────────────────────────────────────────────────────

function aggDay(sessions: CalcSession[], dateStr: string) {
  const logs = sessions.filter((s) => s.date === dateStr).flatMap((s) => s.questionLog ?? [])
  if (logs.length === 0) return null
  const ms = logs.reduce((a, e) => a + e.ms, 0)
  return {
    count: logs.length,
    avgSec: +(ms / logs.length / 1000).toFixed(1),
    accuracy: Math.round(logs.filter((e) => e.ok).length / logs.length * 100),
  }
}

function aggWeek(sessions: CalcSession[], from: Date) {
  const to = new Date(from); to.setDate(to.getDate() + 7)
  const wSessions = sessions.filter((s) => {
    const d = new Date(s.date + 'T00:00:00')
    return d >= from && d < to
  })
  const logs = wSessions.flatMap((s) => s.questionLog ?? [])
  const days = new Set(wSessions.map((s) => s.date)).size
  if (logs.length === 0) return null
  const ms = logs.reduce((a, e) => a + e.ms, 0)
  return {
    count: logs.length,
    avgSec: +(ms / logs.length / 1000).toFixed(1),
    accuracy: Math.round(logs.filter((e) => e.ok).length / logs.length * 100),
    days,
  }
}

function Section2({
  sessions,
  periodData,
  weekStart,
}: {
  sessions: CalcSession[]
  periodData: PeriodData
  weekStart: string
}) {
  const today = todayStr()
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const yStr = `${yesterday.getFullYear()}-${padTwo(yesterday.getMonth() + 1)}-${padTwo(yesterday.getDate())}`

  const todayData = useMemo(() => aggDay(sessions, today), [sessions, today])
  const yestData = useMemo(() => aggDay(sessions, yStr), [sessions, yStr])

  const weekStartDate = useMemo(() => new Date(weekStart + 'T00:00:00'), [weekStart])
  const prevWeekStart = useMemo(() => { const d = new Date(weekStart + 'T00:00:00'); d.setDate(d.getDate() - 7); return d }, [weekStart])

  const curWeek = useMemo(() => aggWeek(sessions, weekStartDate), [sessions, weekStartDate])
  const prevWeek = useMemo(() => aggWeek(sessions, prevWeekStart), [sessions, prevWeekStart])

  const dotDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + 'T00:00:00'); d.setDate(d.getDate() + i)
    const dateStr = `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}`
    return { dateStr, practiced: sessions.some((s) => s.date === dateStr), future: dateStr > today, day: d.getDate() }
  }), [weekStart, sessions, today])

  return (
    <div className="rounded-2xl border border-gray-200 p-5 space-y-5">
      <h2 className="font-bold text-gray-800 text-base">整体成长</h2>

      {todayData && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 rounded-xl p-3">
            <div className="text-xs text-blue-500 font-medium mb-1">今天</div>
            <div className="text-2xl font-bold text-blue-700">{todayData.avgSec}s</div>
            <div className="text-xs text-blue-400">{todayData.count}题 · {todayData.accuracy}%</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs text-gray-400 font-medium mb-1">昨天</div>
            <div className="text-2xl font-bold text-gray-400">{yestData?.avgSec ?? '-'}s</div>
            <div className="text-xs text-gray-300">{yestData ? `${yestData.count}题 · ${yestData.accuracy}%` : '无记录'}</div>
          </div>
        </div>
      )}

      <TrendChart periodData={periodData} />

      <div className="grid grid-cols-2 gap-3">
        {([
          { label: '题数', cur: curWeek?.count, prev: prevWeek?.count, unit: '题', invert: false },
          { label: '正确率', cur: curWeek?.accuracy, prev: prevWeek?.accuracy, unit: '%', invert: false },
          { label: '速度', cur: curWeek?.avgSec, prev: prevWeek?.avgSec, unit: 's', invert: true },
          { label: '练习天', cur: curWeek?.days, prev: prevWeek?.days, unit: '天', invert: false },
        ] as const).map(({ label, cur, prev, unit, invert }) => (
          <div key={label} className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs text-gray-400 mb-1">{label}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-gray-800">{cur ?? '-'}{unit}</span>
              <DeltaChip
                d={cur != null && prev != null ? +(cur - prev).toFixed(1) : null}
                unit={unit}
                invert={invert}
              />
            </div>
            <div className="text-xs text-gray-300">上周 {prev ?? '-'}{unit}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {dotDays.map(({ dateStr, practiced, future, day }) => (
            <div
              key={dateStr}
              className={`w-7 h-7 rounded-md text-xs flex items-center justify-center font-medium ${
                practiced ? 'bg-blue-500 text-white'
                : future ? 'border border-dashed border-gray-200 text-gray-200'
                : 'border border-dashed border-gray-300 text-gray-300'
              }`}
            >
              {day}
            </div>
          ))}
        </div>
        <span className="text-xs text-gray-400">{dotDays.filter((d) => d.practiced).length}/7天</span>
      </div>
    </div>
  )
}

// ── Section 3 ────────────────────────────────────────────────────────────────

function Section3({
  groupStats,
  stats,
}: {
  groupStats: OpGroupStat[]
  stats: SourceStat[]
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const hasData = groupStats.some((g) => !g.insufficient)
  if (!hasData) return null

  const maxAvg = Math.max(...groupStats.map((g) => g.avgSec), 0.1)

  const toggle = (op: string) => setExpanded((prev) => {
    const next = new Set(prev)
    if (next.has(op)) { next.delete(op) } else { next.add(op) }
    return next
  })

  const withDelta = stats.filter((s) => s.deltaSec !== null && !s.insufficient)
  const improved = [...withDelta].sort((a, b) => (b.deltaSec ?? 0) - (a.deltaSec ?? 0)).slice(0, 3).filter((s) => (s.deltaSec ?? 0) > 0)
  const regressed = [...withDelta].sort((a, b) => (a.deltaSec ?? 0) - (b.deltaSec ?? 0)).slice(0, 3).filter((s) => (s.deltaSec ?? 0) < 0)

  return (
    <div className="rounded-2xl border border-gray-200 p-5 space-y-4">
      <h2 className="font-bold text-gray-800 text-base">题型进展</h2>
      <div className="space-y-3">
        {groupStats.map((g) => (
          <div key={g.op}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-gray-700 w-8">{g.label}法</span>
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.round((g.avgSec / maxAvg) * 100)}%`,
                    background: g.tier === 'entry' ? '#ef4444' : g.tier === 'stable' ? '#eab308' : g.tier === 'fluent' ? '#22c55e' : '#06b6d4',
                  }}
                />
              </div>
              <span className="text-sm text-gray-500 w-12 text-right">{g.avgSec}s</span>
              {g.tier && <span className={`text-xs px-2 py-0.5 rounded-full ${TIER_BADGE_BG[g.tier]}`}>{TIER_LABEL[g.tier]}</span>}
              <button onClick={() => toggle(g.op)} className="text-xs text-gray-400 w-4">{expanded.has(g.op) ? '▲' : '▾'}</button>
            </div>
            {expanded.has(g.op) && (
              <div className="ml-8 mt-1 space-y-1">
                {g.blocks.map((b) => (
                  <div key={b.key} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-32 truncate">{b.label}</span>
                    <span>{b.avgSec}s</span>
                    {b.tier && <span className={`px-1.5 py-0.5 rounded text-xs ${TIER_BADGE_BG[b.tier]}`}>{TIER_LABEL[b.tier]}</span>}
                    {b.deltaSec !== null && (
                      <span className={b.deltaSec > 0 ? 'text-green-600' : 'text-red-500'}>
                        {b.deltaSec > 0 ? '↑' : '↓'}{Math.abs(b.deltaSec)}s
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {(improved.length > 0 || regressed.length > 0) && (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
          <div>
            <div className="text-xs text-green-600 font-medium mb-1">进步最快</div>
            {improved.map((s) => (
              <div key={s.key} className="text-xs text-gray-600 flex gap-1 items-center">
                <span className="text-green-500">↑{s.deltaSec}s</span>
                <span className="truncate">{s.label}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs text-red-500 font-medium mb-1">需要关注</div>
            {regressed.map((s) => (
              <div key={s.key} className="text-xs text-gray-600 flex gap-1 items-center">
                <span className="text-red-400">↓{Math.abs(s.deltaSec ?? 0)}s</span>
                <span className="truncate">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section 4 ────────────────────────────────────────────────────────────────

function Section4({
  weakStates,
  recentMastered,
  onDrill,
}: {
  weakStates: CalcProblemState[]
  recentMastered: CalcProblemState[]
  onDrill: () => void
}) {
  return (
    <div className="rounded-2xl border border-gray-200 p-5 space-y-4">
      <h2 className="font-bold text-gray-800 text-base">薄弱算式</h2>
      {weakStates.length === 0 && recentMastered.length === 0 ? (
        <p className="text-green-600 text-sm">太棒了，暂时没有薄弱算式！继续保持 🎉</p>
      ) : (
        <>
          {weakStates.length > 0 && (
            <p className="text-gray-500 text-sm">这些算式出错率高，多练几次就熟了～</p>
          )}
          <div className="flex flex-wrap gap-2">
            {weakStates.map((s) => (
              <span key={s.signature} className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-mono">
                {s.signature}
              </span>
            ))}
            {recentMastered.map((s) => (
              <span key={s.signature} className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-mono">
                ✓ {s.signature}
              </span>
            ))}
          </div>
          {weakStates.length > 0 && (
            <button
              onClick={onDrill}
              className="w-full py-3 rounded-xl bg-blue-500 text-white font-bold active:scale-95 transition-transform"
            >
              针对练习
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── Section 5 ────────────────────────────────────────────────────────────────

function Section5({
  mistakeStats,
}: {
  mistakeStats: { netResolved: number; totalResolved: number; total: number; topTags: string[] }
}) {
  const { netResolved, totalResolved, total, topTags } = mistakeStats
  const rate = total > 0 ? Math.round((totalResolved / total) * 100) : 0

  const verdict = netResolved > 0
    ? { cls: 'text-green-700 bg-green-50', icon: '✓', text: `错题复习在生效，本周净解决 ${netResolved} 个` }
    : netResolved === 0
    ? { cls: 'text-blue-700 bg-blue-50', icon: '→', text: '本周错题持平，继续保持' }
    : { cls: 'text-yellow-700 bg-yellow-50', icon: '!', text: '本周错题有增加，多练补题' }

  return (
    <div className="rounded-2xl border border-gray-200 p-5 space-y-4">
      <h2 className="font-bold text-gray-800 text-base">错题追踪</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-xs text-gray-400 mb-1">本周净解决</div>
          <div className={`text-2xl font-bold ${netResolved > 0 ? 'text-green-600' : netResolved < 0 ? 'text-red-500' : 'text-gray-700'}`}>
            {netResolved > 0 ? `+${netResolved}` : netResolved}
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-xs text-gray-400 mb-1">累计已解决</div>
          <div className="text-2xl font-bold text-gray-700">{totalResolved}/{total}</div>
        </div>
      </div>
      {total > 0 && (
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1"><span>解决率</span><span>{rate}%</span></div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all" style={{ width: `${rate}%` }} />
          </div>
        </div>
      )}
      {topTags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {topTags.map((tag) => <span key={tag} className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs">{tag}</span>)}
        </div>
      )}
      <div className={`rounded-xl px-4 py-3 text-sm font-medium ${verdict.cls}`}>{verdict.icon} {verdict.text}</div>
    </div>
  )
}

// ── Section 6 ────────────────────────────────────────────────────────────────

function Section6({ sessions }: { sessions: CalcSession[] }) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="rounded-2xl border border-gray-200 p-5 space-y-3">
      <button onClick={() => setCollapsed((c) => !c)} className="flex items-center justify-between w-full">
        <h2 className="font-bold text-gray-800 text-base">最近练习</h2>
        <span className="text-gray-400 text-sm">{collapsed ? '▾' : '▲'}</span>
      </button>
      {!collapsed && (
        <>
          {sessions.length === 0 && <p className="text-gray-400 text-sm text-center py-4">还没有练习记录</p>}
          <div className="space-y-2">
            {sessions.slice(0, 10).map((s, i) => {
              const logs = s.questionLog ?? []
              const ms = logs.reduce((a, e) => a + e.ms, 0)
              const avgSec = logs.length > 0 ? +(ms / logs.length / 1000).toFixed(1) : 0
              const accuracy = logs.length > 0 ? Math.round(logs.filter((e) => e.ok).length / logs.length * 100) : 0
              return (
                <button
                  key={i}
                  onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
                  className={`w-full text-left rounded-xl p-3 border transition-colors ${selectedIdx === i ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}
                >
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{s.date}</span>
                    <span className="text-gray-800 font-medium">{avgSec}s/题 · {accuracy}%</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{logs.length}题</div>
                  {selectedIdx === i && logs.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <div className="flex flex-wrap gap-1">
                        {logs.slice(0, 20).map((e, j) => (
                          <span key={j} className={`px-1.5 py-0.5 rounded text-xs ${e.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {e.key.split(':').pop()}
                          </span>
                        ))}
                        {logs.length > 20 && <span className="text-xs text-gray-400">+{logs.length - 20}</span>}
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CalcReportPage() {
  const router = useRouter()
  const { user } = useAuth()
  const wallet = useCalcWallet(user)
  const { settings } = useCalcSettings(user)
  const problemState = useCalcProblemState(user)

  const [problemStates, setProblemStates] = useState<Map<string, CalcProblemState>>(new Map())
  const [mistakeRows, setMistakeRows] = useState<MistakeRow[]>([])

  useEffect(() => {
    if (!user) return
    void problemState.loadAll().then(setProblemStates)
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return
    void supabase
      .from('calc_mistakes')
      .select('error_tag, resolved, created_at')
      .eq('user_id', user.id)
      .not('error_tag', 'is', null)
      .then(({ data }) => { if (data) setMistakeRows(data as MistakeRow[]) })
  }, [user])

  const mixedLabels = useMemo(() => {
    const m = new Map<string, string>()
    for (const op of settings.mixedOps) {
      if (op.label) {
        m.set(op.id, op.label)
      } else {
        try {
          const meta = skeletonMeta(op.skeleton)
          m.set(op.id, meta?.label ?? op.id)
        } catch {
          m.set(op.id, op.id)
        }
      }
    }
    return m
  }, [settings.mixedOps])

  const mixedSkeletons = useMemo(() => {
    const m = new Map<string, string>()
    for (const op of settings.mixedOps) { m.set(op.id, op.skeleton) }
    return m
  }, [settings.mixedOps])

  const stats = useMemo(
    () => sourceStats(wallet.sessions, mixedLabels, mixedSkeletons),
    [wallet.sessions, mixedLabels, mixedSkeletons],
  )

  const periodData = useMemo(() => weeklyAggregates(wallet.sessions), [wallet.sessions])
  const groupStats = useMemo(() => opGroupStats(stats), [stats])
  const weekStart = useMemo(() => thursdayWeekStart(new Date()), [])

  const weakStates = useMemo(
    () => [...problemStates.values()].filter((s) => s.proficiency <= 2 && s.attemptCount >= 3),
    [problemStates],
  )

  const recentMastered = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7)
    return [...problemStates.values()].filter(
      (s) => s.status === 'mastered' && s.updatedAt && new Date(s.updatedAt) >= cutoff,
    )
  }, [problemStates])

  const mistakeStats = useMemo(() => {
    const weekCutoff = new Date(weekStart + 'T00:00:00')
    const thisWeekResolved = mistakeRows.filter((r) => r.resolved && new Date(r.created_at) >= weekCutoff).length
    const thisWeekNew = mistakeRows.filter((r) => !r.resolved && new Date(r.created_at) >= weekCutoff).length
    const netResolved = thisWeekResolved - thisWeekNew
    const totalResolved = mistakeRows.filter((r) => r.resolved).length
    const total = mistakeRows.length
    const tagCounts = new Map<string, number>()
    for (const r of mistakeRows) {
      if (!r.error_tag) continue
      tagCounts.set(r.error_tag, (tagCounts.get(r.error_tag) ?? 0) + 1)
    }
    const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([tag]) => tag)
    return { netResolved, totalResolved, total, topTags }
  }, [mistakeRows, weekStart])

  const breakthroughSource = useMemo(
    () => stats.filter((s) => !s.insufficient && s.tier !== 'auto' && s.gapSec > 0).sort((a, b) => a.gapSec - b.gapSec)[0] ?? null,
    [stats],
  )

  const slowestGroup = useMemo(() => groupStats[0] ?? null, [groupStats])

  const handleDrill = useCallback((url: string) => router.push(url), [router])

  if (wallet.isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <span className="text-gray-400 text-sm">加载中…</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CalcAppHeader
        balance={wallet.balance}
        soundEnabled={settings.soundEnabled}
        onToggleSound={() => {}}
        title="成长报告"
        backHref="/calc"
        backLabel="口算"
      />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-12">
        <Section1
          breakthroughSource={breakthroughSource}
          slowestGroup={slowestGroup}
          onDrill={handleDrill}
        />
        <Section2 sessions={wallet.sessions} periodData={periodData} weekStart={weekStart} />
        <Section3 groupStats={groupStats} stats={stats} />
        <Section4
          weakStates={weakStates}
          recentMastered={recentMastered}
          onDrill={() => router.push('/calc/session?drill=weak-formulas')}
        />
        <Section5 mistakeStats={mistakeStats} />
        <Section6 sessions={wallet.sessions} />
      </div>
    </div>
  )
}
