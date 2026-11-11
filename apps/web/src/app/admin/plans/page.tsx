'use client'

import Link from 'next/link'
import { PageShell, StickerCard } from '@rosie/ui'

const PLAN_MODULES = [
  {
    href: '/setting/plans/math',
    emoji: '📐',
    title: '数学计划',
    description: '按关卡、题型与日期分配每日数学题',
    tone: 'accent',
  },
  {
    href: '/setting/plans/english',
    emoji: '📖',
    title: '英语计划',
    description: '多日计划与自适应计划：按词库、课程分配，或按掌握度自动推进',
    tone: 'info',
  },
  {
    href: '/setting/plans/chinese',
    emoji: '📜',
    title: '语文计划',
    description: '按教材路线图推进：控制关卡与题型，暂停/恢复，查看每关练习记录',
    tone: 'warning',
  },
] as const

export default function AdminPlansHubPage() {
  return (
    <PageShell
      tone="sky"
      width="narrow"
      backHref="/setting"
      backLabel="返回用户配置"
      icon="🗂️"
      title="计划中心"
    >
      <p className="mb-5 text-[13px] text-slate-500">
        在这里为各模块创建与修改学习计划。孩子端做题页只负责查看和执行。
      </p>
      <div className="flex flex-col gap-3">
        {PLAN_MODULES.map((mod) => (
          <Link key={mod.href} href={mod.href} className="block no-underline">
            <StickerCard
              tone={mod.tone}
              interactive
              radius="md"
              className="flex items-center gap-4"
            >
              <span className="text-3xl">{mod.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-extrabold text-slate-800">{mod.title}</div>
                <div className="mt-0.5 text-[12px] text-slate-500">{mod.description}</div>
              </div>
              <span className="text-[13px] font-bold text-slate-500">→</span>
            </StickerCard>
          </Link>
        ))}
      </div>
    </PageShell>
  )
}
