'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { EnglishWeeklyPlanEditor, WordsProvider, useWordsContext } from '@rosie/english'

function EnglishPlanEditorBody({ editPlanId }: { editPlanId: string }) {
  const { vocab } = useWordsContext()
  return <EnglishWeeklyPlanEditor vocab={vocab} editPlanId={editPlanId} />
}

export default function AdminEditEnglishPlanPage() {
  const params = useParams()
  const planId = typeof params.planId === 'string' ? params.planId : ''

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
              href="/admin/plans/english"
              className="flex h-9 w-9 items-center justify-center rounded-full no-underline text-[#93c5fd]"
              style={{ background: 'rgba(96,165,250,.12)', border: '1.5px solid rgba(96,165,250,.3)' }}
            >
              <span className="text-[14px] font-bold">←</span>
            </Link>
            <span className="text-[17px] font-extrabold text-[#e2e8f0]">编辑英语计划</span>
          </div>
        </div>
        <EnglishPlanEditorBody editPlanId={planId} />
      </div>
    </WordsProvider>
  )
}
