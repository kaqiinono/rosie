'use client'

import { useEffect } from 'react'
import { supabase } from '@rosie/core'

/** Application-owned cleanup keeps core independent from the exam module. */
export default function ExamSessionLifecycle() {
  useEffect(() => {
    let previousToken: string | null = null
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        const token = previousToken
        previousToken = null
        void fetch('/api/exams/media/session', { method: 'DELETE', credentials: 'same-origin', keepalive: true }).catch(() => undefined)
        if (token) void fetch('/api/exams/parent-session/revoke', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, keepalive: true }).catch(() => undefined)
      } else if (session) previousToken = session.access_token
    })
    return () => { previousToken = null; data.subscription.unsubscribe() }
  }, [])
  return null
}
