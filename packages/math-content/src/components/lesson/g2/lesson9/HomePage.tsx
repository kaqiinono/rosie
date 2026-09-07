'use client'

import Link from 'next/link'
import type { Problem, ProblemSet } from '@rosie/core'
import { PROBLEM_TYPES, TYPE_STYLE } from '@rosie/math-content/utils/g2/lesson9-data'

const BASE = '/math/ny/2/9'
type Props = { problems: ProblemSet; practiceCount: Record<string, number>; correctCount: Record<string, number> }
const MODULES = [
  { key: 'lesson', path: `${BASE}/lesson`, icon: '📖', bg: 'bg-amber-50', title: '课堂讲解', desc: '37道 · 凑整、抵消、分配律、公因数' },
  { key: 'homework', path: `${BASE}/homework`, icon: '✏️', bg: 'bg-orange-50', title: '课后巩固', desc: '17道 · 乘除法巧算综合巩固' },
] as const

export default function HomePage({ problems, practiceCount, correctCount }: Props) {
  const all = (Object.values(problems) as Problem[][]).flat()
  const progress = (key: keyof ProblemSet) => {
    const list = problems[key] ?? []
    return { total: list.length, attempted: list.filter((p) => (practiceCount[p.id] ?? 0) > 0).length, mastered: list.filter((p) => (correctCount[p.id] ?? 0) >= 3).length }
  }
  const allMastered = all.filter((p) => (correctCount[p.id] ?? 0) >= 3).length
  return (
    <div>
      <div className="relative mb-5 overflow-hidden rounded-[14px] bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-100 p-6">
        <div className="pointer-events-none absolute -top-3 -right-2 text-[90px] opacity-10">✖️</div>
        <h1 className="mb-1.5 text-2xl font-extrabold text-amber-900">乘除法巧算 ✨</h1>
        <p className="text-[13px] leading-relaxed text-amber-800">二年级目标班 · 第9讲<br />凑整与抵消，活用分配律，寻找并构造公因数。</p>
      </div>
      <div className="mb-4 rounded-[14px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <div className="mb-2.5 text-[15px] font-bold">🧠 乘除巧算 · 4大题型</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PROBLEM_TYPES.map((t) => { const s = TYPE_STYLE[t.tag]; return <Link key={t.tag} href={`${BASE}/alltest?type=${t.tag}`} className={`rounded-r-lg border-l-3 p-3 no-underline ${s.bg} ${s.border}`}><div className={`mb-1 text-xs font-bold ${s.titleColor}`}>{t.label}</div><div className={`text-xs leading-relaxed ${s.textColor}`}>{t.desc}<em className="mt-0.5 block opacity-80">{t.example}</em></div></Link> })}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {MODULES.map((m) => { const p = progress(m.key); return <Link key={m.key} href={m.path} className="flex items-center gap-3 rounded-[14px] bg-white p-4 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)]"><div className={`flex h-[46px] w-[46px] items-center justify-center rounded-xl text-[22px] ${m.bg}`}>{m.icon}</div><div className="min-w-0 flex-1"><div className="text-sm font-bold">{m.title}</div><div className="text-text-muted text-xs">{m.desc}</div><div className="text-text-muted mt-1 text-[11px]">已练 {p.attempted}/{p.total} · 掌握 {p.mastered}/{p.total}</div></div><div className="text-xl text-amber-500">›</div></Link> })}
        <Link href={`${BASE}/alltest`} className="flex items-center gap-3 rounded-[14px] border-2 border-amber-300 bg-white p-4 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)]"><div className="flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-amber-50 text-[22px]">🎯</div><div className="min-w-0 flex-1"><div className="text-sm font-bold text-amber-700">综合题库</div><div className="text-text-muted text-xs">全部54道 · 按题型/来源筛选</div><div className="text-text-muted mt-1 text-[11px]">掌握 {allMastered}/{all.length}</div></div><div className="text-xl text-amber-500">›</div></Link>
      </div>
    </div>
  )
}
