'use client'

import { OrbBackground, BackLink } from '@rosie/ui'
import CourseCard from '@rosie/math/components/CourseCard'
import { COURSES } from '@rosie/math/utils/courses-data'
import { GRADE_LABEL, gradeOf, lessonIdFromHref } from '@rosie/math/utils/lesson-grade'
import type { CourseCardData } from '@rosie/core'

export default function GradeLessonList({ grade }: { grade: number }) {
  const courses: CourseCardData[] = COURSES.filter((c) => {
    const id = lessonIdFromHref(c.href)
    return id !== undefined && gradeOf(id) === grade
  })
  const label = GRADE_LABEL[grade] ?? `${grade} 年级`

  return (
    <>
      <OrbBackground variant="math" />
      <BackLink href="/math" />
      <div className="relative z-1 flex min-h-screen flex-col items-center gap-7 px-5 pt-24 pb-12 max-[500px]:gap-5 max-[500px]:px-3.5 max-[500px]:pt-20 max-[500px]:pb-8">
        <section className="max-w-[480px] text-center">
          <h1 className="mt-2 bg-gradient-to-br from-blue-900 via-violet-600 to-amber-500 bg-clip-text text-[clamp(26px,5vw,34px)] leading-tight font-black text-transparent">
            {label}
          </h1>
          <p className="text-text-secondary mt-1.5 text-sm leading-relaxed">
            共 {courses.length} 讲，选一节开始吧
          </p>
        </section>
        <section className="flex w-full max-w-[680px] flex-col gap-4">
          {courses.map((course) => (
            <CourseCard key={course.href} data={course} />
          ))}
        </section>
      </div>
    </>
  )
}
