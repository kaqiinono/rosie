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
import { TIER_LABEL, TIER_ORDER, suggestedTiers, type Tier } from '@/utils/calc-time-targets'
import type { CalcProblemState, CalcSession } from '@/utils/type'
import { todayStr } from '@/utils/constant'

// ── CSS animations ─────────────────────────────────────────────────────────────

const ANIMATIONS = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes drawLine { to { stroke-dashoffset: 0; } }
`

// ── design tokens ──────────────────────────────────────────────────────────────

const C = {
  violet: '#c4b5fd',
  violetGlass: 'rgba(196,181,253,0.08)',
  violetBorder: 'rgba(196,181,253,0.2)',
  blue: '#7dd3fc',
  blueGlass: 'rgba(125,211,252,0.07)',
  blueBorder: 'rgba(125,211,252,0.2)',
  yellow: '#fbbf24',
  yellowGlass: 'rgba(251,191,36,0.06)',
  yellowBorder: 'rgba(251,191,36,0.22)',
  green: '#4ade80',
  red: '#f87171',
  text: 'rgba(245,243,255,0.92)',
  textDim: 'rgba(245,243,255,0.45)',
  textFaint: 'rgba(245,243,255,0.2)',
  surface: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.09)',
} as const

const baseCard: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: 18,
}

const SH: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'rgba(196,181,253,0.38)',
  marginBottom: 8,
}

// ── helpers ────────────────────────────────────────────────────────────────────

function padTwo(n: number) { return String(n).padStart(2, '0') }

function thursdayWeekStart(date: Date): string {
  const d = new Date(date)
  d.setDate(d.getDate() - (d.getDay() - 4 + 7) % 7)
  return `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}`
}

interface MistakeRow { error_tag: string | null; resolved: boolean; created_at: string }

// ── Section 1 · 推荐练习 ───────────────────────────────────────────────────────

function Section1({ breakthroughSource, slowestGroup, onDrill }: {
  breakthroughSource: SourceStat | null
  slowestGroup: OpGroupStat | null
  onDrill: (url: string) => void
}) {
  const cardStyle: React.CSSProperties = {
    background: C.yellowGlass,
    border: `1px solid ${C.yellowBorder}`,
    borderRadius: 16,
    padding: 18,
    position: 'relative',
    overflow: 'hidden',
  }

  if (!breakthroughSource || !slowestGroup || slowestGroup.insufficient) {
    return (
      <div>
        <span style={SH}>推荐练习</span>
        <div style={cardStyle}>
          <div style={{ color: C.yellow, fontSize: 13, opacity: 0.7 }}>还没有足够数据，先去练几次吧～</div>
        </div>
      </div>
    )
  }

  const curIdx = breakthroughSource.tier ? TIER_ORDER.indexOf(breakthroughSource.tier) : 0
  const nextTier = TIER_ORDER[curIdx + 1] as Tier | undefined
  const nextTierLabel = nextTier ? TIER_LABEL[nextTier] : TIER_LABEL.auto
  const bid = breakthroughSource.key.split(':')[1] ?? ''

  return (
    <div>
      <span style={SH}>推荐练习</span>
      <div style={cardStyle}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 100% at 0% 50%,rgba(251,191,36,0.09) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.yellow, marginBottom: 8 }}>
          🎯 本周重点
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.65, color: 'rgba(245,243,255,0.85)', marginBottom: 14 }}>
          <span style={{ color: C.yellow, fontWeight: 700 }}>{slowestGroup.label}法</span>是当前最慢（{slowestGroup.avgSec}s/题
          {slowestGroup.tier ? `，${TIER_LABEL[slowestGroup.tier]}档` : ''}）。{' '}
          <span style={{ color: C.yellow, fontWeight: 700 }}>{breakthroughSource.label}</span>再快{' '}
          <span style={{ color: C.yellow, fontWeight: 700 }}>{breakthroughSource.gapSec}s</span> 就升到{nextTierLabel}档了！
        </div>
        <button
          onClick={() => onDrill(`/calc/session?drill=breakthrough&blockId=${bid}`)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: C.yellow, background: 'rgba(251,191,36,0.12)', border: `1px solid rgba(251,191,36,0.28)`, borderRadius: 20, padding: '6px 16px', cursor: 'pointer' }}
        >
          去练习 →
        </button>
      </div>
    </div>
  )
}

// ── TrendChart · dark SVG with draw animation ──────────────────────────────────

type ChartTab = 'day' | 'week' | 'month'
const CW = 320, CH = 108, CP = { top: 10, r: 8, bot: 22, l: 8 }

function TrendChart({ periodData }: { periodData: PeriodData }) {
  const [tab, setTab] = useState<ChartTab>('week')
  const svgRef = useRef<SVGSVGElement>(null)
  const points = periodData[tab]
  const valid = useMemo(() => points.filter(p => p.avgSec !== null), [points])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    while (svg.firstChild) svg.removeChild(svg.firstChild)
    if (valid.length < 2) return

    const vals = valid.map(p => p.avgSec!)
    const mn = Math.min(...vals) * 0.92, mx = Math.max(...vals) * 1.08
    const iW = CW - CP.l - CP.r, iH = CH - CP.top - CP.bot
    const xOf = (i: number) => CP.l + (i / Math.max(points.length - 1, 1)) * iW
    const yOf = (v: number) => CP.top + (1 - (v - mn) / (mx - mn)) * iH

    let line = '', area = '', inSeg = false
    for (let i = 0; i < points.length; i++) {
      const v = points[i].avgSec
      const x = xOf(i).toFixed(1)
      if (v !== null) {
        const y = yOf(v).toFixed(1)
        if (!inSeg) { line += `M${x} ${y} `; area += `M${x} ${(CH - CP.bot).toFixed(1)} L${x} ${y} `; inSeg = true }
        else { line += `L${x} ${y} `; area += `L${x} ${y} ` }
      } else if (inSeg) {
        const pv = points[i - 1].avgSec
        if (pv !== null) area += `L${xOf(i - 1).toFixed(1)} ${(CH - CP.bot).toFixed(1)} Z `
        inSeg = false
      }
    }
    if (inSeg) {
      const pv = points[points.length - 1].avgSec
      if (pv !== null) area += `L${xOf(points.length - 1).toFixed(1)} ${(CH - CP.bot).toFixed(1)} Z`
    }

    const ns = 'http://www.w3.org/2000/svg'
    const gid = `g${tab}`

    const defs = document.createElementNS(ns, 'defs')
    const grad = document.createElementNS(ns, 'linearGradient')
    grad.setAttribute('id', gid); grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0'); grad.setAttribute('x2', '0'); grad.setAttribute('y2', '1')
    ;[['0%', 'rgba(196,181,253,0.25)'], ['100%', 'rgba(196,181,253,0)']].forEach(([off, col]) => {
      const s = document.createElementNS(ns, 'stop'); s.setAttribute('offset', off); s.setAttribute('stop-color', col); grad.appendChild(s)
    })
    defs.appendChild(grad); svg.appendChild(defs)

    const aPath = document.createElementNS(ns, 'path')
    aPath.setAttribute('d', area); aPath.setAttribute('fill', `url(#${gid})`); svg.appendChild(aPath)

    for (let k = 0; k < 3; k++) {
      const y = (CP.top + (k / 2) * iH).toFixed(1)
      const gl = document.createElementNS(ns, 'line')
      gl.setAttribute('x1', String(CP.l)); gl.setAttribute('x2', String(CW - CP.r))
      gl.setAttribute('y1', y); gl.setAttribute('y2', y)
      gl.setAttribute('stroke', 'rgba(255,255,255,0.045)'); gl.setAttribute('stroke-width', '1')
      svg.appendChild(gl)
    }

    const dash = String(line.length * 6)
    const lPath = document.createElementNS(ns, 'path')
    lPath.setAttribute('d', line); lPath.setAttribute('fill', 'none'); lPath.setAttribute('stroke', C.violet)
    lPath.setAttribute('stroke-width', '2.2'); lPath.setAttribute('stroke-linecap', 'round'); lPath.setAttribute('stroke-linejoin', 'round')
    lPath.setAttribute('style', `stroke-dasharray:${dash};stroke-dashoffset:${dash};animation:drawLine 0.9s ease forwards;filter:drop-shadow(0 0 4px rgba(196,181,253,0.4))`)
    svg.appendChild(lPath)

    for (let i = 0; i < points.length; i++) {
      const v = points[i].avgSec
      if (v === null) continue
      const isLast = !points.slice(i + 1).some(p => p.avgSec !== null)
      const c = document.createElementNS(ns, 'circle')
      c.setAttribute('cx', xOf(i).toFixed(1)); c.setAttribute('cy', yOf(v).toFixed(1))
      c.setAttribute('r', isLast ? '4.5' : '2.5')
      c.setAttribute('fill', isLast ? C.violet : 'rgba(196,181,253,0.55)')
      if (isLast) { c.setAttribute('stroke', 'rgba(196,181,253,0.25)'); c.setAttribute('stroke-width', '5') }
      svg.appendChild(c)
    }

    for (let i = points.length - 1; i >= 0; i--) {
      const v = points[i].avgSec
      if (v === null) continue
      const lx = xOf(i), ly = yOf(v)
      const rect = document.createElementNS(ns, 'rect')
      rect.setAttribute('x', (lx + 7).toFixed(1)); rect.setAttribute('y', (ly - 8).toFixed(1))
      rect.setAttribute('width', '26'); rect.setAttribute('height', '14'); rect.setAttribute('rx', '4')
      rect.setAttribute('fill', 'rgba(196,181,253,0.15)'); rect.setAttribute('stroke', 'rgba(196,181,253,0.3)'); rect.setAttribute('stroke-width', '1')
      svg.appendChild(rect)
      const lt = document.createElementNS(ns, 'text')
      lt.setAttribute('x', (lx + 20).toFixed(1)); lt.setAttribute('y', (ly + 3.5).toFixed(1))
      lt.setAttribute('text-anchor', 'middle'); lt.setAttribute('font-size', '9'); lt.setAttribute('font-weight', '700')
      lt.setAttribute('fill', C.violet); lt.textContent = `${v}s`
      svg.appendChild(lt)
      break
    }

    const li = [0, Math.floor((points.length - 1) / 2), points.length - 1]
    for (const idx of li) {
      const t = document.createElementNS(ns, 'text')
      t.setAttribute('x', xOf(idx).toFixed(1)); t.setAttribute('y', String(CH - 5))
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '8'); t.setAttribute('fill', C.textFaint)
      t.textContent = points[idx].label; svg.appendChild(t)
    }
  }, [tab, points, valid])

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {(['day', 'week', 'month'] as ChartTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.14s', background: tab === t ? 'rgba(196,181,253,0.12)' : 'transparent', border: `1px solid ${tab === t ? 'rgba(196,181,253,0.28)' : 'transparent'}`, color: tab === t ? C.violet : C.textDim }}>
            {t === 'day' ? '日' : t === 'week' ? '周' : '月'}
          </button>
        ))}
      </div>
      {valid.length < 2
        ? <div style={{ height: 108, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textFaint, fontSize: 12 }}>数据不足，多练几次就有趋势图啦</div>
        : <svg ref={svgRef} viewBox={`0 0 ${CW} ${CH}`} style={{ width: '100%', maxHeight: 108, display: 'block' }} />
      }
    </div>
  )
}

