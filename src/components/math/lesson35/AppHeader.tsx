'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ProblemSet } from '@/utils/type'
import { NAV_PAGES } from '@/utils/constant'
import { useAuth } from '@/contexts/AuthContext'
import { useLesson35 } from './Lesson35Provider'
import LoginModal from './LoginModal'

const BASE = '/math/ny/35'
const PATH_MAP: Record<string, string> = {
  home: BASE,
  lesson: `${BASE}/lesson`,
  homework: `${BASE}/homework`,
  workbook: `${BASE}/workbook`,
  alltest: `${BASE}/alltest`,
  pretest: `${BASE}/pretest`,
  mistakes: `${BASE}/mistakes`,
}

interface AppHeaderProps {
  problems: ProblemSet
}

export default function AppHeader({ problems }: AppHeaderProps) {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { solveCount } = useLesson35()
  const [showLogin, setShowLogin] = useState(false)

  const total = Object.values(problems).reduce((s, l) => s + l.length, 0)
  const mastered = Object.values(solveCount).filter(c => c >= 3).length

  function isActive(key: string) {
    if (key === 'home') return pathname === BASE
    return pathname.startsWith(PATH_MAP[key])
  }

  // Abbreviate email for display: meinuo@gmail.com → meinuo
  const displayName = user?.email?.split('@')[0] ?? ''

  return (
    <>
      <div className="sticky top-0 z-30 shrink-0 border-b border-border-light bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-5">

          {/* Logo */}
          <Link href={BASE} className="whitespace-nowrap text-[17px] font-bold text-text-primary no-underline">
            🐦 <span className="text-yellow-dark">归一</span>问题探险
          </Link>

          {/* Progress chip */}
          <div className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-[12px] font-semibold text-text-secondary">
            🦋 <span className="text-app-green-dark">{mastered}</span>
            <span className="text-text-muted">/ {total}</span>
          </div>

          {/* Nav links — only visible between lg and xl (sidebar hidden at that breakpoint) */}
          <div className="hidden gap-0 overflow-x-auto scrollbar-none lg:flex xl:hidden">
            {NAV_PAGES.map(p => {
              const active = isActive(p.key)
              return (
                <Link
                  key={p.key}
                  href={PATH_MAP[p.key] || BASE}
                  className={`flex h-14 items-center whitespace-nowrap px-3 text-[13px] font-medium no-underline transition-all ${
                    active ? 'text-yellow-dark' : 'text-text-muted hover:text-text-secondary'
                  }`}
                  style={{ borderBottom: `2px solid ${active ? '#f59e0b' : 'transparent'}` }}
                >
                  {p.icon} {p.label}
                </Link>
              )
            })}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* User area */}
          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-app-blue text-[11px] font-bold text-white">
                  {displayName[0]?.toUpperCase()}
                </div>
                <span className="hidden max-w-[100px] truncate text-[12px] font-medium text-text-secondary sm:block">
                  {displayName}
                </span>
              </div>
              <button
                onClick={() => signOut()}
                className="rounded-full border border-border-light px-3 py-1.5 text-[12px] font-medium text-text-muted transition-colors hover:border-gray-300 hover:text-text-primary"
              >
                退出
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="rounded-full bg-app-blue px-4 py-1.5 text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(59,130,246,0.3)] transition-opacity hover:opacity-90"
            >
              ☁️ 登录
            </button>
          )}
        </div>
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  )
}
