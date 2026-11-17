'use client'

import { useEffect } from 'react'

export function useScreenWakeLock(until: number | null) {
  useEffect(() => {
    if (until === null || !Number.isFinite(until) || until <= Date.now() || !navigator.wakeLock) return

    const deadline = until
    let lock: WakeLockSentinel | null = null
    let requestId = 0

    function release() {
      requestId++
      const held = lock
      lock = null
      if (held && !held.released) void held.release().catch(() => {})
    }

    async function acquire() {
      if (document.hidden || Date.now() >= deadline || (lock && !lock.released)) return
      const id = ++requestId
      try {
        const held = await navigator.wakeLock.request('screen')
        if (id !== requestId || document.hidden || Date.now() >= deadline) {
          await held.release()
          return
        }
        lock = held
      } catch {
        // The browser or device may decline the lock while timing continues.
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) release()
      else void acquire()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    const expiry = window.setTimeout(release, Math.max(0, deadline - Date.now()))
    void acquire()
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.clearTimeout(expiry)
      release()
    }
  }, [until])
}