// ── Section 2 · 整体成长 ───────────────────────────────────────────────────────

function aggDay(sessions: CalcSession[], dateStr: string) {
  const logs = sessions.filter(s => s.date === dateStr).flatMap(s => s.questionLog ?? [])
  if (!logs.length) return null
  const ms = logs.reduce((a, e) => a + e.ms, 0)
  return { count: logs.length, avgSec: +(ms / logs.length / 1000).toFixed(1), accuracy: Math.round(logs.filter(e => e.ok).length / logs.length * 100) }
}

function aggWeek(sessions: CalcSession[], from: Date) {
  const to = new Date(from); to.setDate(to.getDate() + 7)
  const ws = sessions.filter(s => { const d = new Date(s.date + 'T00:00:00'); return d >= from && d < to })
  const logs = ws.flatMap(s => s.questionLog ?? [])
  if (!logs.length) return null
  const ms = logs.reduce((a, e) => a + e.ms, 0)
  return { count: logs.length, avgSec: +(ms / logs.length / 1000).toFixed(1), accuracy: Math.round(logs.filter(e => e.ok).length / logs.length * 100), days: new Set(ws.map(s => s.date)).size }
}

const DOT_LABELS = ['四', '五', '六', '日', '一', '二', '三']

function Section2({ sessions, periodData, weekStart }: { sessions: CalcSession[]; periodData: PeriodData; weekStart: string }) {
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
    const ds = `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}`
    return { ds, practiced: sessions.some(s => s.date === ds), future: ds > today }
  }), [weekStart, sessions, today])

  const todaySpeedDelta = todayData && yestData ? +(yestData.avgSec - todayData.avgSec).toFixed(1) : null

  return (
    <div>
      <span style={SH}>整体成长</span>
      <div style={baseCard}>
        {todayData && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            <div style={{ background: 'rgba(196,181,253,0.05)', border: '1px solid rgba(196,181,253,0.18)', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(196,181,253,0.6)', marginBottom: 4 }}>今天</div>
              <div style={{ fontSize: 23, fontWeight: 700, color: C.violet, lineHeight: 1 }}>
                {todayData.avgSec}<span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(196,181,253,0.4)' }}> s/题</span>
              </div>
              <div style={{ fontSize: 11, color: C.textDim, marginTop: 3 }}>
                {todayData.count}题 · {todayData.accuracy}%
                {todaySpeedDelta !== null && todaySpeedDelta !== 0 && (
                  <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 700, color: todaySpeedDelta > 0 ? C.green : C.red, background: todaySpeedDelta > 0 ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)', borderRadius: 5, padding: '1px 5px' }}>
                    {todaySpeedDelta > 0 ? `↑快${todaySpeedDelta}s` : `↓慢${Math.abs(todaySpeedDelta)}s`}
                  </span>
                )}
              </div>
            </div>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, marginBottom: 4 }}>昨天</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'rgba(245,243,255,0.35)', lineHeight: 1 }}>
                {yestData?.avgSec ?? '-'}<span style={{ fontSize: 12, color: 'rgba(245,243,255,0.2)' }}> s/题</span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(245,243,255,0.28)', marginTop: 3 }}>
                {yestData ? `${yestData.count}题 · ${yestData.accuracy}%` : '无记录'}
              </div>
            </div>
          </div>
        )}

        <TrendChart periodData={periodData} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginTop: 14 }}>
          {([
            { label: '题数', cur: curWeek?.count, prev: prevWeek?.count, unit: '题', invert: false },
            { label: '正确率', cur: curWeek?.accuracy, prev: prevWeek?.accuracy, unit: '%', invert: false },
            { label: '速度', cur: curWeek?.avgSec, prev: prevWeek?.avgSec, unit: 's', invert: true },
            { label: '练习天', cur: curWeek?.days, prev: prevWeek?.days, unit: '天', invert: false },
          ] as const).map(({ label, cur, prev, unit, invert }) => {
            const d = cur != null && prev != null ? +(cur - prev).toFixed(1) : null
            const pos = d !== null ? (invert ? d < 0 : d > 0) : null
            return (
              <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: C.textDim, marginBottom: 3, letterSpacing: '0.04em' }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1 }}>{cur ?? '-'}{unit}</div>
                {d !== null && pos !== null && (
                  <div style={{ fontSize: 9, fontWeight: 600, marginTop: 2, color: pos ? C.green : C.red }}>
                    {pos ? '↑' : '↓'}{Math.abs(d)}{unit}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <span style={{ fontSize: 11, color: C.textDim, whiteSpace: 'nowrap' }}>本周</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {dotDays.map(({ ds, practiced, future }, i) => (
              <div key={ds} style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, background: practiced ? 'rgba(196,181,253,0.18)' : 'transparent', border: practiced ? '1px solid rgba(196,181,253,0.35)' : future ? '1px dashed rgba(255,255,255,0.1)' : '1px dashed rgba(255,255,255,0.18)', color: practiced ? C.violet : C.textFaint }}>
                {DOT_LABELS[i]}
              </div>
            ))}
          </div>
          <span style={{ fontSize: 11, color: 'rgba(245,243,255,0.3)' }}>{dotDays.filter(d => d.practiced).length}/7天</span>
        </div>
      </div>
    </div>
  )
}

