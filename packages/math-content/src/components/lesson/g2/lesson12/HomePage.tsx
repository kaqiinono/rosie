'use client'

import Link from 'next/link'
import type { Problem, ProblemSet } from '@rosie/core'
import LessonSummary from '@rosie/math-kit/components/shared/LessonSummary'
import {
  LESSON_TIP,
  LESSON_SUMMARY,
  PROBLEM_TYPES,
  TAG_STYLE,
} from '../../../../utils/g2/lesson12-data'

const BASE = '/math/ny/2/12'
type Props = {
  problems: ProblemSet
  practiceCount: Record<string, number>
  correctCount: Record<string, number>
}

export default function HomePage({ problems, practiceCount, correctCount }: Props) {
  const all = (Object.values(problems) as Problem[][]).flat()
  const attempted = all.filter((problem) => (practiceCount[problem.id] ?? 0) > 0).length
  const mastered = all.filter((problem) => (correctCount[problem.id] ?? 0) >= 3).length

  return (
    <div>
      <div className="mb-5 rounded-[14px] bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-100 p-6">
        <h1 className="mb-1.5 text-2xl font-extrabold text-amber-900">盈亏问题初步 ⚖️</h1>
        <p className="text-[13px] leading-relaxed text-amber-800">
          二年级目标班 · 第12讲
          <br />
          {LESSON_TIP}
        </p>
      </div>
      <section className="mb-4 rounded-[14px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <h2 className="mb-3 text-[15px] font-bold text-amber-900">
          本讲总结 · 两种方案，三个不变量
        </h2>
        <div className="text-text-secondary space-y-2 text-sm leading-relaxed">
          {LESSON_SUMMARY.slice(0, 2).map((line) => (
            <p key={line}>{line}</p>
          ))}
          <ol className="space-y-2 rounded-lg bg-amber-50 p-4 text-amber-900">
            {LESSON_SUMMARY.slice(2, 6).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          <details className="rounded-lg border border-amber-100 p-3">
            <summary className="cursor-pointer font-semibold text-amber-800">
              基础示例：盈盈、恰好分完、盈亏、亏亏
            </summary>
            <div className="mt-2 space-y-2">
              {LESSON_SUMMARY.slice(6).map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </details>
        </div>
      </section>
      <LessonSummary lessonId="2-12" />
      <section className="mb-4 rounded-[14px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <h2 className="mb-3 text-[15px] font-bold">🧠 按题型练习</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PROBLEM_TYPES.map((type) => (
            <Link
              key={type.tag}
              href={`${BASE}/alltest?type=${type.tag}`}
              className={`rounded-lg p-3 no-underline transition hover:shadow-md ${TAG_STYLE[type.tag]}`}
            >
              <div className="mb-1 text-sm font-bold">
                {type.icon} {type.label} · {all.filter((p) => p.tag === type.tag).length}题
              </div>
              <p className="text-xs leading-relaxed">{type.desc}</p>
            </Link>
          ))}
        </div>
      </section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href={`${BASE}/lesson`}
          className="rounded-[14px] bg-white p-4 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)]"
        >
          <div className="mb-1 text-sm font-bold">📖 课堂讲解</div>
          <p className="text-text-muted text-xs">
            14道例题＋4道练一练 · {problems.lesson.length}个答题项
          </p>
        </Link>
        <Link
          href={`${BASE}/alltest`}
          className="rounded-[14px] border-2 border-amber-300 bg-white p-4 no-underline"
        >
          <div className="mb-1 text-sm font-bold text-amber-700">🎯 综合题库</div>
          <p className="text-text-muted text-xs">
            已练 {attempted}/{all.length} · 掌握 {mastered}/{all.length}
          </p>
        </Link>
      </div>
    </div>
  )
}
