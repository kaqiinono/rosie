'use client'

import { useEffect } from 'react'
import { supabase, useAuth } from '@rosie/core'
import { getOfflineOwner, readOfflineState } from '@/lib/offline/store'
import { useOfflineOwner } from './OfflineEntry'

const PROBE_INTERVAL_MS = 45_000
const RETRY_MS = 2_000

export function useOfflineRouting(mode: 'home' | 'offline' | null) {
  const owner = useOfflineOwner()
  const { user } = useAuth()
  const userId = user?.id

  useEffect(() => {
    if (!mode || !owner) return
    if (mode === 'offline' && !new URLSearchParams(window.location.search).has('auto')) return

    let active = true
    let running = false
    let retry: number | undefined
    let known: { day: string; revision: number } | undefined
    const pack = readOfflineState(owner).then((state) => state?.pack).catch(() => undefined)

    function navigate(path: string) {
      if (active && getOfflineOwner() === owner) {
        active = false
        window.location.replace(path)
      }
    }

    async function check(retryFailure = true) {
      if (!active || running || document.visibilityState === 'hidden') return
      running = true
      try {
        const saved = await pack
        if (!saved || !active || getOfflineOwner() !== owner) return
        if (!navigator.onLine) {
          if (mode === 'home') navigate('/offline?auto=1')
          return
        }
        if (userId !== owner) return

        const { data, error } = await supabase.auth.getSession()
        if (error && (error.name === 'AuthRetryableFetchError' || error.status === 0 || (error.status ?? 0) >= 500)) {
          throw error
        }
        if (!active || data.session?.user.id !== owner) return
        known ??= saved.tree && { day: saved.day, revision: saved.tree.revision }
        const query = known
          ? '?' + new URLSearchParams({ knownDay: known.day, knownRevision: String(known.revision) })
          : ''
        const response = await fetch('/api/time-tree' + query, {
          cache: 'no-store',
          headers: { Authorization: 'Bearer ' + data.session.access_token },
          signal: AbortSignal.timeout(5_000),
        })

        if (mode === 'home') {
          if (response.status >= 500) throw new Error('Online service unavailable')
          window.clearTimeout(retry)
          if (response.status === 200) {
            const scene = await response.json().catch(() => null)
            if (Number.isSafeInteger(scene?.revision) && typeof scene?.tree?.today === 'string') {
              known = { day: scene.tree.today, revision: scene.revision }
            }
          }
        } else if (response.ok) {
          const home = await fetch('/', { cache: 'no-store', signal: AbortSignal.timeout(5_000) })
          if (home.ok && !home.redirected) navigate('/')
        }
      } catch {
        if (!active || mode !== 'home') return
        if (retryFailure && navigator.onLine) {
          window.clearTimeout(retry)
          retry = window.setTimeout(() => { void check(false) }, RETRY_MS)
        } else {
          navigate('/offline?auto=1')
        }
      } finally {
        running = false
      }
    }

    const refresh = () => { void check() }
    const disconnected = () => {
      if (mode === 'home') void pack.then((saved) => {
        if (saved && !navigator.onLine) navigate('/offline?auto=1')
      })
    }
    const timer = window.setInterval(refresh, PROBE_INTERVAL_MS)
    refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    window.addEventListener('offline', disconnected)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      active = false
      window.clearInterval(timer)
      window.clearTimeout(retry)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', disconnected)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [mode, owner, userId])
}
