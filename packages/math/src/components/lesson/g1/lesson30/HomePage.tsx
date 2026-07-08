'use client'

import Link from 'next/link'
import type { ProblemSet, Problem } from '@rosie/core'
import { PROBLEM_TYPES, TYPE_STYLE } from '@rosie/math/utils/g1/lesson30-data'

const BASE = '/math/ny/1/30'

interface HomePageProps {
  problems: ProblemSet
  solveCount: Record<string, number>
}

const MODULES = [
  {
    key: 'pretest',
    path: `${BASE}/pretest`,
    icon: '📝',
    bg: 'bg-[#fef9c3]',
    title: '课前测',
    desc: '5道摸底题 · 和差倍综合检验',
  },
  {
    key: 'lesson',
    path: `${BASE}/lesson`,
    icon: '📖',
    bg: 'bg-amber-100',
    title: '课堂讲解',
    desc: '例题1-6 + 练一练 · 6大题型进阶',
  },
  {
    key: 'workbook',
    path: `${BASE}/workbook`,
    icon: '📚',
    bg: 'bg-app-purple-light',
    title: '拓展练习',
    desc: '闯关1-12 · 综合挑战',
  },
]

export default function HomePage({ problems, solveCount }: HomePageProps) {
  const totalAll = Object.values(problems).reduce((s, l) => s + l.length, 0)
  const allProblemIds = new Set(
    (Object.values(problems) as Problem[][]).flatMap((list) => list.map((p) => p.id)),
  )
  const masteredAll = Object.entries(solveCount).filter(
    ([id, c]) => allProblemIds.has(id) && c >= 3,
  ).length
  const attemptedAll = Object.entries(solveCount).filter(
    ([id, c]) => allProblemIds.has(id) && c >= 1,
  ).length

  function getProgress(key: string) {
    const list = problems[key as keyof ProblemSet]
    if (!list) return { mastered: 0, attempted: 0, total: 0 }
    return {
      mastered: list.filter((p) => (solveCount[p.id] ?? 0) >= 3).length,
      attempted: list.filter((p) => (solveCount[p.id] ?? 0) >= 1).length,
      total: list.length,
    }
  }

  return (
    <div>
      <div className="relative mb-5 overflow-hidden rounded-[14px] bg-gradient-to-br from-amber-50 via-[#fef3c7] to-amber-200 p-6">
        <div className="pointer-events-none absolute -top-2.5 -right-2.5 rotate-[15deg] text-[90px] opacity-[0.12]">
          🧮
        </div>
        <h1 className="mb-1.5 text-2xl font-extrabold text-amber-900">和差倍问题进阶 🧮</h1>
        <p className="text-[13px] leading-relaxed text-amber-800">
          第30讲 · 一年级目标班
          <br />
          在和差倍基础上，挑战三量、除法余数、双倍交叉等进阶变形题！
        </p>
      </div>

      <div className="mb-4 rounded-[14px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <div className="mb-2.5 flex items-center gap-1.5 text-[15px] font-bold">
          🧠 和差倍进阶 · 6大题型
        </div>
        <div className="text-text-secondary mb-3 text-[13px] leading-relaxed">
          <strong className="text-text-primary">核心思路：</strong>
          <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">被减数 = 减数 + 差</code>
          <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">
            设最小量为x，用倍数关系统一表达
          </code>
          <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">
            同一量两种表达→联立等式
          </code>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEM_TYPES.map((t) => {
            const style = TYPE_STYLE[t.tag]
            return (
              <Link
                key={t.tag}
                href={`${BASE}/alltest?type=${t.tag}`}
                className={`rounded-r-lg border-l-3 p-3 no-underline ${style.bg} ${style.border} transition-all hover:shadow-md`}
              >
                <div
                  className={`mb-1 flex items-center justify-between text-xs font-bold ${style.titleColor}`}
                >
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
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3">
          <span className="shrink-0 text-base">⭐</span>
          <span className="text-xs leading-relaxed text-amber-800">
            万能口诀：
            <strong>
              三量和差→设最小量为x逐步推导；含倍关系→先化为同一基准的份数；含变化→变化前后建等式。
            </strong>
          </span>
        </div>
      </div>

      <div className="text-text-secondary mb-2.5 text-[13px] font-bold">📂 学习模块</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {MODULES.map((m) => {
          const prog = getProgress(m.key)
          const masteredPct = prog.total > 0 ? Math.round((prog.mastered / prog.total) * 100) : 0
          const attemptedPct = prog.total > 0 ? Math.round((prog.attempted / prog.total) * 100) : 0
          return (
            <Link
              key={m.key}
              href={m.path}
              className="flex items-center gap-3 rounded-[14px] border-2 border-transparent bg-white p-4 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-all hover:-translate-y-px hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] active:scale-[0.98]"
            >
              <div
                className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl text-[22px] ${m.bg}`}
              >
                {m.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-text-primary text-sm font-bold">{m.title}</div>
                <div className="text-text-muted mb-1 text-xs">{m.desc}</div>
                <div className="flex items-center gap-1.5">
                  <div className="relative h-1 flex-1 overflow-hidden rounded-sm bg-gray-100">
                    <div
                      className="absolute inset-y-0 left-0 rounded-sm bg-gray-300 transition-[width] duration-500"
                      style={{ width: `${attemptedPct}%` }}
                    />
                    <div
                      className="bg-app-green absolute inset-y-0 left-0 rounded-sm transition-[width] duration-500"
                      style={{ width: `${masteredPct}%` }}
                    />
                  </div>
                  <div className="text-text-muted text-[11px] whitespace-nowrap">
                    ✅ {prog.mastered}/{prog.total}
                  </div>
                </div>
              </div>
              <div className="text-text-muted shrink-0 text-xl">›</div>
            </Link>
          )
        })}

        <Link
          href={`${BASE}/alltest`}
          className="flex items-center gap-3 rounded-[14px] border-2 border-amber-300 bg-white p-4 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-all hover:-translate-y-px hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] active:scale-[0.98]"
        >
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-amber-100 text-[22px]">
            🎯
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-amber-700">综合题库</div>
            <div className="text-text-muted mb-1 text-xs">
              全部题目 · 按题型/来源筛选 · 综合训练
            </div>
            <div className="flex items-center gap-1.5">
              <div className="relative h-1 flex-1 overflow-hidden rounded-sm bg-gray-100">
                <div
                  className="absolute inset-y-0 left-0 rounded-sm bg-amber-200 transition-[width] duration-500"
                  style={{
                    width: `${totalAll > 0 ? Math.round((attemptedAll / totalAll) * 100) : 0}%`,
                  }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-sm bg-amber-500 transition-[width] duration-500"
                  style={{
                    width: `${totalAll > 0 ? Math.round((masteredAll / totalAll) * 100) : 0}%`,
                  }}
                />
              </div>
              <div className="text-text-muted text-[11px] whitespace-nowrap">
                ✅ {masteredAll}/{totalAll}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-xl text-amber-500">›</div>
        </Link>
      </div>
    </div>
  )
}
