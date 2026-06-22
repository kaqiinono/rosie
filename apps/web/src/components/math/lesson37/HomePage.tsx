'use client'

import Link from 'next/link'
import type { ProblemSet, Problem } from '@/utils/type'
import { PROBLEM_TYPES, TYPE_STYLE } from '@/utils/lesson37-data'

const BASE = '/math/ny/37'

interface HomePageProps {
  problems: ProblemSet
  solveCount: Record<string, number>
}

const MODULES = [
  { key: 'pretest', path: `${BASE}/pretest`, icon: '📝', bg: 'bg-[#fef9c3]', title: '课前测', desc: '5道摸底题 · 检验起始水平' },
  { key: 'lesson', path: `${BASE}/lesson`, icon: '📖', bg: 'bg-app-blue-light', title: '课堂讲解', desc: '例题1-6 · 头和腿和+先求头和+双组分配+倒扣分' },
  { key: 'homework', path: `${BASE}/homework`, icon: '✏️', bg: 'bg-app-green-light', title: '课后巩固', desc: '巩固1-6 · 强化练习' },
  { key: 'workbook', path: `${BASE}/workbook`, icon: '📚', bg: 'bg-app-purple-light', title: '拓展练习', desc: '闯关1-12 · 综合挑战' },
  { key: 'supplement', path: `${BASE}/supplement`, icon: '📒', bg: 'bg-amber-50', title: '附加题', desc: '5道拓展 · 特殊条件与代数方法' },
]

