'use client'

import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase, type UserSessionStore } from '@rosie/core'
import { lessonByKey } from '../utils/lesson-registry'
import { parseProblemVideoCatalog, type ProblemVideoCatalog } from '../utils/problem-video-catalog'

interface CachedCatalog {
  keys: Set<string>
  syncedAt: string | null
}

const empty: CachedCatalog = { keys: new Set<string>(), syncedAt: null }
const stores = new Map<string, UserSessionStore<CachedCatalog>>()
const disabledStore = createUserSessionStore<CachedCatalog>('math_video_catalog:disabled', {
  empty,
  fetch: async () => empty,
})

function getCatalogStore(lessonKey: string): UserSessionStore<CachedCatalog> {
  const existing = stores.get(lessonKey)
  if (existing) return existing
  const store = createUserSessionStore<CachedCatalog>(`math_video_catalog:${lessonKey}`, {
    empty,
    fetch: async (userId) => {
      const { data, error } = await supabase.auth.getSession()
      if (error || data.session?.user.id !== userId) throw new Error('video_session_missing')
      const response = await fetch(
        `/api/baidu/video/catalog?lessonKey=${encodeURIComponent(lessonKey)}`,
        {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          credentials: 'same-origin',
          cache: 'no-store',
          signal: AbortSignal.timeout(20_000),
        },
      )
      if (!response.ok) throw new Error('video_catalog_unavailable')
      const catalog = parseProblemVideoCatalog(await response.json(), lessonKey)
      return { keys: new Set(catalog.keys), syncedAt: catalog.syncedAt }
    },
  })
  stores.set(lessonKey, store)
  return store
}

// One listener for the shared store, rather than one auth subscription per question.
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') for (const store of stores.values()) store.invalidateAll()
  })
}

/** Cancel older inflight reads before publishing a freshly synchronized snapshot. */
export function replaceProblemVideoCatalog(userId: string, catalog: ProblemVideoCatalog): void {
  const catalogStore = getCatalogStore(catalog.lessonKey)
  catalogStore.invalidate(userId)
  catalogStore.replaceSessionData(userId, {
    keys: new Set(catalog.keys),
    syncedAt: catalog.syncedAt,
  })
}

export function useProblemVideoCatalog(user: User | null, lessonKey: string | undefined) {
  const validLesson = lessonKey !== undefined && Boolean(lessonByKey(lessonKey))
  const catalogStore = validLesson ? getCatalogStore(lessonKey!) : disabledStore
  const { data, isLoading, error } = catalogStore.useSessionData(validLesson ? user : null)
  const status = !user
    ? 'signed-out'
    : !validLesson
      ? 'unknown'
      : isLoading
        ? 'loading'
        : error
          ? 'error'
          : data.syncedAt
            ? 'ready'
            : 'unsynced'
  return {
    status,
    syncedAt: data.syncedAt,
    count: data.keys.size,
    hasVideo: (key: string) => status === 'ready' && data.keys.has(key),
    retry: () => (user && validLesson ? catalogStore.ensureLoaded(user.id) : Promise.resolve()),
  }
}

/** App adapters share the exact per-user/lesson cache with math replay controls. */
export async function loadProblemVideoCatalog(
  userId: string,
  lessonKey: string,
): Promise<ReadonlySet<string>> {
  if (!lessonByKey(lessonKey)) return new Set()
  const store = getCatalogStore(lessonKey)
  await store.ensureLoaded(userId)
  const snapshot = store.getSnapshot(userId)
  if (snapshot.status !== 'ready' || !snapshot.data.syncedAt) return new Set()
  return snapshot.data.keys
}
