'use client'

let lease: symbol | null = null
const listeners = new Set<() => void>()

export function ordinaryPlaybackAllowed() { return lease === null }
export function subscribePlaybackLease(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function acquirePlaybackLease(): (() => void) | null {
  if (lease !== null) return null
  const token = Symbol('playback-program')
  lease = token
  listeners.forEach(listener => listener())
  return () => {
    if (lease !== token) return
    lease = null
    listeners.forEach(listener => listener())
  }
}
