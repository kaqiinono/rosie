/**
 * Chinese chars practice pending via @rosie/core practicePending.
 */
import type { PracticePhase, PracticeSessionPlan } from './chinese-chars-session-helpers'
import {
  clearLocalPending,
  clearPendingEverywhere,
  readLocalPending,
  resolvePending,
  writeLocalPending,
  type PracticePendingEnvelope,
} from '@rosie/core'
import { todayStr } from '@rosie/core'

export const CHINESE_PRACTICE_SNAPSHOT_VERSION = 1
export const CHINESE_PENDING_KIND = 'chinese' as const

export type ChinesePracticeSnapshot = {
  version: number
  date: string
  bookSlug: string
  scopeKey: string
  phase: PracticePhase
  cardIdx: number
  charQIdx: number
  phraseIdx: number
  poemIdx: number
  accIdx: number
  passageIdx: number
  pinyinWriteIdx: number
  earnedMoons: number
  correctCounts: { total: number; correct: number }
  plan: PracticeSessionPlan
}

export function chinesePracticeScopeKey(args: {
  bookSlug: string
  units: string
  lessons: string
  types: string
  cardPreview: string
}): string {
  return `${args.bookSlug}|u=${args.units}|l=${args.lessons}|t=${args.types}|c=${args.cardPreview}`
}

function isValidSnap(snap: unknown): snap is ChinesePracticeSnapshot {
  if (!snap || typeof snap !== 'object') return false
  const s = snap as ChinesePracticeSnapshot
  return (
    s.version === CHINESE_PRACTICE_SNAPSHOT_VERSION &&
    !!s.plan &&
    Array.isArray(s.plan.charQuestions) &&
    s.phase !== 'done'
  )
}

export function wrapChineseEnvelope(
  snap: ChinesePracticeSnapshot,
): PracticePendingEnvelope<ChinesePracticeSnapshot> {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    date: todayStr(),
    stash: { ...snap, date: todayStr() },
  }
}

export function writeChinesePracticeSnapshot(snap: ChinesePracticeSnapshot): void {
  writeLocalPending(CHINESE_PENDING_KIND, snap.scopeKey, wrapChineseEnvelope(snap))
}

export function clearChinesePracticeSnapshot(scopeKey: string): void {
  clearLocalPending(CHINESE_PENDING_KIND, scopeKey)
}

export async function clearChinesePendingEverywhere(
  userId: string | null | undefined,
  scopeKey: string,
): Promise<void> {
  await clearPendingEverywhere(userId, CHINESE_PENDING_KIND, scopeKey)
}

export function readChinesePracticeSnapshot(
  bookSlug: string,
  scopeKey: string,
  today = todayStr(),
): ChinesePracticeSnapshot | null {
  const env = readLocalPending<ChinesePracticeSnapshot>(CHINESE_PENDING_KIND, scopeKey, today)
  if (!env || !isValidSnap(env.stash) || env.stash.bookSlug !== bookSlug) {
    if (env) clearChinesePracticeSnapshot(scopeKey)
    return null
  }
  return env.stash
}

export async function resolveChinesePracticeSnapshot(
  userId: string | null | undefined,
  bookSlug: string,
  scopeKey: string,
): Promise<ChinesePracticeSnapshot | null> {
  const env = await resolvePending<ChinesePracticeSnapshot>(userId, CHINESE_PENDING_KIND, scopeKey)
  if (!env || !isValidSnap(env.stash) || env.stash.bookSlug !== bookSlug) return null
  writeLocalPending(CHINESE_PENDING_KIND, scopeKey, env)
  return env.stash
}
