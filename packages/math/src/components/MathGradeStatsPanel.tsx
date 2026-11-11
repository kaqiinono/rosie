'use client'

import { StickerCard } from '@rosie/ui'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@rosie/core'
import type { CourseCardData } from '@rosie/core'
import { useMathPracticeStats } from '@rosie/math-kit/hooks/useMathPracticeStats'
import { lessonIdFromHref } from '@rosie/math-kit/utils/lesson-grade'
import { lessonProblemStats } from '@rosie/math/utils/grade-stats'

export default function MathGradeStatsPanel({ courses }: { courses: CourseCardData[] }) {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const { practiceCount, isLoading } = useMathPracticeStats(expanded ? user : null)

  if (!user) return null

  return (
    <section className="w-full max-w-[680px] min-[501px]:max-w-4xl xl:max-w-6xl">
      <StickerCard asChild interactive size="none" elevation="sm" radius="md">
        <button // native-ok: 整块可点击容器（内含多行内容），Radix Button 是 inline-flex 居中，不适用
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="text-base leading-none" aria-hidden>
              📊
            </span>
            <span className="text-text-primary text-[13px] font-extrabold tracking-wide">
              学习概览
            </span>
            {!expanded && (
              <span className="text-text-muted truncate text-[11px] font-semibold">
                点击展开查看每一讲进度
              </span>
            )}
            {expanded && isLoading && (
              <span className="text-text-muted text-[11px] font-semibold">同步中…</span>
            )}
          </span>
          <span
            className={`text-text-muted shrink-0 text-xs font-bold transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden
          >
            ▼
          </span>
        </button>
      </StickerCard>

      {expanded && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {isLoading ? (
            <div className="col-span-full rounded-2xl border border-indigo-100 bg-blue-50 px-4 py-6 text-center text-xs font-semibold text-indigo-700">
              正在加载练习进度…
            </div>
          ) : (
            courses.map((course) => {
              const lessonId = lessonIdFromHref(course.href)
              const stats = lessonId
                ? lessonProblemStats(lessonId, practiceCount)
                : { practiced: 0, total: 0 }

              return (
                <Link
                  key={course.href}
                  href={course.href}
                  className="group hover:shadow-sticker rounded-2xl border border-indigo-100 bg-blue-50 p-3.5 no-underline transition-all hover:-translate-y-0.5"
                >
                  <div className="mb-2 flex min-w-0 items-center gap-1.5">
                    <span className="text-lg leading-none" aria-hidden>
                      {course.icon}
                    </span>
                    <span className="truncate text-[11px] font-extrabold tracking-wide text-indigo-700">
                      {course.lectureNum}
                    </span>
                  </div>
                  <div className="font-fredoka text-[clamp(22px,4vw,28px)] leading-none font-black text-indigo-700 tabular-nums">
                    {stats.practiced}/{stats.total}
                  </div>
                  <div className="text-text-muted mt-1.5 truncate text-[10px] leading-snug font-semibold">
                    {course.title}
                  </div>
                </Link>
              )
            })
          )}
        </div>
      )}
    </section>
  )
}
