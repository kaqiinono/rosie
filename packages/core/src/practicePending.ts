'use client'

/**
 * Mid-session practice pending: localStorage (same device) + optional Supabase
 * (cross-device). Local writes are eager; cloud syncs on exit / background debounce
 * / explicit stash — not every answer.
 */
import { useCallback, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { localDateStr, todayStr } from './constant'

export type PracticePendingKind =
  | 'calc'
  | 'chinese'
  | 'math'
  | 'english_adaptive'
  | 'english_weekly'

/** Envelope stored locally and in `practice_pending_sessions.stash`. */
export type PracticePendingEnvelope<T = unknown> = {
  version: number
  savedAt: string
  /** todayStr() — stale-day envelopes are discarded on read. */
  date: string
  stash: T
  /**
   * When equal to `savedAt`, this revision was successfully uploaded.
   * Cleared on every new local write so fresh progress shows as unsynced.
   */
  syncedAt?: string
}

export function isPendingUnsynced(env: PracticePendingEnvelope): boolean {
  return env.syncedAt !== env.savedAt
}

/** Same-tab + optional cross-listener refresh (homepage button + card badges). */
export const PRACTICE_PENDING_CHANGED_EVENT = 'rosie-practice-pending-changed'

export function notifyPracticePendingChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(PRACTICE_PENDING_CHANGED_EVENT))
}

export type TodayPlanSubjectKey = 'calc' | 'english' | 'math' | 'chinese'
export type TodayPlanSyncStatus = 'none' | 'synced' | 'unsynced'

function kindToSubject(kind: PracticePendingKind): TodayPlanSubjectKey | null {
  if (kind === 'calc') return 'calc'
  if (kind === 'chinese') return 'chinese'
  if (kind === 'math') return 'math'
  if (kind === 'english_adaptive' || kind === 'english_weekly') return 'english'
  return null
}

/**
 * Chinese free practice scopes end with `|p=free`. Those must not light the
 * today-plan chinese card (continue href is roadmap-plan practice).
 */
export function isChineseFreePracticeScope(scopeKey: string): boolean {
  return /(?:^|\|)p=free(?:\||$)/.test(scopeKey)
}

/**
 * Math mid-exit scopes are per entry (`queue:plan`, `queue:sea`, …).
 * Today-plan card /「清除进度」only care about daily plan practice.
 * `active-queue` is the pre-split legacy slot (treated as plan until migrated).
 */
export function isMathTodayPlanScope(scopeKey: string): boolean {
  return scopeKey === 'queue:plan' || scopeKey === 'active-queue'
}

function emptySubjectSync(): Record<TodayPlanSubjectKey, TodayPlanSyncStatus> {
  return { calc: 'none', english: 'none', math: 'none', chinese: 'none' }
}

function bumpSubjectSync(
  map: Record<TodayPlanSubjectKey, TodayPlanSyncStatus>,
  subject: TodayPlanSubjectKey,
  unsynced: boolean,
): void {
  if (unsynced) {
    map[subject] = 'unsynced'
    return
  }
  if (map[subject] !== 'unsynced') map[subject] = 'synced'
}

const LOCAL_PENDING_PREFIX = 'practice-pending:'
/** Legacy English-weekly stash key, written directly by `weeklyPlanProgress`. */
const WEEKLY_SESSION_PREFIX = 'weekly_session_'
const WEEKLY_SYNCED_PREFIX = 'weekly_session_synced_'
/** Must match english `WEEKLY_PLAN_SESSION_META_KEY` — embedded in weekly_plans.progress_data. */
const WEEKLY_SESSION_META_KEY = '__rosie_session'

export function practicePendingLocalKey(kind: PracticePendingKind, scopeKey: string): string {
  return `${LOCAL_PENDING_PREFIX}${kind}:${scopeKey}`
}

function weeklySyncedMarkerKey(planId: string): string {
  return `${WEEKLY_SYNCED_PREFIX}${planId}`
}

