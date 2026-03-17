'use client'

import { useEffect } from 'react'

export function useServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
              console.log('[SW] New content available — refresh to update.')
            }
          })
        })
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err)
      })
  }, [])
}
