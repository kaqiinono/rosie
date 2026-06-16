// src/utils/calc-report-stats.ts
import type { CalcSession } from './type'
import { blockById } from './calc-blocks'
import { skeletonMeta } from './calc-mixed'
import { suggestedTiers, tierOf, nextTierGap, type Tier } from './calc-time-targets'

export interface PeriodPoint {
  label: string           // "6/W2" | "6/15" | "6月"
  avgSec: number | null   // null = no practice in this period
  totalCount: number
  daysActive: number
}

export interface PeriodData {
  week: PeriodPoint[]   // 最近 12 周
  day: PeriodPoint[]    // 最近 30 天
  month: PeriodPoint[]  // 最近 12 个月
}

function padTwo(n: number) { return String(n).padStart(2, '0') }

/** Returns ISO date string (YYYY-MM-DD) of the Thursday that starts the week containing `date`. Uses local time. */
function thursdayWeekStart(date: Date): string {
  const d = new Date(date)
  // days back to Thursday: (day - 4 + 7) % 7
  // Sun=0→6, Mon=1→5, Tue=2→4, Wed=3→3, Thu=4→0, Fri=5→1, Sat=6→2
  const backToThu = (d.getDay() - 4 + 7) % 7
  d.setDate(d.getDate() - backToThu)
  return `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}`
}

function isoMonth(date: Date): string {
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}`
}

function isoDay(date: Date): string {
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`
}

const WINDOW = 20
const MIN_SAMPLE = 8

export interface SourceStat {
  key: string            // "block:<id>" | "mixed:<id>"
  label: string
  targetId: string       // block id or skeleton id (for TIME_TARGETS lookup)
  count: number          // first-attempt questions in the recent window
  avgSec: number
  accuracy: number       // 0..1
  perMinute: number      // 题/分钟
  tier: Tier | null
  gapSec: number         // 离下一档还差
  insufficient: boolean  // 首做样本 < MIN_SAMPLE，不下结论
  /** +ve = faster than the prior window (进步); null if no prior window. */
  deltaSec: number | null
}

interface Entry { ms: number; ok: boolean }

/**
 * Aggregate per-source stats from sessions (newest-first).
 * `mixedLabels`/`mixedSkeletons` map mixed op id → display label / skeleton id.
 */
export function sourceStats(
  sessions: CalcSession[],
  mixedLabels: Map<string, string>,
  mixedSkeletons: Map<string, string>,
): SourceStat[] {
  // Flatten log entries per key, newest-first (sessions already newest-first).
  const byKey = new Map<string, Entry[]>()
  for (const s of sessions) {
    for (const e of s.questionLog ?? []) {
      const arr = byKey.get(e.key) ?? []
      arr.push({ ms: e.ms, ok: e.ok })
      byKey.set(e.key, arr)
    }
  }

  const out: SourceStat[] = []
  for (const [key, entries] of byKey) {
    if (key === 'unknown') continue
    const recent = entries.slice(0, WINDOW)
    if (recent.length === 0) continue
    const prior = entries.slice(WINDOW, WINDOW * 2)

    const avgSec = recent.reduce((a, e) => a + e.ms, 0) / recent.length / 1000
    const accuracy = recent.filter((e) => e.ok).length / recent.length
    const totalMin = recent.reduce((a, e) => a + e.ms, 0) / 60000
    const perMinute = totalMin > 0 ? +(recent.length / totalMin).toFixed(1) : 0

    const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)]
    const targetId = kind === 'block' ? id : (mixedSkeletons.get(id) ?? id)
    const label =
      kind === 'block'
        ? blockById(id)?.label ?? id
        : mixedLabels.get(id) ?? (mixedSkeletons.has(id) ? skeletonMeta(mixedSkeletons.get(id)! as never).label : id)

    const target = suggestedTiers(targetId)
    const insufficient = recent.length < MIN_SAMPLE
    const tier = insufficient ? null : tierOf(avgSec, accuracy, target)
    const gapSec = insufficient ? 0 : nextTierGap(avgSec, tier, target)

    let deltaSec: number | null = null
    if (prior.length >= 5) {
      const priorAvg = prior.reduce((a, e) => a + e.ms, 0) / prior.length / 1000
      deltaSec = +(priorAvg - avgSec).toFixed(1) // +ve = faster now
    }

    out.push({ key, label, targetId, count: recent.length, avgSec: +avgSec.toFixed(1), accuracy, perMinute, tier, gapSec, deltaSec, insufficient })
  }
  return out
}

export interface SessionVerdict {
  /** 'up' | 'down' | 'flat' | null(no prior) */
  trend: 'up' | 'down' | 'flat' | null
  deltaSec: number | null   // overall avg秒/题 delta (+ve faster)
  perMinute: number          // this session
  improved: number           // # sources faster
  regressed: number          // # sources slower
}