/** Local write always clears syncedAt — new progress needs another cloud push. */
export function writeLocalPending<T>(
  kind: PracticePendingKind,
  scopeKey: string,
  envelope: PracticePendingEnvelope<T>,
): void {
  if (typeof window === 'undefined' || !scopeKey) return
  try {
    const { syncedAt: _ignored, ...rest } = envelope
    localStorage.setItem(practicePendingLocalKey(kind, scopeKey), JSON.stringify(rest))
    notifyPracticePendingChanged()
  } catch {
    /* quota / private mode */
  }
}

export function markLocalPendingSynced(
  kind: PracticePendingKind,
  scopeKey: string,
  savedAt: string,
): void {
  if (typeof window === 'undefined' || !scopeKey) return
  try {
    const key = practicePendingLocalKey(kind, scopeKey)
    const raw = localStorage.getItem(key)
    if (!raw) return
    const env = JSON.parse(raw) as PracticePendingEnvelope
    if (!env || env.savedAt !== savedAt) return
    localStorage.setItem(key, JSON.stringify({ ...env, syncedAt: savedAt }))
    notifyPracticePendingChanged()
  } catch {
    /* noop */
  }
}

function markWeeklyLocalSynced(planId: string, savedAt: string): void {
  if (typeof window === 'undefined' || !planId) return
  try {
    localStorage.setItem(weeklySyncedMarkerKey(planId), savedAt)
    notifyPracticePendingChanged()
  } catch {
    /* noop */
  }
}

function isWeeklyLocalUnsynced(planId: string, savedAt: string): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(weeklySyncedMarkerKey(planId)) !== savedAt
  } catch {
    return true
  }
}

export function readLocalPending<T>(
  kind: PracticePendingKind,
  scopeKey: string,
  today = todayStr(),
): PracticePendingEnvelope<T> | null {
  if (typeof window === 'undefined' || !scopeKey) return null
  let raw: string | null = null
  try {
    raw = localStorage.getItem(practicePendingLocalKey(kind, scopeKey))
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const env = JSON.parse(raw) as PracticePendingEnvelope<T>
    if (
      !env ||
      typeof env.savedAt !== 'string' ||
      typeof env.version !== 'number' ||
      env.date !== today ||
      env.stash == null
    ) {
      clearLocalPending(kind, scopeKey)
      return null
    }
    return env
  } catch {
    clearLocalPending(kind, scopeKey)
    return null
  }
}

export function clearLocalPending(kind: PracticePendingKind, scopeKey: string): void {
  if (typeof window === 'undefined' || !scopeKey) return
  try {
    localStorage.removeItem(practicePendingLocalKey(kind, scopeKey))
    if (kind === 'english_weekly') {
      // English weekly also keeps the legacy `weekly_session_<planId>` stash; leaving
      // it behind would resurrect a finished session as pending.
      localStorage.removeItem(`${WEEKLY_SESSION_PREFIX}${scopeKey}`)
      localStorage.removeItem(weeklySyncedMarkerKey(scopeKey))
    }
    notifyPracticePendingChanged()
  } catch {
    /* noop */
  }
}

export async function upsertCloudPending<T>(
  userId: string,
  kind: PracticePendingKind,
  scopeKey: string,
  envelope: PracticePendingEnvelope<T>,
): Promise<void> {
  if (!scopeKey) return
  const { error } = await supabase.from('practice_pending_sessions').upsert(
    {
      user_id: userId,
      kind,
      scope_key: scopeKey,
      stash: envelope as unknown as Record<string, unknown>,
      saved_at: envelope.savedAt,
    },
    { onConflict: 'user_id,kind,scope_key' },
  )
  if (error) throw error
}

