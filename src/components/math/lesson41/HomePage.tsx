'use client'

import Link from 'next/link'
import type { ProblemSet, Problem } from '@/utils/type'
import { PROBLEM_TYPES, TYPE_STYLE } from '@/utils/lesson41-data'

const BASE = '/math/ny/41'

interface HomePageProps {
  problems: ProblemSet
  solveCount: Record<string, number>
}

const MODULES = [
  { key: 'pretest',  path: `${BASE}/pretest`,  icon: '📝', bg: 'bg-[#fef9c3]',       title: '课前测',   desc: '7道摸底题 · 检验起始水平' },
  { key: 'lesson',   path: `${BASE}/lesson`,   icon: '📖', bg: 'bg-app-blue-light',   title: '课堂讲解', desc: '例题1-12 · 覆盖锯木头/爬楼梯/敲钟3大题型' },
  { key: 'homework', path: `${BASE}/homework`, icon: '✏️', bg: 'bg-app-green-light',  title: '课后巩固', desc: '巩固1-6 · 强化练习' },
  { key: 'workbook', path: `${BASE}/workbook`, icon: '📚', bg: 'bg-app-purple-light', title: '拓展练习', desc: '闯关1-12 · 综合挑战' },
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
      {/* Hero */}
      <div className="relative mb-5 overflow-hidden rounded-[14px] bg-gradient-to-br from-sky-50 via-[#e0f2fe] to-[#7dd3fc] p-6">
        <div className="pointer-events-none absolute -right-2.5 -top-2.5 text-[90px] opacity-[0.12] rotate-[15deg]">
          ✂️
        </div>
        <h1 className="mb-1.5 text-2xl font-extrabold text-sky-900">间隔趣题 ✂️</h1>
        <p className="text-[13px] leading-relaxed text-sky-800">
          第41讲 · 一年级目标班<br />掌握间隔核心原理，解决锯木头、爬楼梯、敲钟 3 大经典题型！
        </p>
      </div>

      {/* Problem Types */}
      <div className="mb-4 rounded-[14px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <div className="mb-2.5 flex items-center gap-1.5 text-[15px] font-bold">🧠 间隔趣题 · 4大题型</div>
        <div className="mb-3 text-[13px] leading-relaxed text-text-secondary">
          <strong className="text-text-primary">核心原理：</strong>
          <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">间隔数 = 段数 − 1</code>
          锯木头、爬楼梯、敲钟是同一原理的三种变形。多根木头先算单根，速度比转间隔比，倒推时刻先算经过时间。
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
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-sky-50 p-3">
          <span className="shrink-0 text-base">⭐</span>
          <span className="text-xs leading-relaxed text-sky-800">
            万能口诀：<strong>多根先单根再乘数；楼层差=终点-起点；间隔时间×间隔数=总时间；倒推开始时刻=结束时刻-经过时间；封闭图形棵数=间隔数！</strong>
          </span>
        </div>
      </div>

      {/* Key Learning Points */}
      <div className="mb-4 rounded-[14px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <div className="mb-3 flex items-center gap-1.5 text-[15px] font-bold">📌 本讲6大学习要点</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            { n: '例1', icon: '🪵', tip: '遇到多根木头，先搞定一根所用的时间，再乘以根数算总时间。' },
            { n: '例2', icon: '📐', tip: '想算时间 → 算总次数 → 找有几根、每根锯几次 → 找每根锯几段。' },
            { n: '例3', icon: '🏢', tip: '上楼梯爬的楼层数 = 楼层终点 − 楼层起点（不是楼层数！）。' },
            { n: '例4', icon: '🚶', tip: '搞定两人的速度倍数关系；无整倍数时，用自己和自己在不同时刻比较。' },
            { n: '例5', icon: '🔔', tip: '先算每个间隔所用的时间，再数有几个间隔，两者相乘得总时间。' },
            { n: '例6', icon: '⏰', tip: '由结束时间求开始时间：先算经过的总时间，再列竖式减法倒推。' },
          ].map(({ n, icon, tip }) => (
            <div key={n} className="flex gap-2.5 rounded-lg border border-sky-100 bg-sky-50 p-3">
              <span className="shrink-0 text-base">{icon}</span>
              <div>
                <span className="text-[11px] font-bold text-sky-700">{n} · </span>
                <span className="text-[12px] leading-relaxed text-sky-900">{tip}</span>
              </div>
            </div>
          ))}
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

        {/* All-test card */}
        <Link
          href={`${BASE}/alltest`}
          className="flex items-center gap-3 rounded-[14px] border-2 border-sky-300 bg-white p-4 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-all hover:-translate-y-px hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] active:scale-[0.98]"
        >
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-[#e0f2fe] text-[22px]">
            🎯
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-sky-700">综合题库</div>
            <div className="mb-1 text-xs text-text-muted">全部题目 · 按题型/来源筛选 · 综合训练</div>
            <div className="flex items-center gap-1.5">
              <div className="relative h-1 flex-1 overflow-hidden rounded-sm bg-gray-100">
                <div className="absolute inset-y-0 left-0 rounded-sm bg-sky-200 transition-[width] duration-500"
                  style={{ width: `${totalAll > 0 ? Math.round((attemptedAll / totalAll) * 100) : 0}%` }} />
                <div className="absolute inset-y-0 left-0 rounded-sm bg-sky-500 transition-[width] duration-500"
                  style={{ width: `${totalAll > 0 ? Math.round((masteredAll / totalAll) * 100) : 0}%` }} />
              </div>
              <div className="whitespace-nowrap text-[11px] text-text-muted">
                ✅ {masteredAll}/{totalAll}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-xl text-sky-500">›</div>
        </Link>
      </div>
    </div>
  )
}
