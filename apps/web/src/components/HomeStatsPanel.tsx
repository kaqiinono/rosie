'use client'

import { lazy, Suspense, useState } from 'react'
import { useAuth } from '@rosie/core'

const HomeStatsGrid = lazy(() => import('./HomeStatsGrid'))

export default function HomeStatsPanel() {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  if (!user) return null

  return (
    <section className="w-full max-w-[1040px]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 text-left shadow-sm backdrop-blur-sm transition hover:border-indigo-200 hover:bg-white"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-base leading-none" aria-hidden>
            📊
          </span>
          <span className="text-text-primary text-[13px] font-extrabold tracking-wide">
            学习概览
          </span>
          {!expanded && (
            <span className="text-text-muted truncate text-[11px] font-semibold">
              点击展开查看各科进度
            </span>
          )}
        </span>
        <span
          className={`text-text-muted shrink-0 text-xs font-bold transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden
        >
          ▼
        </span>
      </button>

      {expanded && (
        <Suspense fallback={<p role="status" className="mt-3 text-sm text-text-secondary">正在加载学习概览…</p>}>
          <HomeStatsGrid />
        </Suspense>
      )}
    </section>
  )
}