export async function fetchCloudPending<T>(
  userId: string,
  kind: PracticePendingKind,
  scopeKey: string,
  today = todayStr(),
): Promise<PracticePendingEnvelope<T> | null> {
  if (!scopeKey) return null
  const { data, error } = await supabase
    .from('practice_pending_sessions')
    .select('stash, saved_at')
    .eq('user_id', userId)
    .eq('kind', kind)
    .eq('scope_key', scopeKey)
    .maybeSingle()
  if (error || !data) return null
  const env = data.stash as PracticePendingEnvelope<T> | null
  if (
    !env ||
    typeof env.savedAt !== 'string' ||
    typeof env.version !== 'number' ||
    env.date !== today ||
    env.stash == null
  ) {
    // Stale or corrupt cloud row — drop so it cannot resurrect after local expiry.
    if (data) {
      void clearCloudPending(userId, kind, scopeKey)
    }
    return null
  }
  // Anything read back from the table is by definition already uploaded.
  return { ...env, syncedAt: env.savedAt }
}

export async function clearCloudPending(
  userId: string,
  kind: PracticePendingKind,
  scopeKey: string,
): Promise<void> {
  if (!scopeKey) return
  const { error } = await supabase
    .from('practice_pending_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('kind', kind)
    .eq('scope_key', scopeKey)
  if (error) throw error
}

export function pickBestPending<T>(
  local: PracticePendingEnvelope<T> | null,
  cloud: PracticePendingEnvelope<T> | null,
): PracticePendingEnvelope<T> | null {
  if (!local && !cloud) return null
  if (!local) return cloud
  if (!cloud) return local
  return cloud.savedAt > local.savedAt ? cloud : local
}

export async function resolvePending<T>(
  userId: string | null | undefined,
  kind: PracticePendingKind,
  scopeKey: string,
): Promise<PracticePendingEnvelope<T> | null> {
  const local = readLocalPending<T>(kind, scopeKey)
  if (!userId) return local
  try {
    const cloud = await fetchCloudPending<T>(userId, kind, scopeKey)
    return pickBestPending(local, cloud)
  } catch {
    return local
  }
}

/**
 * Cache the envelope `resolvePending` picked so the next open is instant.
 *
 * Unlike `writeLocalPending` this keeps the revision marked as synced: it either
 * came from the cloud or was already the local copy, so flagging it unsynced would
 * make the homepage badge cry wolf and re-upload identical data.
 */
export function mirrorResolvedPending<T>(
  kind: PracticePendingKind,
  scopeKey: string,
  envelope: PracticePendingEnvelope<T>,
): void {
  if (typeof window === 'undefined' || !scopeKey) return
  const wasSynced = !isPendingUnsynced(envelope)
  writeLocalPending(kind, scopeKey, envelope)
  if (!wasSynced) return
  markLocalPendingSynced(kind, scopeKey, envelope.savedAt)
  if (kind === 'english_weekly') markWeeklyLocalSynced(scopeKey, envelope.savedAt)
}

export async function clearPendingEverywhere(
  userId: string | null | undefined,
  kind: PracticePendingKind,
  scopeKey: string,
): Promise<void> {
  clearLocalPending(kind, scopeKey)
  if (userId) {
    try {
      await clearCloudPending(userId, kind, scopeKey)
    } catch {
      /* ignore */
    }
  }
}

export type SyncLocalPendingResult = {
  synced: number
  failed: number
  /** Distinct kinds that synced at least once */
  kinds: PracticePendingKind[]
}

function parsePendingKey(key: string): { kind: PracticePendingKind; scopeKey: string } | null {
  if (!key.startsWith(LOCAL_PENDING_PREFIX)) return null
  const rest = key.slice(LOCAL_PENDING_PREFIX.length)
  const colon = rest.indexOf(':')
  if (colon <= 0) return null
  const kind = rest.slice(0, colon) as PracticePendingKind
  const scopeKey = rest.slice(colon + 1)
  if (!scopeKey) return null
  if (
    kind !== 'calc' &&
    kind !== 'chinese' &&
    kind !== 'math' &&
    kind !== 'english_adaptive' &&
    kind !== 'english_weekly'
  ) {
    return null
  }
  return { kind, scopeKey }
}

function isEnvelopeForToday(raw: unknown, today: string): PracticePendingEnvelope | null {
  if (!raw || typeof raw !== 'object') return null
  const env = raw as PracticePendingEnvelope
  if (
    typeof env.savedAt !== 'string' ||
    typeof env.version !== 'number' ||
    env.date !== today ||
    env.stash == null
  ) {
    return null
  }
  return env
}

function savedAtIsToday(savedAt: string, today: string): boolean {
  const t = new Date(savedAt)
  if (Number.isNaN(t.getTime())) return false
  // savedAt is a UTC ISO string; compare in local time so evening sessions west
  // of UTC aren't mistaken for tomorrow's.
  return localDateStr(t) === today
}

async function syncWeeklyPendingToCloud(
  userId: string,
  planId: string,
  stash: unknown,
): Promise<void> {
  const { data, error } = await supabase
    .from('weekly_plans')
    .select('progress_data')
    .eq('id', planId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('weekly plan not found')

  const progress =
    data.progress_data !== null &&
    typeof data.progress_data === 'object' &&
    !Array.isArray(data.progress_data)
      ? { ...(data.progress_data as Record<string, unknown>) }
      : {}
  progress[WEEKLY_SESSION_META_KEY] = stash

  const { error: upErr } = await supabase
    .from('weekly_plans')
    .update({
      progress_data: progress,
      updated_at: new Date().toISOString(),
    })
    .eq('id', planId)
    .eq('user_id', userId)
  if (upErr) throw upErr
}

export type LocalPendingCounts = {
  /** Same-day local pending sessions (synced or not). */
  total: number
  /** Local revisions not yet successfully uploaded. */
  unsynced: number
}

/** How many same-day local pending sessions exist (total + unsynced). */
export function countLocalPendingSessions(today = todayStr()): LocalPendingCounts {
  if (typeof window === 'undefined') return { total: 0, unsynced: 0 }
  let total = 0
  let unsynced = 0
  const seenWeekly = new Set<string>()
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      if (key.startsWith(LOCAL_PENDING_PREFIX)) {
        const parsed = parsePendingKey(key)
        if (!parsed) continue
        try {
          const env = isEnvelopeForToday(JSON.parse(localStorage.getItem(key) ?? ''), today)
          if (!env) continue
          total += 1
          if (isPendingUnsynced(env)) unsynced += 1
          if (parsed.kind === 'english_weekly') seenWeekly.add(parsed.scopeKey)
        } catch {
          /* skip */
        }
      }
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(WEEKLY_SESSION_PREFIX)) continue
      if (key.startsWith(WEEKLY_SYNCED_PREFIX)) continue
      const planId = key.slice(WEEKLY_SESSION_PREFIX.length)
      if (!planId || seenWeekly.has(planId)) continue
      try {
        const stash = JSON.parse(localStorage.getItem(key) ?? '') as { savedAt?: string }
        if (stash && typeof stash.savedAt === 'string' && savedAtIsToday(stash.savedAt, today)) {
          total += 1
          if (isWeeklyLocalUnsynced(planId, stash.savedAt)) unsynced += 1
        }
      } catch {
        /* skip */
      }
    }
  } catch {
    return { total, unsynced }
  }
  return { total, unsynced }
}

