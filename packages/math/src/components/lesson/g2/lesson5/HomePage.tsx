'use client'

import Link from 'next/link'
import type { ProblemSet, Problem } from '@rosie/core'
import { PROBLEM_TYPES, TYPE_STYLE } from '@rosie/math/utils/g2/lesson5-data'

const BASE = '/math/ny/2/5'

interface HomePageProps {
  problems: ProblemSet
  solveCount: Record<string, number>
}

const MODULES = [
  {
    key: 'lesson',
    path: `${BASE}/lesson`,
    icon: '📖',
    bg: 'bg-emerald-50',
    title: '课堂讲解',
    desc: '例题1-15 · 数列·数表·图形编码',
  },
  {
    key: 'homework',
    path: `${BASE}/homework`,
    icon: '✏️',
    bg: 'bg-app-green-light',
    title: '课后巩固',
    desc: '练习1-14 · 规律巩固',
  },
  {
    key: 'supplement',
    path: `${BASE}/supplement`,
    icon: '📒',
    bg: 'bg-amber-50',
    title: '附加题',
    desc: '附加题1-6 · 终极挑战',
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
      <div className="relative mb-5 overflow-hidden rounded-[14px] bg-gradient-to-br from-amber-50 via-amber-100 to-orange-100 p-6">
        <div className="pointer-events-none absolute -top-2.5 -right-2.5 rotate-[15deg] text-[90px] opacity-[0.12]">
          🔮
        </div>
        <h1 className="mb-1.5 text-2xl font-extrabold text-amber-900">找规律 🔮</h1>
        <p className="text-[13px] leading-relaxed text-amber-800">
          第53讲 · 二年级目标班 · 第5讲
          <br />
          观察差比和，破解数列、数表与图形密码！
        </p>
      </div>

      <div className="mb-4 rounded-[14px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <div className="mb-2.5 flex items-center gap-1.5 text-[15px] font-bold">
          🧠 找规律 · 4大题型
        </div>
        <div className="text-text-secondary mb-3 text-[13px] leading-relaxed">
          <strong className="text-text-primary">核心思路：</strong>
          <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">
            看差 → 看比 → 看和 → 看位置
          </code>
          数列找周期，数表找行列，图形找编码。
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
            <strong>差不变看等差，比不变看等比；图形题先标位置，编码题先分内外层。</strong>
          </span>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {MODULES.map((m) => {
          const prog = getProgress(m.key)
          const pct = prog.total > 0 ? Math.round((prog.mastered / prog.total) * 100) : 0
          return (
            <Link
              key={m.key}
              href={m.path}
              className={`block rounded-[14px] ${m.bg} p-4 no-underline shadow-sm transition-all hover:shadow-md`}
            >
              <div className="mb-1 text-2xl">{m.icon}</div>
              <div className="text-text-primary mb-0.5 text-[15px] font-bold">{m.title}</div>
              <div className="text-text-secondary mb-2 text-xs">{m.desc}</div>
              <div className="text-text-secondary text-xs">
                已掌握 {prog.mastered}/{prog.total} · {pct}%
              </div>
            </Link>
          )
        })}
      </div>

      <div className="rounded-[14px] bg-white p-4 text-center shadow-sm">
        <div className="text-text-secondary text-sm">
          全讲进度：已练 <strong className="text-text-primary">{attemptedAll}</strong> / {totalAll}{' '}
          题 · 已掌握 <strong className="text-emerald-600">{masteredAll}</strong> 题
        </div>
      </div>
    </div>
  )
}
