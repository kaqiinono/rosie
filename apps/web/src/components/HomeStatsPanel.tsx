'use client'

import { StickerCard } from '@rosie/ui'
import { lazy, Suspense, useState } from 'react'
import { useAuth } from '@rosie/core'

const HomeStatsGrid = lazy(() => import('./HomeStatsGrid'))

export default function HomeStatsPanel() {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  if (!user) return null

  return (
    <section className="w-full max-w-[1040px]">
      <StickerCard asChild interactive size="none" elevation="sm" radius="md">
        <button // native-ok: 整块可点击容器（内含多行内容），Radix Button 是 inline-flex 居中，不适用
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
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
      </StickerCard>

      {expanded && (
        <Suspense
          fallback={
            <p role="status" className="text-text-secondary mt-3 text-sm">
              正在加载学习概览…
            </p>
          }
        >
          <HomeStatsGrid />
        </Suspense>
      )}
    </section>
  )
}