/**
 * Per today-plan card: whether this subject has local mid-session progress,
 * and whether that revision is already uploaded.
 * English aggregates weekly + adaptive (any unsynced → unsynced).
 */
export function getTodayPlanSyncStatus(
  today = todayStr(),
): Record<TodayPlanSubjectKey, TodayPlanSyncStatus> {
  const map = emptySubjectSync()
  if (typeof window === 'undefined') return map
  const seenWeekly = new Set<string>()
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(LOCAL_PENDING_PREFIX)) continue
      const parsed = parsePendingKey(key)
      if (!parsed) continue
      const subject = kindToSubject(parsed.kind)
      if (!subject) continue
      if (parsed.kind === 'chinese' && isChineseFreePracticeScope(parsed.scopeKey)) continue
      if (parsed.kind === 'math' && !isMathTodayPlanScope(parsed.scopeKey)) continue
      try {
        const env = isEnvelopeForToday(JSON.parse(localStorage.getItem(key) ?? ''), today)
        if (!env) continue
        bumpSubjectSync(map, subject, isPendingUnsynced(env))
        if (parsed.kind === 'english_weekly') seenWeekly.add(parsed.scopeKey)
      } catch {
        /* skip */
      }
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(WEEKLY_SESSION_PREFIX)) continue
      if (key.startsWith(WEEKLY_SYNCED_PREFIX)) continue
      const planId = key.slice(WEEKLY_SESSION_PREFIX.length)
      if (!planId || seenWeekly.has(planId)) continue
      try {
        const stash = JSON.parse(localStorage.getItem(key) ?? '') as { savedAt?: string }
        if (stash && typeof stash.savedAt === 'string' && savedAtIsToday(stash.savedAt, today)) {
          bumpSubjectSync(map, 'english', isWeeklyLocalUnsynced(planId, stash.savedAt))
        }
      } catch {
        /* skip */
      }
    }
  } catch {
    return map
  }
  return map
}

