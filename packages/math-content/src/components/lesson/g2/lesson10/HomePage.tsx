'use client'

import Link from 'next/link'
import type { Problem, ProblemSet } from '@rosie/core'
import { PROBLEM_TYPES, TYPE_STYLE } from '@rosie/math-content/utils/g2/lesson10-data'

const BASE = '/math/ny/2/10'
type Props = { problems: ProblemSet; practiceCount: Record<string, number>; correctCount: Record<string, number> }
export default function HomePage({ problems, practiceCount, correctCount }: Props) {
  const all = (Object.values(problems) as Problem[][]).flat()
  const attempted = all.filter((problem) => (practiceCount[problem.id] ?? 0) > 0).length
  const mastered = all.filter((problem) => (correctCount[problem.id] ?? 0) >= 3).length
  return <div><div className="relative mb-5 overflow-hidden rounded-[14px] bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-100 p-6"><div className="pointer-events-none absolute -top-3 -right-2 text-[90px] opacity-10">🐔</div><h1 className="mb-1.5 text-2xl font-extrabold text-amber-900">鸡兔同笼初步 🐔🐇</h1><p className="text-[13px] leading-relaxed text-amber-800">二年级目标班 · 第10讲<br />头和腿和用假设法；倍数关系先变整倍，再按一组来分。</p></div><div className="mb-4 rounded-[14px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.07)]"><div className="mb-2 text-[15px] font-bold">🧠 三类解题方法</div><div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{PROBLEM_TYPES.map((type) => { const style = TYPE_STYLE[type.tag]; const count = all.filter((p) => p.tag === type.tag).length; return <Link key={type.tag} href={`${BASE}/alltest?type=${type.tag}`} className={`rounded-r-lg border-l-3 p-3 no-underline transition hover:shadow-md ${style.bg} ${style.border}`}><div className={`mb-1 text-xs font-bold ${style.titleColor}`}>{type.icon} {type.label} · {count}题</div><div className={`text-xs leading-relaxed ${style.textColor}`}>{type.desc}<em className="mt-0.5 block opacity-75">例：{type.example}</em></div></Link> })}</div></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Link href={`${BASE}/lesson`} className="flex items-center gap-3 rounded-[14px] bg-white p-4 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)]"><div className="flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-amber-50 text-[22px]">📖</div><div><div className="text-sm font-bold">课堂讲解</div><div className="text-text-muted text-xs">18道 · 假设法、分组法与变型题</div></div></Link><Link href={`${BASE}/alltest`} className="flex items-center gap-3 rounded-[14px] border-2 border-amber-300 bg-white p-4 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)]"><div className="flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-amber-50 text-[22px]">🎯</div><div><div className="text-sm font-bold text-amber-700">综合题库</div><div className="text-text-muted text-xs">已练 {attempted}/{all.length} · 掌握 {mastered}/{all.length}</div></div></Link></div></div>
}
