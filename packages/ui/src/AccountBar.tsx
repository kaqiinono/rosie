'use client'

import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { useImmersive } from '@rosie/core'

type AccountBarProps = {
  /** `header` — compact neutral chrome for in-page toolbars (e.g. math lesson nav). */
  variant?: 'default' | 'header'
}

const HEADER_ICON_BTN =
  'inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-gray-200/90 bg-white text-text-muted transition-colors hover:border-gray-300 hover:bg-gray-50 sm:h-9 sm:w-9'

export default function AccountBar({ variant = 'default' }: AccountBarProps) {
  const { user, signOut, loading } = useAuth()
  const { isImmersive } = useImmersive()

  if (loading || isImmersive) return null

  if (variant === 'header') {
    if (!user) {
      return (
        <Link
          href="/auth"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200/90 bg-white px-2.5 text-[11px] font-semibold text-text-secondary no-underline transition-colors hover:border-gray-300 hover:bg-gray-50 sm:h-9 sm:px-3 sm:text-[12px]"
          title="登录"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className="hidden sm:inline">登录</span>
        </Link>
      )
    }

    const username = user.email?.replace('@rosie.app', '') ?? user.email?.split('@')[0] ?? ''
    const initial = username.charAt(0).toUpperCase() || 'U'

    return (
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <div
          className="inline-flex h-8 max-w-[9rem] items-center gap-1.5 rounded-lg border border-gray-200/90 bg-white px-2 text-[11px] font-semibold text-text-secondary sm:h-9 sm:max-w-[10rem] sm:px-2.5 sm:text-[12px]"
          title={username}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gray-100 text-[10px] font-bold text-text-secondary sm:h-[22px] sm:w-[22px] sm:text-[11px]">
            {initial}
          </span>
          <span className="hidden truncate sm:inline">{username}</span>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className={HEADER_ICON_BTN}
          title="退出登录"
          aria-label="退出登录"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    )
  }

  if (!user) {
    return (
      <Link
        href="/auth"
        className="flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold no-underline transition-all"
        style={{
          background: 'rgba(99,102,241,0.12)',
          border: '1.5px solid rgba(99,102,241,0.3)',
          color: '#818cf8',
        }}
        title="登录"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
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
        style={{
          background: 'rgba(34,197,94,0.1)',
          border: '1.5px solid rgba(34,197,94,0.3)',
          color: '#4ade80',
        }}
        title={username}
      >
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-green-400" />
        <span className="hidden max-w-[120px] truncate sm:inline">{username}</span>
        <span className="font-extrabold sm:hidden">{initial}</span>
      </div>
      <button
        type="button"
        onClick={() => signOut()}
        className="flex h-9 cursor-pointer items-center justify-center rounded-full px-2.5 text-xs font-bold transition-all"
        style={{
          background: 'rgba(0,0,0,0.06)',
          border: '1.5px solid rgba(0,0,0,0.1)',
          color: '#94a3b8',
        }}
        title="退出登录"
        aria-label="退出登录"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span className="ml-1 hidden sm:inline">退出</span>
      </button>
    </div>
  )
}