// ── Section 3 · 题型进展 ───────────────────────────────────────────────────────

const TIER_DARK: Record<Tier, { color: string; bg: string; border: string }> = {
  entry:  { color: '#f87171', bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.18)' },
  stable: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.18)'  },
  fluent: { color: '#4ade80', bg: 'rgba(74,222,128,0.1)',   border: 'rgba(74,222,128,0.18)'  },
  auto:   { color: '#22d3ee', bg: 'rgba(34,211,238,0.1)',   border: 'rgba(34,211,238,0.18)'  },
}

const BAR_COLOR: Record<Tier, string> = {
  entry: 'rgba(248,113,113,0.7)',
  stable: 'rgba(251,191,36,0.55)',
  fluent: 'rgba(74,222,128,0.55)',
  auto: 'rgba(34,211,238,0.55)',
}

function TierBadge({ tier, small = false }: { tier: Tier; small?: boolean }) {
  const t = TIER_DARK[tier]
  return (
    <span style={{ fontSize: small ? 8 : 9, fontWeight: 800, borderRadius: 6, padding: small ? '1px 5px' : '2px 6px', textAlign: 'center', color: t.color, background: t.bg, border: `1px solid ${t.border}`, whiteSpace: 'nowrap' }}>
      {TIER_LABEL[tier]}
    </span>
  )
}

