'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { User } from '@supabase/supabase-js'

export type SessionStatus = 'idle' | 'loading' | 'ready' | 'error'

export type SessionSnapshot<T> = {
  data: T
  status: SessionStatus
  error: unknown | null
  version: number
}

type Slot<T> = {
  data: T
  status: SessionStatus
  error: unknown | null
  inflight: Promise<T> | null
  version: number
  /** Cached snapshot object — must keep referential stability for useSyncExternalStore. */
  snapshot: SessionSnapshot<T>
}

const EMPTY_USER_KEY = '__none__'

export interface UserSessionStore<T> {
  storeKey: string
  useSessionData: (user: User | null) => { data: T; isLoading: boolean; error: unknown | null }
  getSessionData: (userId: string | null | undefined) => T | undefined
  getSnapshot: (userId: string | null | undefined) => SessionSnapshot<T>
  patchSessionData: (userId: string, patch: (prev: T) => T) => void
  replaceSessionData: (userId: string, data: T) => void
  invalidate: (userId?: string) => void
  invalidateAll: () => void
  ensureLoaded: (userId: string) => Promise<void>
}

const globalRegistry = new Map<string, UserSessionStore<unknown>>()

/** Invalidate one store (all users) or every registered store when key omitted. */
export function invalidateSessionStore(storeKey?: string): void {
  if (storeKey) {
    globalRegistry.get(storeKey)?.invalidateAll()
    return
  }
  for (const store of globalRegistry.values()) {
    store.invalidateAll()
  }
}

function toUserKey(userId: string | null | undefined): string {
  return userId ?? EMPTY_USER_KEY
}

export function createUserSessionStore<T>(
  storeKey: string,
  options: {
    fetch: (userId: string) => Promise<T>
    empty: T
  },
): UserSessionStore<T> {
  const slots = new Map<string, Slot<T>>()
  const listeners = new Set<(changedKey: string) => void>()

  const emptyUserSnapshot: SessionSnapshot<T> = {
    data: options.empty,
    status: 'idle',
    error: null,
    version: 0,
  }

  function syncSnapshot(slot: Slot<T>): void {
    slot.snapshot = {
      data: slot.data,
      status: slot.status,
      error: slot.error,
      version: slot.version,
    }
  }

  function getOrCreateSlot(key: string): Slot<T> {
    let slot = slots.get(key)
    if (!slot) {
      slot = {
        data: options.empty,
        status: 'idle',
        error: null,
        inflight: null,
        version: 0,
        snapshot: emptyUserSnapshot,
      }
      syncSnapshot(slot)
      slots.set(key, slot)
    }
    return slot
  }

  function emit(changedKey: string): void {
    for (const listener of listeners) listener(changedKey)
  }

  function bump(slot: Slot<T>, changedKey: string): void {
    slot.version += 1
    syncSnapshot(slot)
    emit(changedKey)
  }

  function getSnapshot(userId: string | null | undefined): SessionSnapshot<T> {
    const key = toUserKey(userId)
    if (key === EMPTY_USER_KEY) {
      return emptyUserSnapshot
    }
    return getOrCreateSlot(key).snapshot
  }

  function ensureLoaded(userId: string): Promise<void> {
    const key = toUserKey(userId)
    const slot = getOrCreateSlot(key)
    if (slot.status === 'ready') return Promise.resolve()
    if (slot.status === 'loading' && slot.inflight) {
      return slot.inflight.then(() => undefined)
    }

    slot.status = 'loading'
    slot.error = null
    bump(slot, key)

    const promise = options
      .fetch(userId)
      .then((data) => {
        if (slot.inflight !== promise) return data
        slot.data = data
        slot.status = 'ready'
        slot.inflight = null
        bump(slot, key)
        return data
      })
      .catch((err: unknown) => {
        if (slot.inflight !== promise) throw err
        slot.status = 'error'
        slot.error = err
        slot.inflight = null
        bump(slot, key)
        throw err
      })

    slot.inflight = promise
    return promise.then(() => undefined)
  }

  function patchSessionData(userId: string, patch: (prev: T) => T): void {
    const key = toUserKey(userId)
    const slot = getOrCreateSlot(key)
    slot.data = patch(slot.data)
    if (slot.status === 'idle') slot.status = 'ready'
    bump(slot, key)
  }

  function replaceSessionData(userId: string, data: T): void {
    const key = toUserKey(userId)
    const slot = getOrCreateSlot(key)
    slot.data = data
    slot.status = 'ready'
    slot.error = null
    bump(slot, key)
  }

  function invalidate(userId?: string): void {
    if (userId) {
      const key = toUserKey(userId)
      const slot = slots.get(key)
      if (!slot) return
      slot.status = 'idle'
      slot.inflight = null
      slot.error = null
      bump(slot, key)
      return
    }
    invalidateAll()
  }

  function invalidateAll(): void {
    for (const [key, slot] of slots) {
      slot.status = 'idle'
      slot.inflight = null
      slot.error = null
      bump(slot, key)
    }
  }

  function getSessionData(userId: string | null | undefined): T | undefined {
    const key = toUserKey(userId)
    if (key === EMPTY_USER_KEY) return undefined
    const slot = slots.get(key)
    if (!slot || slot.status !== 'ready') return undefined
    return slot.data
  }

  function subscribe(userId: string | null | undefined, onChange: () => void): () => void {
    const key = toUserKey(userId)
    const listener = (changedKey: string) => {
      if (changedKey === key) onChange()
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  function useSessionData(user: User | null): {
    data: T
    isLoading: boolean
    error: unknown | null
  } {
    const userId = user?.id ?? null

    const subscribeForUser = useCallback(
      (onChange: () => void) => subscribe(userId, onChange),
      [userId],
    )

    const getSnapshotForUser = useCallback(
      () => getSnapshot(userId),
      [userId],
    )

    const snapshot = useSyncExternalStore(
      subscribeForUser,
      getSnapshotForUser,
      () => emptyUserSnapshot,
    )

    useEffect(() => {
      if (userId) ensureLoaded(userId)
    }, [userId])

    const isLoading =
      userId !== null &&
      (snapshot.status === 'loading' || snapshot.status === 'idle')

    return {
      data: snapshot.data,
      isLoading,
      error: snapshot.error,
    }
  }

  const store: UserSessionStore<T> = {
    storeKey,
    useSessionData,
    getSessionData,
    getSnapshot,
    patchSessionData,
    replaceSessionData,
    invalidate,
    invalidateAll,
    ensureLoaded,
  }

  globalRegistry.set(storeKey, store as UserSessionStore<unknown>)
  return store
}
