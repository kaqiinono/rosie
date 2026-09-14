'use client'

import Link from 'next/link'
import type { Problem, ProblemSet } from '@rosie/core'
import { PROBLEM_TYPES, TYPE_STYLE } from '@rosie/math-content/utils/g2/lesson9-data'

const BASE = '/math/ny/2/9'
type Props = { problems: ProblemSet; practiceCount: Record<string, number>; correctCount: Record<string, number> }
const MODULES = [
  { key: 'pretest', path: BASE + '/pretest', icon: '📝', bg: 'bg-yellow-50', title: '课前测', desc: '7道 · 乘除法巧算摸底' },
  { key: 'lesson', path: `${BASE}/lesson`, icon: '📖', bg: 'bg-amber-50', title: '课堂讲解', desc: '86道 · 巧算方法与特殊运算' },
  { key: 'homework', path: `${BASE}/homework`, icon: '✏️', bg: 'bg-orange-50', title: '课后巩固', desc: '41道 · 乘除法巧算综合巩固' },
] as const
const TYPE_GROUPS = [
  { key: 'foundation', icon: '🧮', title: '基础运算法', desc: '先变形、再凑整' },
  { key: 'pattern', icon: '🔍', title: '数字规律法', desc: '识别数字的重复与循环' },
  { key: 'structure', icon: '✨', title: '结构速算法', desc: '套用特定乘法结构' },
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
        <p className="text-[13px] leading-relaxed text-amber-800">二年级目标班 · 第9讲<br />从基础变形到数字规律：先认结构，再选口诀，最后验算。</p>
      </div>
      <div className="mb-4 rounded-[14px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <div className="mb-1 text-[15px] font-bold">🧠 乘除巧算 · 11类题型</div>
        <p className="text-text-muted mb-4 text-xs leading-relaxed">
          先判断属于基础变形、数字规律还是特殊结构，再点击题型进入对应练习。
        </p>
        <div className="space-y-4">
          {TYPE_GROUPS.map((group) => (
            <section key={group.key}>
              <div className="mb-2 flex items-center gap-2">
                <span>{group.icon}</span>
                <span className="text-sm font-bold text-amber-900">{group.title}</span>
                <span className="text-text-muted text-[11px]">{group.desc}</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {PROBLEM_TYPES.filter((type) => type.group === group.key).map((type) => {
                  const style = TYPE_STYLE[type.tag]
                  const count = all.filter((problem) => problem.tag === type.tag).length
                  return (
                    <Link
                      key={type.tag}
                      href={`${BASE}/alltest?type=${type.tag}`}
                      className={`rounded-r-lg border-l-3 p-3 no-underline transition-all hover:-translate-y-0.5 hover:shadow-md ${style.bg} ${style.border}`}
                    >
                      <div className={`mb-1 flex items-center justify-between gap-2 text-xs font-bold ${style.titleColor}`}>
                        <span>{type.icon} {type.label}</span>
                        <span className="shrink-0 rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-medium">{count}题</span>
                      </div>
                      <div className={`text-xs leading-relaxed ${style.textColor}`}>
                        {type.desc}
                        <em className="mt-0.5 block opacity-75">例：{type.example}</em>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
        <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
          📌 教材拓展识别：宝塔数要保证两个乘数中数字1的个数相同；尾同头合十用“前面头×头+尾，后面尾×尾（不足两位补0）”。当前题库暂无这两类独立题目。
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {MODULES.map((m) => { const p = progress(m.key); return <Link key={m.key} href={m.path} className="flex items-center gap-3 rounded-[14px] bg-white p-4 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)]"><div className={`flex h-[46px] w-[46px] items-center justify-center rounded-xl text-[22px] ${m.bg}`}>{m.icon}</div><div className="min-w-0 flex-1"><div className="text-sm font-bold">{m.title}</div><div className="text-text-muted text-xs">{m.desc}</div><div className="text-text-muted mt-1 text-[11px]">已练 {p.attempted}/{p.total} · 掌握 {p.mastered}/{p.total}</div></div><div className="text-xl text-amber-500">›</div></Link> })}
        <Link href={`${BASE}/alltest`} className="flex items-center gap-3 rounded-[14px] border-2 border-amber-300 bg-white p-4 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)]"><div className="flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-amber-50 text-[22px]">🎯</div><div className="min-w-0 flex-1"><div className="text-sm font-bold text-amber-700">综合题库</div><div className="text-text-muted text-xs">全部134道 · 按题型/来源筛选</div><div className="text-text-muted mt-1 text-[11px]">掌握 {allMastered}/{all.length}</div></div><div className="text-xl text-amber-500">›</div></Link>
      </div>
    </div>
  )
}
