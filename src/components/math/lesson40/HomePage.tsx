'use client'

import Link from 'next/link'
import type { ProblemSet, Problem } from '@/utils/type'
import { PROBLEM_TYPES, TYPE_STYLE } from '@/utils/lesson40-data'

const BASE = '/math/ny/40'

interface HomePageProps {
  problems: ProblemSet
  solveCount: Record<string, number>
}

const MODULES = [
  { key: 'pretest',    path: `${BASE}/pretest`,    icon: '📝', bg: 'bg-[#fef9c3]',       title: '课前测',   desc: '5道摸底题 · 检验起始水平' },
  { key: 'lesson',     path: `${BASE}/lesson`,     icon: '📖', bg: 'bg-app-blue-light',   title: '课堂讲解', desc: '例题1-6 · 拼图/剪切/平移/标向法' },
  { key: 'homework',   path: `${BASE}/homework`,   icon: '✏️', bg: 'bg-app-green-light',  title: '课后巩固', desc: '巩固1-6 · 强化练习' },
  { key: 'workbook',   path: `${BASE}/workbook`,   icon: '📚', bg: 'bg-app-purple-light', title: '拓展练习', desc: '闯关1-12 · 综合挑战' },
  { key: 'supplement', path: `${BASE}/supplement`, icon: '📒', bg: 'bg-amber-50',         title: '附加题',   desc: '3道附加题 · 深度提升' },
]

export default function HomePage({ problems, solveCount }: HomePageProps) {
  const totalAll = Object.values(problems).reduce((s, l) => s + l.length, 0)
  const allProblemIds = new Set((Object.values(problems) as Problem[][]).flatMap(list => list.map(p => p.id)))
  const masteredAll = Object.entries(solveCount).filter(([id, c]) => allProblemIds.has(id) && c >= 3).length
  const attemptedAll = Object.entries(solveCount).filter(([id, c]) => allProblemIds.has(id) && c >= 1).length

  function getProgress(key: string) {
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
      <div className="relative mb-5 overflow-hidden rounded-[14px] bg-gradient-to-br from-green-50 via-[#dcfce7] to-[#bbf7d0] p-6">
        <div className="pointer-events-none absolute -right-2.5 -top-2.5 text-[90px] opacity-[0.12] rotate-[15deg]">
          📐
        </div>
        <h1 className="mb-1.5 text-2xl font-extrabold text-green-900">周长问题 📐</h1>
        <p className="text-[13px] leading-relaxed text-green-800">
          第40讲 · 一年级目标班<br />学会用拼图法、剪切法、平移法、标向法解决各类周长问题！
        </p>
      </div>

      <div className="mb-4 rounded-[14px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <div className="mb-2.5 flex items-center gap-1.5 text-[15px] font-bold">🧠 周长问题 · 4大解题方法</div>
        <div className="mb-3 text-[13px] leading-relaxed text-text-secondary">
          <strong className="text-text-primary">核心公式：</strong>
          <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">长方形 P=2×(长+宽)</code>
          <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">正方形 P=4×边长</code>
          根据图形特征选择最适合的解法。
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-2">
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
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-green-50 p-3">
          <span className="shrink-0 text-base">⭐</span>
          <span className="text-xs leading-relaxed text-green-800">
            万能口诀：<strong>剪切加切割线，平移看极值，标向补缺边</strong>
          </span>
        </div>
      </div>

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
                    <div className="absolute inset-y-0 left-0 rounded-sm bg-gray-300 transition-[width] duration-500"
                      style={{ width: `${attemptedPct}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-sm bg-app-green transition-[width] duration-500"
                      style={{ width: `${masteredPct}%` }} />
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

        <Link
          href={`${BASE}/alltest`}
          className="flex items-center gap-3 rounded-[14px] border-2 border-green-300 bg-white p-4 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-all hover:-translate-y-px hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] active:scale-[0.98]"
        >
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-green-50 text-[22px]">
            🎯
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-green-700">综合题库</div>
            <div className="mb-1 text-xs text-text-muted">全部题目 · 按题型/来源筛选 · 综合训练</div>
            <div className="flex items-center gap-1.5">
              <div className="relative h-1 flex-1 overflow-hidden rounded-sm bg-gray-100">
                <div className="absolute inset-y-0 left-0 rounded-sm bg-green-200 transition-[width] duration-500"
                  style={{ width: `${totalAll > 0 ? Math.round((attemptedAll / totalAll) * 100) : 0}%` }} />
                <div className="absolute inset-y-0 left-0 rounded-sm bg-green-500 transition-[width] duration-500"
                  style={{ width: `${totalAll > 0 ? Math.round((masteredAll / totalAll) * 100) : 0}%` }} />
              </div>
              <div className="whitespace-nowrap text-[11px] text-text-muted">
                ✅ {masteredAll}/{totalAll}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-xl text-green-500">›</div>
        </Link>
      </div>
    </div>
  )
}