type PendingRef = { kind: PracticePendingKind; scopeKey: string }

function subjectMatchesKind(subject: TodayPlanSubjectKey, kind: PracticePendingKind): boolean {
  const mapped = kindToSubject(kind)
  return mapped === subject
}

/** Same-day pending refs that light the today-plan card for `subject`. */
export function listTodayPendingForSubject(
  subject: TodayPlanSubjectKey,
  today = todayStr(),
): PendingRef[] {
  const out: PendingRef[] = []
  const seenWeekly = new Set<string>()
  if (typeof window === 'undefined') return out
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(LOCAL_PENDING_PREFIX)) continue
      const parsed = parsePendingKey(key)
      if (!parsed || !subjectMatchesKind(subject, parsed.kind)) continue
      if (parsed.kind === 'chinese' && isChineseFreePracticeScope(parsed.scopeKey)) continue
      if (parsed.kind === 'math' && !isMathTodayPlanScope(parsed.scopeKey)) continue
      try {
        const env = isEnvelopeForToday(JSON.parse(localStorage.getItem(key) ?? ''), today)
        if (!env) continue
        out.push(parsed)
        if (parsed.kind === 'english_weekly') seenWeekly.add(parsed.scopeKey)
      } catch {
        /* skip */
      }
    }
    if (subject === 'english') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key?.startsWith(WEEKLY_SESSION_PREFIX)) continue
        if (key.startsWith(WEEKLY_SYNCED_PREFIX)) continue
        const planId = key.slice(WEEKLY_SESSION_PREFIX.length)
        if (!planId || seenWeekly.has(planId)) continue
        try {
          const stash = JSON.parse(localStorage.getItem(key) ?? '') as { savedAt?: string }
          if (stash && typeof stash.savedAt === 'string' && savedAtIsToday(stash.savedAt, today)) {
            out.push({ kind: 'english_weekly', scopeKey: planId })
          }
        } catch {
          /* skip */
        }
      }
    }
  } catch {
    return out
  }
  return out
}

