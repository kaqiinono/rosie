'use client'

import Link from 'next/link'
import TodayPlanOverview from '@/components/today/TodayPlanOverview'

export default function HomeTodayPanel() {
  return (
    <section className="w-full max-w-[1040px]">
      <div className="mb-3 flex items-center justify-between px-0.5">
        <h2 className="text-text-primary text-[13px] font-extrabold tracking-wide">
          🗓️ 今日计划
        </h2>
        <Link
          href="/today"
          className="text-[12px] font-bold text-amber-700 no-underline transition-opacity hover:opacity-70"
        >
          查看全部 →
        </Link>
      </div>
      <TodayPlanOverview
        linkable
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        loadingFallback={
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[108px] animate-pulse rounded-2xl bg-slate-100/80"
              />
            ))}
          </div>
        }
      />
    </section>
  )
}
