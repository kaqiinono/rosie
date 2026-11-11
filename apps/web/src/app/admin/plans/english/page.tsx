'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  AdaptivePlanManage,
  EnglishWeeklyPlanManage,
  WordsProvider,
  useWordsContext,
} from '@rosie/english'
import { DarkScope } from '@rosie/ui'
import { Button } from '@rosie/ui/themes'

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
        <Button
          type="button"
          role="tab"
          aria-selected={tab === 'multi'}
          onClick={() => setTab('multi')}
          variant={tab === 'multi' ? 'soft' : 'ghost'}
          color={tab === 'multi' ? 'amber' : 'gray'}
          size="2"
        >
          多日计划
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={tab === 'adaptive'}
          onClick={() => setTab('adaptive')}
          variant={tab === 'adaptive' ? 'soft' : 'ghost'}
          color={tab === 'adaptive' ? 'violet' : 'gray'}
          size="2"
        >
          自适应计划
        </Button>
      </div>

      {tab === 'multi' ? <EnglishWeeklyPlanManage vocab={vocab} /> : null}
      {tab === 'adaptive' ? <AdaptivePlanManage /> : null}
    </div>
  )
}

export default function AdminEnglishPlansPage() {
  return (
    <WordsProvider>
      <DarkScope>
        <div
          className="font-nunito min-h-screen text-[15px]"
          style={{ background: 'var(--wm-bg)', color: 'var(--wm-text)' }}
        >
          <div
            className="sticky top-0 z-30 border-b border-[var(--wm-border)]"
            style={{ background: 'rgb(15,23,42)' }}
          >
            <div className="mx-auto flex h-14 max-w-[800px] items-center gap-3 px-4">
              <Link
                href="/setting/plans"
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#93c5fd] no-underline transition-colors hover:text-[#bfdbfe]"
                style={{
                  background: 'rgba(96,165,250,.12)',
                  border: '1.5px solid rgba(96,165,250,.3)',
                }}
              >
                <span className="text-[14px] font-bold">←</span>
              </Link>
              <span className="text-[17px] font-extrabold text-[#e2e8f0]">英语计划管理</span>
            </div>
          </div>
          <EnglishPlanManageBody />
        </div>
      </DarkScope>
    </WordsProvider>
  )
}
