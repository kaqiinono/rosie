'use client'

import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { useImmersive } from '@/contexts/ImmersiveContext'

export default function AccountBar() {
  const { user, signOut, loading } = useAuth()
  const { isImmersive } = useImmersive()

  if (loading || isImmersive) return null

  if (!user) {
    return (
      <Link
        href="/auth"
        className="flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold no-underline transition-all"
        style={{ background: 'rgba(99,102,241,0.12)', border: '1.5px solid rgba(99,102,241,0.3)', color: '#818cf8' }}
        title="登录"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
        <span className="hidden sm:inline">未登录</span>
      </Link>
    )
  }

  const username = user.email?.replace('@rosie.app', '') ?? user.email?.split('@')[0] ?? ''
  const initial = username.charAt(0).toUpperCase() || 'U'

  return (
    <div className="flex items-center gap-1">
      <div
        className="flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold sm:px-3"
        style={{ background: 'rgba(34,197,94,0.1)', border: '1.5px solid rgba(34,197,94,0.3)', color: '#4ade80' }}
        title={username}
      >
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-green-400" />
        <span className="hidden max-w-[120px] truncate sm:inline">{username}</span>
        <span className="sm:hidden font-extrabold">{initial}</span>
      </div>
      <button
        onClick={() => signOut()}
        className="flex h-9 cursor-pointer items-center justify-center rounded-full px-2.5 text-xs font-bold transition-all"
        style={{ background: 'rgba(0,0,0,0.06)', border: '1.5px solid rgba(0,0,0,0.1)', color: '#94a3b8' }}
        title="退出登录"
        aria-label="退出登录"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span className="ml-1 hidden sm:inline">退出</span>
      </button>
    </div>
  )
}
