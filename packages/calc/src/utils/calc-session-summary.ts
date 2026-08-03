import type { CalcSession, QuestionLogEntry } from '@rosie/core'
import { blockById } from './calc-blocks'

export type SessionSummaryBySource = {
  label: string
  total: number
  firstTryCorrect: number
  perMinute: number
  avgSec: number
  targetSec: number | null
}

export type SessionSummaryViewModel = {
  correctCount: number
  retryCount: number
  wrongCount: number
  total: number
  coinsEarned: number
  timeSpentSec: number
  avgMs: number | null
  prevAvgMs: number | null
  maxStreak: number
  challengeCorrect: number
  bySource: SessionSummaryBySource[]
  newWeak: string[]
  nextFocus: string[]
}

function avgMsFromSession(session: CalcSession): number | null {
  const log = session.questionLog ?? []
  if (log.length > 0) {
    return Math.round(log.reduce((a, e) => a + e.ms, 0) / log.length)
  }
  const times = session.questionTimesMs ?? []
  if (times.length > 0) {
    return Math.round(times.reduce((a, t) => a + t, 0) / times.length)
  }
  return null
}

function resolveLabel(
  key: string,
  entryLabel: string | undefined,
  mixedLabels?: Map<string, string>,
): string {
  if (entryLabel) return entryLabel
  const colon = key.indexOf(':')
  if (colon < 0) return key
  const kind = key.slice(0, colon)
  const id = key.slice(colon + 1)
  if (kind === 'block') return blockById(id)?.label ?? id
  if (kind === 'mixed') return mixedLabels?.get(id) ?? id
  return id
}

function firstTargetSec(entries: QuestionLogEntry[]): number | null {
  for (const e of entries) {
    if (e.targetSec != null && e.targetSec > 0) return e.targetSec
  }
  return null
}

function firstLabel(entries: QuestionLogEntry[]): string | undefined {
  for (const e of entries) {
    if (e.label) return e.label
  }
  return undefined
}

export function buildBySourceFromLog(
  log: QuestionLogEntry[],
  mixedLabels?: Map<string, string>,
): SessionSummaryBySource[] {
  const groups = new Map<string, QuestionLogEntry[]>()
  for (const e of log) {
    if (e.key === 'unknown') continue
    const arr = groups.get(e.key)
    if (arr) arr.push(e)
    else groups.set(e.key, [e])
  }

  return Array.from(groups.entries()).map(([key, entries]) => {
    const n = entries.length
    const sumMs = entries.reduce((a, e) => a + e.ms, 0)
    const avgSec = n > 0 ? +(sumMs / n / 1000).toFixed(1) : 0
    const perMinute = sumMs > 0 ? +(n / (sumMs / 60000)).toFixed(1) : 0
    return {
      label: resolveLabel(key, firstLabel(entries), mixedLabels),
      total: n,
      firstTryCorrect: entries.filter((e) => e.ok).length,
      perMinute,
      avgSec,
      targetSec: firstTargetSec(entries),
    }
  })
}

export function buildNewWeakFromLog(log: QuestionLogEntry[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const e of log) {
    if (e.finallyOk !== false || !e.display) continue
    if (seen.has(e.display)) continue
    seen.add(e.display)
    out.push(e.display)
    if (out.length >= 8) break
  }
  return out
}

export function buildSessionSummaryProps(
  session: CalcSession,
  prevSession: CalcSession | null,
  opts?: { mixedLabels?: Map<string, string> },
): SessionSummaryViewModel {
  const log = session.questionLog ?? []
  const bySource = buildBySourceFromLog(log, opts?.mixedLabels)
  const newWeak = buildNewWeakFromLog(log)
  const nextFocus = [...bySource]
    .sort(
      (a, b) =>
        a.firstTryCorrect / Math.max(1, a.total) - b.firstTryCorrect / Math.max(1, b.total),
    )
    .slice(0, 5)
    .map((s) => s.label)

  return {
    correctCount: session.correctCount,
    retryCount: session.retryCount,
    wrongCount: session.wrongCount,
    total: session.count,
    coinsEarned: session.coinsEarned,
    timeSpentSec: session.timeSpentSec,
    avgMs: avgMsFromSession(session),
    prevAvgMs: prevSession ? avgMsFromSession(prevSession) : null,
    maxStreak: session.maxStreak,
    challengeCorrect: session.challengeCorrect,
    bySource,
    newWeak,
    nextFocus,
  }
}
