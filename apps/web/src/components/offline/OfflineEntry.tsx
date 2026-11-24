'use client'

import { useEffect, useRef, useState } from 'react'
import { AUTH_DEVICE_SIGN_OUT, AUTH_PASSWORD_SIGN_IN, useAuth } from '@rosie/core'
import { Button } from '@rosie/ui/themes'
import { getOfflineOwner, OFFLINE_CHANGED, getOfflineSyncStatus, readOfflineState, setOfflineOwner,
  setOfflineSyncStatus } from '@/lib/offline/store'

export function useOfflineOwner() {
  const { user } = useAuth()
  const userId = user?.id
  const [owner, setOwner] = useState<string | null>(null)

  useEffect(() => {
    function refresh() {
      const saved = getOfflineOwner()
      setOwner(saved && (!userId || saved === userId) ? saved : null)
    }
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener(OFFLINE_CHANGED, refresh)
    window.addEventListener('pageshow', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener(OFFLINE_CHANGED, refresh)
      window.removeEventListener('pageshow', refresh)
    }
  }, [userId])

  return owner && (!userId || owner === userId) ? owner : null
}

export function OfflineAccount() {
  const { user } = useAuth()
  const userId = user?.id
  const stopped = useRef(0)

  useEffect(() => {
    const lock = () => {
      stopped.current++
      setOfflineOwner(null)
    }
    const unlock = (event: Event) => {
      const owner = (event as CustomEvent<string>).detail
      const attempt = ++stopped.current
      void readOfflineState(owner).then((state) => {
        if (stopped.current === attempt && state?.pack) setOfflineOwner(owner)
      }).catch(() => undefined)
    }
    window.addEventListener(AUTH_DEVICE_SIGN_OUT, lock)
    window.addEventListener(AUTH_PASSWORD_SIGN_IN, unlock)
    return () => {
      stopped.current++
      window.removeEventListener(AUTH_DEVICE_SIGN_OUT, lock)
      window.removeEventListener(AUTH_PASSWORD_SIGN_IN, unlock)
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    const previous = getOfflineOwner()
    if (previous && previous !== userId) setOfflineOwner(null)
    let active = true
    let syncing = false
    async function flush() {
      if (!active || syncing || !userId || getOfflineOwner() !== userId || !navigator.onLine) return
      syncing = true
      try {
        const state = await readOfflineState(userId)
        if (!active || !state?.queue.length) return
        const { syncOfflineQueue } = await import('@/lib/offline/sync')
        const message = await syncOfflineQueue(userId)
        if (active && getOfflineOwner() === userId) setOfflineSyncStatus(message ?? '')
      } catch {
        if (active && getOfflineOwner() === userId) setOfflineSyncStatus('暂时无法同步，记录已保存在本机。')
      } finally {
        syncing = false
      }
    }
    const refresh = () => { void flush() }
    const timer = window.setInterval(refresh, 30_000)
    refresh()
    window.addEventListener('online', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener(OFFLINE_CHANGED, refresh)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('online', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener(OFFLINE_CHANGED, refresh)
    }
  }, [userId])

  return null
}

export function useOfflineSyncStatus() {
  const [status, setStatus] = useState('')
  useEffect(() => {
    const refresh = () => setStatus(getOfflineSyncStatus())
    refresh()
    window.addEventListener(OFFLINE_CHANGED, refresh)
    return () => window.removeEventListener(OFFLINE_CHANGED, refresh)
  }, [])
  return status
}

export function OfflineEntry() {
  const owner = useOfflineOwner()
  const [prepared, setPrepared] = useState<string | null>(null)
  useEffect(() => {
    if (!owner) return
    let active = true
    void readOfflineState(owner).then((state) => {
      if (active) setPrepared(state?.pack ? owner : null)
    }).catch(() => { if (active) setPrepared(null) })
    return () => { active = false }
  }, [owner])
  if (!owner || prepared !== owner) return null

  return (
    <Button asChild size="3" variant="outline" color="gray">
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- The service worker handles a document navigation. */}
      <a href="/offline">离线使用</a>
    </Button>
  )
}