async function clearWeeklyCloudSession(userId: string, planId: string): Promise<void> {
  const { data, error } = await supabase
    .from('weekly_plans')
    .select('progress_data')
    .eq('id', planId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return
  const progress =
    data.progress_data !== null &&
    typeof data.progress_data === 'object' &&
    !Array.isArray(data.progress_data)
      ? { ...(data.progress_data as Record<string, unknown>) }
      : {}
  if (!(WEEKLY_SESSION_META_KEY in progress)) return
  delete progress[WEEKLY_SESSION_META_KEY]
  const { error: upErr } = await supabase
    .from('weekly_plans')
    .update({
      progress_data: progress,
      updated_at: new Date().toISOString(),
    })
    .eq('id', planId)
    .eq('user_id', userId)
  if (upErr) throw upErr
}

/**
 * Discard same-day mid-session pending for one today-plan subject (local + cloud).
 * Does not touch completed daily progress.
 */
export async function clearTodayPlanSubjectPending(
  userId: string | null | undefined,
  subject: TodayPlanSubjectKey,
  today = todayStr(),
): Promise<{ cleared: number; failed: number }> {
  const refs = listTodayPendingForSubject(subject, today)
  let cleared = 0
  let failed = 0
  for (const { kind, scopeKey } of refs) {
    if (userId) {
      try {
        if (kind === 'english_weekly') {
          await clearWeeklyCloudSession(userId, scopeKey)
        } else {
          await clearCloudPending(userId, kind, scopeKey)
        }
      } catch {
        failed += 1
      }
    }
    clearLocalPending(kind, scopeKey)
    cleared += 1
  }
  return { cleared, failed }
}

/**
 * Push unsynced same-day localStorage pending sessions to Supabase.
 * - calc / chinese / math / english_adaptive → practice_pending_sessions
 * - english_weekly → weekly_plans.progress_data.__rosie_session
 * Already-synced revisions are skipped.
 */
export async function syncAllLocalPendingToCloud(
  userId: string,
): Promise<SyncLocalPendingResult> {
  const today = todayStr()
  let synced = 0
  let failed = 0
  const kindSet = new Set<PracticePendingKind>()
  const syncedWeekly = new Set<string>()

  if (typeof window === 'undefined') {
    return { synced: 0, failed: 0, kinds: [] }
  }

  const pendingKeys: string[] = []
  const weeklyKeys: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      if (key.startsWith(LOCAL_PENDING_PREFIX)) pendingKeys.push(key)
      else if (key.startsWith(WEEKLY_SESSION_PREFIX) && !key.startsWith(WEEKLY_SYNCED_PREFIX)) {
        weeklyKeys.push(key)
      }
    }
  } catch {
    return { synced: 0, failed: 0, kinds: [] }
  }

  for (const key of pendingKeys) {
    const parsed = parsePendingKey(key)
    if (!parsed) continue
    let env: PracticePendingEnvelope | null = null
    try {
      env = isEnvelopeForToday(JSON.parse(localStorage.getItem(key) ?? ''), today)
    } catch {
      failed += 1
      continue
    }
    if (!env || !isPendingUnsynced(env)) continue

    try {
      if (parsed.kind === 'english_weekly') {
        await syncWeeklyPendingToCloud(userId, parsed.scopeKey, env.stash)
        syncedWeekly.add(parsed.scopeKey)
        markWeeklyLocalSynced(parsed.scopeKey, env.savedAt)
      } else {
        await upsertCloudPending(userId, parsed.kind, parsed.scopeKey, env)
      }
      markLocalPendingSynced(parsed.kind, parsed.scopeKey, env.savedAt)
      synced += 1
      kindSet.add(parsed.kind)
    } catch {
      failed += 1
    }
  }

  for (const key of weeklyKeys) {
    const planId = key.slice(WEEKLY_SESSION_PREFIX.length)
    if (!planId || syncedWeekly.has(planId)) continue
    let stash: { savedAt?: string } | null = null
    try {
      stash = JSON.parse(localStorage.getItem(key) ?? '') as { savedAt?: string }
    } catch {
      failed += 1
      continue
    }
    if (!stash || typeof stash.savedAt !== 'string' || !savedAtIsToday(stash.savedAt, today)) {
      continue
    }
    if (!isWeeklyLocalUnsynced(planId, stash.savedAt)) continue
    try {
      await syncWeeklyPendingToCloud(userId, planId, stash)
      markWeeklyLocalSynced(planId, stash.savedAt)
      // Mirror envelope mark if present
      markLocalPendingSynced('english_weekly', planId, stash.savedAt)
      synced += 1
      kindSet.add('english_weekly')
    } catch {
      failed += 1
    }
  }

  return { synced, failed, kinds: [...kindSet] }
}

