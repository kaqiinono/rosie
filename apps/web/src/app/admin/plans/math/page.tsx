'use client'

import Link from 'next/link'
import MathWeeklyPlanManage from '@rosie/math/components/MathWeeklyPlanManage'

export default function AdminMathPlansPage() {
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
          borderBottom: '2px solid rgba(251,146,60,.2)',
        }}
      >
        <div className="mx-auto flex h-14 max-w-[800px] items-center gap-3 px-4">
          <Link
            href="/admin/plans"
            className="flex h-9 w-9 items-center justify-center rounded-full no-underline"
            style={{ background: 'rgba(251,146,60,.12)', border: '1.5px solid rgba(251,146,60,.3)', color: '#c2410c' }}
          >
            <span className="text-[14px] font-bold">←</span>
          </Link>
          <span className="text-[17px] font-extrabold text-orange-800">数学计划管理</span>
        </div>
      </div>
      <MathWeeklyPlanManage />
    </div>
  )
}
