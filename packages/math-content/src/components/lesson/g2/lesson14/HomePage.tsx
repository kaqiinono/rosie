'use client'

import Link from 'next/link'
import type { ProblemSet } from '@rosie/core'
import LessonHomeTitle from '@rosie/math-kit/components/shared/LessonHomeTitle'
import LessonSummary from '@rosie/math-kit/components/shared/LessonSummary'
import { LessonSummaryVideos } from '@rosie/math-kit/components/shared/ProblemVideoReplay'
import { StickerCard } from '@rosie/ui'
import {
  KNOWLEDGE_POINTS,
  LESSON_SUMMARY,
  LESSON_TIP,
  PROBLEM_TYPES,
  TAG_STYLE,
} from '../../../../utils/g2/lesson14-data'

const BASE = '/math/ny/2/14'

export default function HomePage({
  problems,
  practiceCount,
  correctCount,
}: {
  problems: ProblemSet
  practiceCount: Record<string, number>
  correctCount: Record<string, number>
}) {
  const attempted = problems.lesson.filter((problem) => (practiceCount[problem.id] ?? 0) > 0).length
  const mastered = problems.lesson.filter((problem) => (correctCount[problem.id] ?? 0) >= 3).length

  return (
    <div>
      <div className="mb-5 rounded-[14px] bg-teal-50 p-6">
        <LessonHomeTitle
          summaryInContent
          lessonKey="2-14"
          className="text-2xl font-extrabold text-teal-900"
          description={
            <p className="text-sm leading-relaxed text-teal-800">
              二年级目标班 · 第14讲
              <br />
              {LESSON_TIP}
            </p>
          }
        >
          枚举法进阶 🔢
        </LessonHomeTitle>
      </div>
      <StickerCard as="section" elevation="sm" radius="md" className="mb-4">
        <h2 className="mb-3 text-base font-bold text-teal-900">知识要点</h2>
        <ul className="text-text-secondary list-disc space-y-2 pl-5 text-sm leading-relaxed">
          {KNOWLEDGE_POINTS.map((point) => <li key={point}>{point}</li>)}
        </ul>
        <h2 className="mb-3 mt-5 text-base font-bold text-teal-900">课堂总结</h2>
        <ul className="text-text-secondary list-disc space-y-2 pl-5 text-sm leading-relaxed">
          {LESSON_SUMMARY.map((point) => <li key={point}>{point}</li>)}
        </ul>
        <LessonSummaryVideos lessonKey="2-14" />
      </StickerCard>
      <LessonSummary lessonId="2-14" />
      <StickerCard as="section" elevation="sm" radius="md" className="mb-4">
        <h2 className="mb-3 text-base font-bold">🧠 按题型练习</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PROBLEM_TYPES.map((type) => (
            <Link
              key={type.tag}
              href={`${BASE}/alltest?type=${type.tag}`}
              className={`rounded-lg p-3 no-underline hover:shadow-sticker ${TAG_STYLE[type.tag]}`}
            >
              <div className="mb-1 text-sm font-bold">
                {type.icon} {type.label} · {problems.lesson.filter((p) => p.tag === type.tag).length}题
              </div>
              <p className="text-xs leading-relaxed">{type.desc}</p>
            </Link>
          ))}
        </div>
      </StickerCard>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StickerCard asChild interactive elevation="sm" radius="md">
          <Link href={`${BASE}/lesson`} className="no-underline">
            <div className="mb-1 text-sm font-bold">📖 课堂讲解</div>
            <p className="text-text-muted text-xs">共 {problems.lesson.length} 题</p>
          </Link>
        </StickerCard>
        <StickerCard asChild interactive elevation="sm" radius="md">
          <Link href={`${BASE}/alltest`} className="no-underline">
            <div className="mb-1 text-sm font-bold">🎯 综合题库</div>
            <p className="text-text-muted text-xs">
              已练 {attempted}/{problems.lesson.length} · 掌握 {mastered}/{problems.lesson.length}
            </p>
          </Link>
        </StickerCard>
      </div>
    </div>
  )
}