/** Local write + optional immediate cloud upsert. */
export async function persistPending<T>(opts: {
  userId?: string | null
  kind: PracticePendingKind
  scopeKey: string
  envelope: PracticePendingEnvelope<T>
  syncCloud?: boolean
}): Promise<void> {
  writeLocalPending(opts.kind, opts.scopeKey, opts.envelope)
  if (opts.syncCloud && opts.userId) {
    await upsertCloudPending(opts.userId, opts.kind, opts.scopeKey, opts.envelope)
    markLocalPendingSynced(opts.kind, opts.scopeKey, opts.envelope.savedAt)
  }
}

type LifecycleOpts<T> = {
  enabled: boolean
  userId: string | null | undefined
  kind: PracticePendingKind
  scopeKey: string
  getEnvelope: () => PracticePendingEnvelope<T> | null
  /** Background debounce before cloud sync (ms). Default 3000. */
  backgroundDebounceMs?: number
  /**
   * Custom cloud upsert (e.g. English weekly embeds in progress_data).
   * When set, replaces the default practice_pending_sessions upsert.
   */
  cloudUpsert?: (envelope: PracticePendingEnvelope<T>) => Promise<void>
}

/**
 * While `enabled`, on tab hide / pagehide: write localStorage and debounce cloud sync.
 * Call `flushCloudNow` on explicit exit / stash button.
 *
 * `flushCloudNow` never rejects — callers use it to gate navigation, and a
 * transient cloud failure must not trap the user inside a session. It resolves
 * `false` when the local write succeeded but the cloud copy did not.
 */
export function usePracticePendingLifecycle<T>(opts: LifecycleOpts<T>): {
  flushCloudNow: () => Promise<boolean>
  persistLocalNow: () => void
} {
  const {
    enabled,
    userId,
    kind,
    scopeKey,
    getEnvelope,
    backgroundDebounceMs = 3000,
    cloudUpsert,
  } = opts

  const getEnvelopeRef = useRef(getEnvelope)
  // eslint-disable-next-line react-hooks/refs
  getEnvelopeRef.current = getEnvelope
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persistLocalNow = useCallback(() => {
    if (!enabled || !scopeKey) return
    const env = getEnvelopeRef.current()
    if (!env) return
    writeLocalPending(kind, scopeKey, env)
  }, [enabled, kind, scopeKey])

  const flushCloudNow = useCallback(async (): Promise<boolean> => {
    if (!enabled || !scopeKey) return true
    const env = getEnvelopeRef.current()
    if (!env) return true
    writeLocalPending(kind, scopeKey, env)
    if (!userId) return false
    try {
      if (cloudUpsert) {
        await cloudUpsert(env)
      } else {
        await upsertCloudPending(userId, kind, scopeKey, env)
      }
    } catch {
      // Progress is already safe in localStorage; the homepage「备份进度」button retries.
      return false
    }
    markLocalPendingSynced(kind, scopeKey, env.savedAt)
    if (kind === 'english_weekly') {
      markWeeklyLocalSynced(scopeKey, env.savedAt)
    }
    return true
  }, [enabled, scopeKey, userId, kind, cloudUpsert])

  const scheduleBackgroundCloud = useCallback(() => {
    persistLocalNow()
    if (!userId) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      void flushCloudNow()
    }, backgroundDebounceMs)
  }, [persistLocalNow, userId, flushCloudNow, backgroundDebounceMs])

  useEffect(() => {
    if (!enabled) return

    const onVis = () => {
      if (document.visibilityState === 'hidden') scheduleBackgroundCloud()
    }
    // A debounced timer would never fire on unload — write locally, then try the
    // cloud immediately and let the browser deliver it if it can.
    const onPageHide = () => {
      persistLocalNow()
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      void flushCloudNow()
    }

    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onPageHide)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [enabled, scheduleBackgroundCloud, persistLocalNow, flushCloudNow])

  return { flushCloudNow, persistLocalNow }
}
