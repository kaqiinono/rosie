'use client'

import Link from 'next/link'
import {
  AdaptivePlanManage,
  EnglishWeeklyPlanManage,
  WordsProvider,
  useWordsContext,
} from '@rosie/english'

function EnglishPlanManageBody() {
  const { vocab } = useWordsContext()
  return (
    <>
      <EnglishWeeklyPlanManage vocab={vocab} />
      <div className="mx-auto max-w-[1280px] px-4">
        <div className="border-t border-[var(--wm-border)]" />
      </div>
      <AdaptivePlanManage />
    </>
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
          <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4">
            <Link
              href="/admin/plans"
              className="flex h-9 w-9 items-center justify-center rounded-full no-underline text-[#93c5fd]"
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
