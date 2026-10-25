'use client'

import { useEffect } from 'react'
import { supabase } from '@rosie/core'

/** Keep logout cleanup active even after leaving the reading pages. */
export default function BaiduAudioSessionCleanup() {
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        window.dispatchEvent(new Event('rosie-reading-audio-signout'))
        void fetch('/api/baidu/audio/session', {
          method: 'DELETE', credentials: 'same-origin',
        }).catch(() => {})
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])
  return null
}
