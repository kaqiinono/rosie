// src/utils/calc-report-stats.ts
import type { CalcSession } from './type'
import { blockById } from './calc-blocks'
import { skeletonMeta } from './calc-mixed'
import { suggestedTiers, tierOf, nextTierGap, type Tier } from './calc-time-targets'

const WINDOW = 20

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
    const tier = tierOf(avgSec, accuracy, target)
    const gapSec = nextTierGap(avgSec, tier, target)

    let deltaSec: number | null = null
    if (prior.length >= 5) {
      const priorAvg = prior.reduce((a, e) => a + e.ms, 0) / prior.length / 1000
      deltaSec = +(priorAvg - avgSec).toFixed(1) // +ve = faster now
    }

    out.push({ key, label, targetId, count: recent.length, avgSec: +avgSec.toFixed(1), accuracy, perMinute, tier, gapSec, deltaSec })
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