function Section3({ groupStats, stats }: { groupStats: OpGroupStat[]; stats: SourceStat[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  if (!groupStats.some(g => !g.insufficient)) return null

  const maxAvg = Math.max(...groupStats.map(g => g.avgSec), 0.1)
  const toggle = (op: string) => setExpanded(prev => {
    const n = new Set(prev); if (n.has(op)) n.delete(op); else n.add(op); return n
  })

  const withDelta = stats.filter(s => s.deltaSec !== null && !s.insufficient)
  const improved = [...withDelta].sort((a, b) => (b.deltaSec ?? 0) - (a.deltaSec ?? 0)).slice(0, 3).filter(s => (s.deltaSec ?? 0) > 0)
  const regressed = [...withDelta].sort((a, b) => (a.deltaSec ?? 0) - (b.deltaSec ?? 0)).slice(0, 3).filter(s => (s.deltaSec ?? 0) < 0)

  return (
    <div>
      <span style={SH}>题型进展</span>
      <div style={baseCard}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {groupStats.map(g => (
            <div key={g.op}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 11, padding: '9px 11px', background: C.surface, border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text, minWidth: 28 }}>{g.label}法</span>
                <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round((g.avgSec / maxAvg) * 100)}%`, height: '100%', background: g.tier ? BAR_COLOR[g.tier] : 'rgba(255,255,255,0.2)', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.textDim, minWidth: 34, textAlign: 'right' }}>{g.avgSec}s</span>
                {g.tier && <TierBadge tier={g.tier} />}
                <button onClick={() => toggle(g.op)} style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 7, color: expanded.has(g.op) ? 'rgba(196,181,253,0.7)' : 'rgba(196,181,253,0.4)', background: expanded.has(g.op) ? 'rgba(196,181,253,0.14)' : 'rgba(196,181,253,0.06)', border: '1px solid rgba(196,181,253,0.12)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {expanded.has(g.op) ? '▴' : '▾'} 详情
                </button>
              </div>
              {expanded.has(g.op) && (
                <div style={{ marginTop: 2 }}>
                  {g.blocks.map(b => (
                    <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px 6px 18px', borderRadius: 8, marginTop: 3, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', fontSize: 11 }}>
                      <span style={{ flex: 1, color: 'rgba(196,181,253,0.72)', fontWeight: 500 }}>{b.label}</span>
                      <span style={{ color: C.textFaint, fontSize: 10 }}>{b.avgSec}s</span>
                      {b.tier && <TierBadge tier={b.tier} small />}
                      {b.deltaSec !== null && (
                        <span style={{ color: b.deltaSec > 0 ? C.green : C.red, fontSize: 10, fontWeight: 700 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
            {[
              { items: improved, label: '📈 进步最快', color: C.green, bg: 'rgba(74,222,128,0.06)', border: 'rgba(74,222,128,0.12)', sign: '↑' },
              { items: regressed, label: '📉 需关注', color: C.red, bg: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.12)', sign: '↓' },
            ].map(({ items, label, color, bg, border, sign }) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color, marginBottom: 6 }}>{label}</div>
                {items.map(s => (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, padding: '5px 8px', borderRadius: 8, marginBottom: 4, background: bg, border: `1px solid ${border}` }}>
                    <span style={{ color: C.text, fontWeight: 500 }}>{s.label}</span>
                    <span style={{ color, fontWeight: 700, fontSize: 10 }}>{sign}{Math.abs(s.deltaSec ?? 0)}s</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section 4 · 薄弱算式 ───────────────────────────────────────────────────────

function Section4({ weakStates, recentMastered, onDrill }: { weakStates: CalcProblemState[]; recentMastered: CalcProblemState[]; onDrill: () => void }) {
  return (
    <div>
      <span style={SH}>薄弱算式</span>
      <div style={baseCard}>
        {weakStates.length === 0 && recentMastered.length === 0 ? (
          <p style={{ color: C.green, fontSize: 13 }}>太棒了，暂时没有薄弱算式！继续保持 🎉</p>
        ) : (
          <>
            {weakStates.length > 0 && <div style={{ fontSize: 11, color: C.textDim, marginBottom: 10 }}>这些算式出错率高，多练几次就熟了～</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {weakStates.map(s => (
                <span key={s.signature} style={{ fontSize: 14, fontWeight: 600, padding: '5px 12px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.22)', color: 'rgba(248,113,113,0.9)', fontFamily: 'monospace' }}>
                  {s.signature}
                </span>
              ))}
              {recentMastered.map(s => (
                <span key={s.signature} style={{ fontSize: 14, fontWeight: 600, padding: '5px 12px', borderRadius: 10, background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.18)', color: 'rgba(74,222,128,0.65)', fontFamily: 'monospace' }}>
                  ✓ {s.signature}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 10, color: C.textDim, marginTop: 6 }}>红色 = 还需多练 · 绿色 = 最近已掌握</div>
            {weakStates.length > 0 && (
              <button onClick={onDrill} style={{ marginTop: 12, width: '100%', padding: '11px 0', borderRadius: 14, background: C.violetGlass, border: `1px solid ${C.violetBorder}`, color: C.violet, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                针对练习 →
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Section Breakthrough · 下一个突破口 ───────────────────────────────────────

function SectionBreakthrough({ breakthroughSource }: { breakthroughSource: SourceStat | null }) {
  if (!breakthroughSource || breakthroughSource.gapSec <= 0 || !breakthroughSource.tier) return null

  const curIdx = TIER_ORDER.indexOf(breakthroughSource.tier)
  const nextTier = TIER_ORDER[curIdx + 1] as Tier | undefined
  if (!nextTier) return null

  const targets = suggestedTiers(breakthroughSource.targetId)
  const currentTierHi = targets ? targets[breakthroughSource.tier][1] : breakthroughSource.avgSec + 2
  const nextTierHi = targets ? targets[nextTier][1] : +(breakthroughSource.avgSec - breakthroughSource.gapSec).toFixed(1)
  const range = currentTierHi - nextTierHi
  const fill = Math.max(0.05, Math.min(0.95, range > 0 ? (currentTierHi - breakthroughSource.avgSec) / range : 0.5))

  return (
    <div>
      <span style={SH}>下一个突破口</span>
      <div style={{ ...baseCard, background: C.blueGlass, border: `1px solid ${C.blueBorder}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ fontSize: 26, flexShrink: 0, marginTop: 1 }}>🎯</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 2 }}>{breakthroughSource.label}</div>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 10 }}>
              当前平均 {breakthroughSource.avgSec}s · 目标 {nextTierHi}s → {TIER_LABEL[nextTier]}档
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(fill * 100)}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg,rgba(125,211,252,0.55),#7dd3fc)', transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.textFaint, marginTop: 3 }}>
              <span>{TIER_LABEL[breakthroughSource.tier]} {currentTierHi}s</span>
              <span style={{ color: C.blue, fontWeight: 600 }}>还差 {breakthroughSource.gapSec}s ✦</span>
              <span>{TIER_LABEL[nextTier]} {nextTierHi}s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section 5 · 错题追踪 ───────────────────────────────────────────────────────

