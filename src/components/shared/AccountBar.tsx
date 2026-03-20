'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

export default function AccountBar() {
  const { user, signOut, loading } = useAuth()
  const [immersive, setImmersive] = useState(false)

  useEffect(() => {
    const check = () => setImmersive(document.body.classList.contains('words-immersive'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  if (loading || immersive) return null

  if (!user) {
    return (
      <div className="fixed top-3 right-4 z-50">
        <Link
          href="/auth"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm"
          style={{ background: 'rgba(99,102,241,0.12)', border: '1.5px solid rgba(99,102,241,0.3)', color: '#818cf8' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          未登录
        </Link>
      </div>
    )
  }

  const username = user.email?.replace('@rosie.app', '') ?? user.email?.split('@')[0]

  return (
    <div className="fixed top-3 right-4 z-50 flex items-center gap-1.5">
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
        style={{ background: 'rgba(34,197,94,0.1)', border: '1.5px solid rgba(34,197,94,0.3)', color: '#4ade80' }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
        {username}
      </div>
      <button
        onClick={() => signOut()}
        className="px-2.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all"
        style={{ background: 'rgba(0,0,0,0.06)', border: '1.5px solid rgba(0,0,0,0.1)', color: '#94a3b8' }}
      >
        退出
      </button>
    </div>
  )
}