/** This-session verdict: latest session vs the one before it. */
export function sessionVerdict(sessions: CalcSession[]): SessionVerdict {
  const cur = sessions[0]
  if (!cur || (cur.questionLog ?? []).length === 0) {
    return { trend: null, deltaSec: null, perMinute: 0, improved: 0, regressed: 0 }
  }
  const curLog = cur.questionLog ?? []
  const curMs = curLog.reduce((a, e) => a + e.ms, 0)
  const perMinute = curMs > 0 ? +(curLog.length / (curMs / 60000)).toFixed(1) : 0
  const curAvg = curLog.length > 0 ? curMs / curLog.length / 1000 : 0

  const prev = sessions[1]
  const prevLog = prev?.questionLog ?? []
  if (prevLog.length === 0) {
    return { trend: null, deltaSec: null, perMinute, improved: 0, regressed: 0 }
  }
  const prevAvg = prevLog.reduce((a, e) => a + e.ms, 0) / prevLog.length / 1000
  const deltaSec = +(prevAvg - curAvg).toFixed(1)

  // per-source improved/regressed across the two sessions
  const avgByKey = (log: { key: string; ms: number }[]) => {
    const m = new Map<string, { sum: number; n: number }>()
    for (const e of log) {
      const a = m.get(e.key) ?? { sum: 0, n: 0 }
      a.sum += e.ms; a.n += 1; m.set(e.key, a)
    }
    return m
  }
  const curBy = avgByKey(curLog)
  const prevBy = avgByKey(prevLog)
  let improved = 0, regressed = 0
  for (const [key, c] of curBy) {
    const p = prevBy.get(key)
    if (!p) continue
    const cAvg = c.sum / c.n, pAvg = p.sum / p.n
    if (cAvg < pAvg - 100) improved++
    else if (cAvg > pAvg + 100) regressed++
  }

  const trend = Math.abs(deltaSec) < 0.1 ? 'flat' : deltaSec > 0 ? 'up' : 'down'
  return { trend, deltaSec, perMinute, improved, regressed }
}

/**
 * Aggregates session data by week (Thu-start), day, and month.
 * Returns the most recent 12 weeks, 30 days, and 12 months.
 * Periods with no sessions get avgSec: null.
 */
export function weeklyAggregates(sessions: CalcSession[]): PeriodData {
  type Acc = { msSum: number; count: number; days: Set<string> }

  const byWeek = new Map<string, Acc>()
  const byDay  = new Map<string, Acc>()
  const byMonth= new Map<string, Acc>()

  for (const s of sessions) {
    if (!s.date) continue
    const d = new Date(s.date + 'T00:00:00')
    const wKey = thursdayWeekStart(d)
    const dKey = isoDay(d)
    const mKey = isoMonth(d)

    const logs = s.questionLog ?? []
    const ms = logs.reduce((a, e) => a + e.ms, 0)
    const n  = logs.length

    const add = (map: Map<string, Acc>, key: string) => {
      const acc = map.get(key) ?? { msSum: 0, count: 0, days: new Set<string>() }
      acc.msSum  += ms
      acc.count  += n
      if (n > 0) acc.days.add(dKey)
      map.set(key, acc)
    }
    add(byWeek,  wKey)
    add(byDay,   dKey)
    add(byMonth, mKey)
  }

  const today = new Date()

  // 12 weeks back (Thu-start)
  const weeks: PeriodPoint[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i * 7)
    const key = thursdayWeekStart(d)
    const acc = byWeek.get(key)
    const dt = new Date(key + 'T00:00:00')
    weeks.push({
      label: `${dt.getMonth() + 1}/W${Math.ceil(dt.getDate() / 7)}`,
      avgSec: acc && acc.count > 0 ? +(acc.msSum / acc.count / 1000).toFixed(1) : null,
      totalCount: acc?.count ?? 0,
      daysActive: acc?.days.size ?? 0,
    })
  }

  // 30 days back
  const days: PeriodPoint[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = isoDay(d)
    const acc = byDay.get(key)
    days.push({
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      avgSec: acc && acc.count > 0 ? +(acc.msSum / acc.count / 1000).toFixed(1) : null,
      totalCount: acc?.count ?? 0,
      daysActive: acc ? 1 : 0,
    })
  }

  // 12 months back
  const months: PeriodPoint[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const key = isoMonth(d)
    const acc = byMonth.get(key)
    months.push({
      label: `${d.getMonth() + 1}月`,
      avgSec: acc && acc.count > 0 ? +(acc.msSum / acc.count / 1000).toFixed(1) : null,
      totalCount: acc?.count ?? 0,
      daysActive: acc?.days.size ?? 0,
    })
  }

  return { week: weeks, day: days, month: months }
}