export default function HomePage({ problems, solveCount }: HomePageProps) {
  const totalAll = Object.values(problems).reduce((s, l) => s + l.length, 0)
  const allProblemIds = new Set((Object.values(problems) as Problem[][]).flatMap(list => list.map(p => p.id)))
  const masteredAll = Object.entries(solveCount).filter(([id, c]) => allProblemIds.has(id) && c >= 3).length
  const attemptedAll = Object.entries(solveCount).filter(([id, c]) => allProblemIds.has(id) && c >= 1).length

  function getProgress(key: string) {
    if (key === 'alltest') {
      return { mastered: masteredAll, attempted: attemptedAll, total: totalAll }
    }
    const list = problems[key as keyof ProblemSet]
    if (!list) return { mastered: 0, attempted: 0, total: 0 }
    return {
      mastered: list.filter(p => (solveCount[p.id] ?? 0) >= 3).length,
      attempted: list.filter(p => (solveCount[p.id] ?? 0) >= 1).length,
      total: list.length,
    }
  }

  return (
    <div>
      {/* Hero */}
      <div className="relative mb-5 overflow-hidden rounded-[14px] bg-gradient-to-br from-blue-50 via-[#dbeafe] to-[#93c5fd] p-6">
        <div className="pointer-events-none absolute -right-2.5 -top-2.5 text-[90px] opacity-[0.12] rotate-[15deg]">
          🐔
        </div>
        <h1 className="mb-1.5 text-2xl font-extrabold text-[#1e3a5f]">鸡兔同笼 🐔🐰</h1>
        <p className="text-[13px] leading-relaxed text-[#1e40af]">
          第37讲 · 一年级目标班<br />掌握假设法4大题型，轻松搞定鸡兔同笼！
        </p>
      </div>

      {/* Problem Types */}
      <div className="mb-4 rounded-[14px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <div className="mb-2.5 flex items-center gap-1.5 text-[15px] font-bold">🧠 鸡兔同笼 · 5大题型</div>
        <div className="mb-3 text-[13px] leading-relaxed text-text-secondary">
          <strong className="text-text-primary">核心本质：</strong>利用
          <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">假设全是一种 → 算出差 → 差÷变化量 = 换几次</code>
          的方法。先假设所有物品都是同一种，根据多出/少了多少推算另一种的数量。
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEM_TYPES.map(t => {
            const style = TYPE_STYLE[t.tag]
            return (
              <Link
                key={t.tag}
                href={`${BASE}/alltest?type=${t.tag}`}
                className={`rounded-r-lg border-l-3 p-3 no-underline ${style.bg} ${style.border} transition-all hover:shadow-md`}
              >
                <div className={`mb-1 flex items-center justify-between text-xs font-bold ${style.titleColor}`}>
                  {t.label}
                  <span className="text-[10px] opacity-60">点击查看题目→</span>
                </div>
                <div className={`text-xs leading-relaxed ${style.textColor}`}>
                  {t.desc}
                  <em className="mt-0.5 block opacity-80">{t.example}</em>
                </div>
              </Link>
            )
          })}
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-app-blue-light p-3">
          <span className="shrink-0 text-base">⭐</span>
          <span className="text-xs leading-relaxed text-app-blue-dark">
            万能口诀：<strong>①假设全是一种 ②多/少几条 ③换一次↑↓几条 ④换几次=差÷变化量。倒扣分：差÷（正分+扣分）=错题数。</strong>
          </span>
        </div>
      </div>

      {/* Module Cards */}
      <div className="mb-2.5 text-[13px] font-bold text-text-secondary">📂 学习模块</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {MODULES.map(m => {
          const prog = getProgress(m.key)
          const masteredPct = prog.total > 0 ? Math.round((prog.mastered / prog.total) * 100) : 0
          const attemptedPct = prog.total > 0 ? Math.round((prog.attempted / prog.total) * 100) : 0
          return (
            <Link
              key={m.key}
              href={m.path}
              className="flex items-center gap-3 rounded-[14px] border-2 border-transparent bg-white p-4 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-all hover:-translate-y-px hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] active:scale-[0.98]"
            >
              <div className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl text-[22px] ${m.bg}`}>
                {m.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-text-primary">{m.title}</div>
                <div className="mb-1 text-xs text-text-muted">{m.desc}</div>
                <div className="flex items-center gap-1.5">
                  <div className="relative h-1 flex-1 overflow-hidden rounded-sm bg-gray-100">
                    <div
                      className="absolute inset-y-0 left-0 rounded-sm bg-gray-300 transition-[width] duration-500"
                      style={{ width: `${attemptedPct}%` }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 rounded-sm bg-app-green transition-[width] duration-500"
                      style={{ width: `${masteredPct}%` }}
                    />
                  </div>
                  <div className="whitespace-nowrap text-[11px] text-text-muted">
                    ✅ {prog.mastered}/{prog.total}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-xl text-text-muted">›</div>
            </Link>
          )
        })}
        {/* All-test wide card */}
        <Link
          href={`${BASE}/alltest`}
          className="flex items-center gap-3 rounded-[14px] border-2 border-[#e879f9] bg-white p-4 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-all hover:-translate-y-px hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] active:scale-[0.98]"
        >
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-[#fdf4ff] text-[22px]">
            🎯
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-[#7e22ce]">综合测试题库</div>
            <div className="mb-1 text-xs text-text-muted">全部题目 · 按题型/来源筛选 · 综合训练</div>
            <div className="flex items-center gap-1.5">
              <div className="relative h-1 flex-1 overflow-hidden rounded-sm bg-gray-100">
                <div
                  className="absolute inset-y-0 left-0 rounded-sm bg-[#c4b5fd] transition-[width] duration-500"
                  style={{ width: `${totalAll > 0 ? Math.round((attemptedAll / totalAll) * 100) : 0}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-sm bg-[#a855f7] transition-[width] duration-500"
                  style={{ width: `${totalAll > 0 ? Math.round((masteredAll / totalAll) * 100) : 0}%` }}
                />
              </div>
              <div className="whitespace-nowrap text-[11px] text-text-muted">
                ✅ {masteredAll}/{totalAll}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-xl text-[#a855f7]">›</div>
        </Link>
      </div>
    </div>
  )
}
