'use client'

import Link from 'next/link'

const PLAN_MODULES = [
  {
    href: '/admin/plans/math',
    emoji: '📐',
    title: '数学计划',
    description: '按关卡、题型与日期分配每日数学题',
    color: '#ea580c',
    bg: 'rgba(251,146,60,.08)',
    border: 'rgba(251,146,60,.25)',
  },
  {
    href: '/admin/plans/english',
    emoji: '📖',
    title: '英语计划',
    description: '多日计划与自适应计划：按词库、课程分配，或按掌握度自动推进',
    color: '#2563eb',
    bg: 'rgba(59,130,246,.08)',
    border: 'rgba(59,130,246,.25)',
  },
] as const

export default function AdminPlansHubPage() {
  return (
    <div
      className="min-h-screen text-[15px]"
      style={{
        background: 'linear-gradient(160deg, #fff8f0 0%, #f0f9ff 50%, #fef9ec 100%)',
        fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      }}
    >
      <div
        className="sticky top-0 z-30"
        style={{
          background: 'rgba(255,252,245,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1.5px solid rgba(251,146,60,.15)',
        }}
      >
        <div className="mx-auto flex h-14 max-w-[640px] items-center gap-3 px-4">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-full no-underline"
            style={{ background: 'rgba(251,146,60,.1)', border: '1.5px solid rgba(251,146,60,.25)', color: '#c2410c' }}
          >
            <span className="text-[14px] font-bold">←</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xl">🗂️</span>
            <span className="text-[17px] font-extrabold text-orange-900">计划中心</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[640px] px-4 py-6">
        <p className="mb-5 text-[13px] text-gray-500">
          在这里为各模块创建与修改学习计划。孩子端做题页只负责查看和执行。
        </p>
        <div className="flex flex-col gap-3">
          {PLAN_MODULES.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className="flex items-center gap-4 rounded-2xl px-4 py-4 no-underline transition-all hover:-translate-y-0.5"
              style={{ background: mod.bg, border: `2px solid ${mod.border}` }}
            >
              <span className="text-3xl">{mod.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-extrabold" style={{ color: mod.color }}>
                    {mod.title}
                  </span>
                </div>
                <div className="mt-0.5 text-[12px] text-gray-500">{mod.description}</div>
              </div>
              <span className="text-[13px] font-bold" style={{ color: mod.color }}>
                →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
