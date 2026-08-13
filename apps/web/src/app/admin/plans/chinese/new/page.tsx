'use client'

import Link from 'next/link'
import { ChineseRoadmapPlanEditor } from '@rosie/chinese'

export default function AdminNewChinesePlanPage() {
  return (
    <div
      className="min-h-screen text-[15px]"
      style={{
        background: 'linear-gradient(160deg, #fff8f0 0%, #fff3e0 30%, #fef9ec 60%, #f0f9ff 100%)',
        fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      }}
    >
      <div
        className="sticky top-0 z-30"
        style={{
          background: 'rgba(255,248,240,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '2px solid rgba(245,158,11,.2)',
        }}
      >
        <div className="mx-auto flex h-14 max-w-[720px] items-center gap-3 pl-[52px] pr-4 sm:pl-[60px]">
          <Link
            href="/setting/plans/chinese"
            className="flex h-9 w-9 items-center justify-center rounded-full no-underline"
            style={{
              background: 'rgba(245,158,11,.12)',
              border: '1.5px solid rgba(245,158,11,.3)',
              color: '#b45309',
            }}
          >
            <span className="text-[14px] font-bold">←</span>
          </Link>
          <span className="text-[17px] font-extrabold text-amber-900">新建语文计划</span>
        </div>
      </div>
      <ChineseRoadmapPlanEditor />
    </div>
  )
}
