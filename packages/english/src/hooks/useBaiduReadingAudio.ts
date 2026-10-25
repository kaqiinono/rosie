'use client'

import { useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase } from '@rosie/core'

let postedSession: { token: string; validUntil: number } | null = null

const audioKeysStore = createUserSessionStore<string[]>('baidu_reading_audio_keys', {
  empty: [],
  fetch: async (userId) => {
    const { data, error } = await supabase.auth.getSession()
    const session = data.session
    if (error || !session || session.user.id !== userId) throw new Error('audio_session_missing')
    const controller = new AbortController()
    const abort = () => controller.abort()
    window.addEventListener('rosie-reading-audio-signout', abort, { once: true })
    try {
      const response = await fetch('/api/baidu/audio/session', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { Authorization: `Bearer ${session.access_token}` },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45_000)]),
      })
      if (!response.ok) throw new Error('baidu_audio_unavailable')
      const body: unknown = await response.json()
      if (controller.signal.aborted) throw new Error('audio_session_cancelled')
      if (!body || typeof body !== 'object') throw new Error('invalid_audio_manifest')
      const keys = (body as Record<string, unknown>).keys
      if (!Array.isArray(keys)) throw new Error('invalid_audio_manifest')
      postedSession = {
        token: session.access_token,
        validUntil: Math.min(Date.now() + 50 * 60_000, (session.expires_at ?? 0) * 1000 - 60_000),
      }
      return keys.filter((key): key is string =>
        typeof key === 'string' && /^(4a|5a)-u[1-9]\d?l[1-9]\d?$/.test(key))
    } finally {
      window.removeEventListener('rosie-reading-audio-signout', abort)
    }
  },
})

/** Session-store dedupe; remounts reuse the manifest. Periodic/token refreshes
 * renew the HttpOnly media cookie without putting credentials in audio URLs. */
export function useBaiduReadingAudio(user: User | null) {
  const { data: keys } = audioKeysStore.useSessionData(user)
  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    const renew = () => { void audioKeysStore.refreshInBackground(userId).catch(() => {}) }
    // Authentication-cookie expiry is independent of the cached directory data.
    // Re-establish only after expiry or a different login; ready remounts reuse it.
    const renewIfNeeded = () => {
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user.id === userId && (
          !postedSession || postedSession.token !== data.session.access_token || postedSession.validUntil <= Date.now()
        )) renew()
      }).catch(() => {})
    }
    renewIfNeeded()
    window.addEventListener('focus', renewIfNeeded)
    const interval = window.setInterval(renew, 10 * 60_000)
    let refreshTimer: number | undefined
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        postedSession = null
        audioKeysStore.invalidate(userId)
      } else if (event === 'TOKEN_REFRESHED' && session?.user.id === userId) {
        // Do not call getSession while Supabase's auth callback holds its lock.
        window.clearTimeout(refreshTimer)
        refreshTimer = window.setTimeout(renew, 0)
      }
    })
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', renewIfNeeded)
      window.clearTimeout(refreshTimer)
      data.subscription.unsubscribe()
    }
  }, [userId])
  const hasAudio = useCallback((key: string) => Boolean(userId) && keys.includes(key), [keys, userId])
  return { hasAudio }
}
