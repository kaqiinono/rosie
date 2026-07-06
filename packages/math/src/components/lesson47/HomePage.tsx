'use client'

import Link from 'next/link'
import type { ProblemSet, Problem } from '@rosie/core'
import { PROBLEM_TYPES, TYPE_STYLE } from '@rosie/math/utils/lesson47-data'
import LessonSummaryImage from '@rosie/math/components/shared/LessonSummaryImage'

const BASE = '/math/ny/47'

interface HomePageProps {
  problems: ProblemSet
  solveCount: Record<string, number>
}

const MODULES = [
  { key: 'lesson',   path: `${BASE}/lesson`,   icon: '📖', bg: 'bg-fuchsia-100',      title: '课堂讲解', desc: '例题1-6 + 练一练 · 数连/数桥/数方/三种数独' },
  { key: 'homework', path: `${BASE}/homework`, icon: '✏️', bg: 'bg-app-green-light',  title: '课后巩固', desc: '巩固1-6 · 六类方格谜题各一题' },
  { key: 'workbook', path: `${BASE}/workbook`, icon: '📚', bg: 'bg-app-purple-light', title: '拓展练习', desc: '闯关1-12 · 含对角线·锯齿·九宫挑战' },
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
      <div className="relative mb-5 overflow-hidden rounded-[14px] bg-gradient-to-br from-fuchsia-50 via-[#fae8ff] to-fuchsia-200 p-6">
        <div className="pointer-events-none absolute -right-2.5 -top-2.5 text-[90px] opacity-[0.12] rotate-[15deg]">
          🧩
        </div>
        <h1 className="mb-1.5 text-2xl font-extrabold text-fuchsia-900">方格中的秘密（二） 🧩</h1>
        <p className="text-[13px] leading-relaxed text-fuchsia-800">
          第47讲 · 一年级目标班<br />
          数连、数桥、数方，再加上各种变型数独——动手在格子里拼出答案，点「检查」立刻知道对不对！
        </p>
      </div>

      <LessonSummaryImage lessonId={BASE.split("/").pop()!} />

      <div className="mb-4 rounded-[14px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <div className="mb-2.5 flex items-center gap-1.5 text-[15px] font-bold">🧠 方格谜题 · 9大题型</div>
        <div className="mb-3 text-[13px] leading-relaxed text-text-secondary">
          <strong className="text-text-primary">核心玩法：</strong>
          每种谜题都是<strong className="text-text-primary">在方格里直接操作</strong>——选颜色、连线、划区或填数，
          每题都能<strong className="text-text-primary">自动判对错</strong>，做错也没关系，重置再来。
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
                <div className={`text-[11px] leading-relaxed ${style.textColor}`}>
                  <div className="mb-1.5">
                    <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">规则</div>
                    <ul className="list-inside list-disc space-y-0.5">
                      {t.rules.map((rule, i) => (
                        <li key={i}>{rule}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">突破口</div>
                    <ol className="list-inside list-decimal space-y-0.5 opacity-90">
                      {t.breakthroughs.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-start gap-2 rounded-lg bg-fuchsia-50 p-3">
            <span className="shrink-0 text-base">🔗</span>
            <div className="text-xs leading-relaxed text-fuchsia-800">
              <strong>路径/连接/划分类：</strong>
              找约束最强的格（角/边、孤立元素、极值数字）→ 确定必走方向或必连桥/区域 → 用已确定部分切割剩余空间 → 验证全格覆盖或全图连通。
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-fuchsia-50 p-3">
            <span className="shrink-0 text-base">🔢</span>
            <div className="text-xs leading-relaxed text-fuchsia-800">
              <strong>数独类：</strong>
              标候选数 → 显性/隐性唯一 → 应用变型约束排除 → 候选最少格假设验证。
              点「检查」立刻知道对错，做错重置再来。
            </div>
          </div>
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

        <Link
          href={`${BASE}/alltest`}
          className="flex items-center gap-3 rounded-[14px] border-2 border-fuchsia-300 bg-white p-4 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-all hover:-translate-y-px hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] active:scale-[0.98]"
        >
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-fuchsia-100 text-[22px]">
            🎯
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-fuchsia-700">综合题库</div>
            <div className="mb-1 text-xs text-text-muted">全部题目 · 按题型/来源筛选 · 综合训练</div>
            <div className="flex items-center gap-1.5">
              <div className="relative h-1 flex-1 overflow-hidden rounded-sm bg-gray-100">
                <div
                  className="absolute inset-y-0 left-0 rounded-sm bg-fuchsia-200 transition-[width] duration-500"
                  style={{ width: `${totalAll > 0 ? Math.round((attemptedAll / totalAll) * 100) : 0}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-sm bg-fuchsia-500 transition-[width] duration-500"
                  style={{ width: `${totalAll > 0 ? Math.round((masteredAll / totalAll) * 100) : 0}%` }}
                />
              </div>
              <div className="whitespace-nowrap text-[11px] text-text-muted">
                ✅ {masteredAll}/{totalAll}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-xl text-fuchsia-500">›</div>
        </Link>
      </div>
    </div>
  )
}
