'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  AdaptivePlanManage,
  EnglishWeeklyPlanManage,
  WordsProvider,
  useWordsContext,
} from '@rosie/english'

type PlanTab = 'multi' | 'adaptive'

function EnglishPlanManageBody() {
  const { vocab } = useWordsContext()
  const [tab, setTab] = useState<PlanTab>('multi')

  return (
    <div className="mx-auto max-w-[800px] px-4 py-6">
      <div
        className="mb-6 inline-flex rounded-xl border border-[var(--wm-border)] bg-white/[.03] p-1"
        role="tablist"
        aria-label="英语计划类型"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'multi'}
          onClick={() => setTab('multi')}
          className={`cursor-pointer rounded-lg px-4 py-2 text-[13px] font-extrabold transition-colors ${
            tab === 'multi'
              ? 'bg-[rgba(245,158,11,.15)] text-[#fbbf24]'
              : 'text-[var(--wm-text-dim)] hover:text-[#fbbf24]'
          }`}
        >
          多日计划
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'adaptive'}
          onClick={() => setTab('adaptive')}
          className={`cursor-pointer rounded-lg px-4 py-2 text-[13px] font-extrabold transition-colors ${
            tab === 'adaptive'
              ? 'bg-[rgba(139,92,246,.15)] text-[#c4b5fd]'
              : 'text-[var(--wm-text-dim)] hover:text-[#c4b5fd]'
          }`}
        >
          自适应计划
        </button>
      </div>

      {tab === 'multi' ? <EnglishWeeklyPlanManage vocab={vocab} /> : null}
      {tab === 'adaptive' ? <AdaptivePlanManage /> : null}
    </div>
  )
}

export default function AdminEnglishPlansPage() {
  return (
    <WordsProvider>
      <div
        className="min-h-screen font-nunito text-[15px]"
        style={{ background: 'var(--wm-bg)', color: 'var(--wm-text)' }}
      >
        <div
          className="sticky top-0 z-30 border-b border-[var(--wm-border)]"
          style={{ background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(12px)' }}
        >
          <div className="mx-auto flex h-14 max-w-[800px] items-center gap-3 px-4">
            <Link
              href="/admin/plans"
              className="flex h-9 w-9 items-center justify-center rounded-full no-underline text-[#93c5fd] transition-colors hover:text-[#bfdbfe]"
              style={{ background: 'rgba(96,165,250,.12)', border: '1.5px solid rgba(96,165,250,.3)' }}
            >
              <span className="text-[14px] font-bold">←</span>
            </Link>
            <span className="text-[17px] font-extrabold text-[#e2e8f0]">英语计划管理</span>
          </div>
        </div>
        <EnglishPlanManageBody />
      </div>
    </WordsProvider>
  )
}