function Section5({ mistakeStats }: { mistakeStats: { netResolved: number; totalResolved: number; total: number; topTags: string[] } }) {
  const { netResolved, totalResolved, total, topTags } = mistakeStats
  const rate = total > 0 ? Math.round((totalResolved / total) * 100) : 0
  const verdict = netResolved > 0
    ? { color: C.green, bg: 'rgba(74,222,128,0.05)', border: 'rgba(74,222,128,0.14)', icon: '✓', text: `错题复习在生效，本周净解决 ${netResolved} 个` }
    : netResolved === 0
    ? { color: C.blue, bg: 'rgba(125,211,252,0.05)', border: 'rgba(125,211,252,0.14)', icon: '→', text: '本周错题持平，继续保持' }
    : { color: C.yellow, bg: 'rgba(251,191,36,0.05)', border: 'rgba(251,191,36,0.14)', icon: '!', text: '本周错题有增加，多练补题' }

  return (
    <div>
      <span style={SH}>错题追踪</span>
      <div style={baseCard}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: netResolved > 0 ? C.green : netResolved < 0 ? C.red : C.text }}>
              {netResolved > 0 ? `+${netResolved}` : netResolved}
            </div>
            <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>本周净解决</div>
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: C.text }}>{totalResolved}/{total}</div>
            <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>累计已解决</div>
          </div>
        </div>
        {total > 0 && (
          <>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', margin: '4px 0 5px' }}>
              <div style={{ width: `${rate}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,#4ade80,rgba(74,222,128,0.45))' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.textDim }}>
              <span>解决率 {rate}%</span>
              <span>还剩 {total - totalResolved} 题待攻克</span>
            </div>
          </>
        )}
        {topTags.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 6 }}>常见错误类型</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {topTags.map(tag => (
                <span key={tag} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)', color: C.red }}>{tag}</span>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, fontSize: 12, fontWeight: 600, color: verdict.color, padding: '8px 10px', background: verdict.bg, border: `1px solid ${verdict.border}`, borderRadius: 10 }}>
          <span>{verdict.icon}</span><span>{verdict.text}</span>
        </div>
      </div>
    </div>
  )
}

// ── Section 6 · 最近练习 ───────────────────────────────────────────────────────

function Section6({ sessions }: { sessions: CalcSession[] }) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ ...SH, marginBottom: 0 }}>最近练习</span>
        <button onClick={() => setCollapsed(c => !c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 13, lineHeight: 1 }}>
          {collapsed ? '▾' : '▲'}
        </button>
      </div>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {sessions.length === 0 && <p style={{ color: C.textFaint, fontSize: 12, textAlign: 'center', padding: '16px 0' }}>还没有练习记录</p>}
          {sessions.slice(0, 10).map((s, i) => {
            const logs = s.questionLog ?? []
            const ms = logs.reduce((a, e) => a + e.ms, 0)
            const avgSec = logs.length > 0 ? +(ms / logs.length / 1000).toFixed(1) : 0
            const accuracy = logs.length > 0 ? Math.round(logs.filter(e => e.ok).length / logs.length * 100) : 0
            const sel = selectedIdx === i
            const accColor = accuracy >= 90 ? C.green : accuracy >= 70 ? C.yellow : C.red
            return (
              <button
                key={s.id ?? `${s.date}-${i}`}
                onClick={() => setSelectedIdx(sel ? null : i)}
                style={{ width: '100%', textAlign: 'left', borderRadius: 12, padding: '9px 12px', fontSize: 12, cursor: 'pointer', transition: 'all 0.13s', border: `1px solid ${sel ? 'rgba(196,181,253,0.3)' : C.border}`, background: sel ? 'rgba(196,181,253,0.08)' : C.surface }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  {i === 0 && <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 6, background: 'rgba(196,181,253,0.15)', color: C.violet }}>最新</span>}
                  <span style={{ fontSize: 11, color: sel ? 'rgba(196,181,253,0.65)' : C.textDim, minWidth: 36 }}>{s.date}</span>
                  <span style={{ color: C.text, fontWeight: 500 }}>{logs.length} 题</span>
                  <span style={{ fontWeight: 700, color: accColor }}>{accuracy}%</span>
                  <span style={{ color: 'rgba(196,181,253,0.65)', fontSize: 11 }}>{avgSec}s/题</span>
                </div>
                {sel && logs.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(196,181,253,0.15)' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {logs.slice(0, 20).map((e, j) => (
                        <span key={j} style={{ padding: '2px 6px', borderRadius: 6, fontSize: 11, background: e.ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: e.ok ? C.green : C.red, border: `1px solid ${e.ok ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}` }}>
                          {e.key.split(':').pop()}
                        </span>
                      ))}
                      {logs.length > 20 && <span style={{ fontSize: 11, color: C.textFaint }}>+{logs.length - 20}</span>}
                    </div>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

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
      if (op.label) { m.set(op.id, op.label); continue }
      try { m.set(op.id, skeletonMeta(op.skeleton)?.label ?? op.id) } catch { m.set(op.id, op.id) }
    }
    return m
  }, [settings.mixedOps])

  const mixedSkeletons = useMemo(() => {
    const m = new Map<string, string>()
    for (const op of settings.mixedOps) m.set(op.id, op.skeleton)
    return m
  }, [settings.mixedOps])

  const stats = useMemo(() => sourceStats(wallet.sessions, mixedLabels, mixedSkeletons), [wallet.sessions, mixedLabels, mixedSkeletons])
  const periodData = useMemo(() => weeklyAggregates(wallet.sessions), [wallet.sessions])
  const groupStats = useMemo(() => opGroupStats(stats), [stats])
  const weekStart = useMemo(() => thursdayWeekStart(new Date()), [])

  const weakStates = useMemo(() => [...problemStates.values()].filter(s => s.proficiency <= 2 && s.attemptCount >= 3), [problemStates])
  const recentMastered = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7)
    return [...problemStates.values()].filter(s => s.status === 'mastered' && s.updatedAt && new Date(s.updatedAt) >= cutoff)
  }, [problemStates])

  const mistakeStats = useMemo(() => {
    const weekCutoff = new Date(weekStart + 'T00:00:00')
    const resolved = mistakeRows.filter(r => r.resolved && new Date(r.created_at) >= weekCutoff).length
    const added = mistakeRows.filter(r => !r.resolved && new Date(r.created_at) >= weekCutoff).length
    const tagCounts = new Map<string, number>()
    for (const r of mistakeRows) { if (!r.error_tag) continue; tagCounts.set(r.error_tag, (tagCounts.get(r.error_tag) ?? 0) + 1) }
    const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([tag]) => tag)
    return { netResolved: resolved - added, totalResolved: mistakeRows.filter(r => r.resolved).length, total: mistakeRows.length, topTags }
  }, [mistakeRows, weekStart])

  const breakthroughSource = useMemo(
    () => stats.filter(s => !s.insufficient && s.tier !== 'auto' && s.gapSec > 0).sort((a, b) => a.gapSec - b.gapSec)[0] ?? null,
    [stats],
  )
  const slowestGroup = useMemo(() => groupStats[0] ?? null, [groupStats])
  const handleDrill = useCallback((url: string) => router.push(url), [router])

  if (wallet.isLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: C.textFaint, fontSize: 14 }}>加载中…</div>
  }

  const ani = (delay: number): React.CSSProperties => ({ animation: `fadeUp 0.42s ease ${delay}s both` })

  return (
    <>
      <style>{ANIMATIONS}</style>
      <CalcAppHeader
        balance={wallet.balance}
        soundEnabled={settings.soundEnabled}
        onToggleSound={() => {}}
        title="成长报告"
        backHref="/calc"
        backLabel="口算"
      />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 80px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={ani(0.04)}><Section1 breakthroughSource={breakthroughSource} slowestGroup={slowestGroup} onDrill={handleDrill} /></div>
        <div style={ani(0.11)}><Section2 sessions={wallet.sessions} periodData={periodData} weekStart={weekStart} /></div>
        <div style={ani(0.18)}><Section3 groupStats={groupStats} stats={stats} /></div>
        <div style={ani(0.25)}><Section4 weakStates={weakStates} recentMastered={recentMastered} onDrill={() => router.push('/calc/session?drill=weak-formulas')} /></div>
        <div style={ani(0.32)}><SectionBreakthrough breakthroughSource={breakthroughSource} /></div>
        <div style={ani(0.39)}><Section5 mistakeStats={mistakeStats} /></div>
        <div style={ani(0.46)}><Section6 sessions={wallet.sessions} /></div>
      </div>
    </>
  )
}
