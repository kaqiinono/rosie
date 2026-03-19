'use client'

import OrbBackground from '@/components/shared/OrbBackground'
import BackLink from '@/components/shared/BackLink'
import CourseCard from '@/components/math/CourseCard'
import type { CourseCardData } from '@/utils/type'

const courses: CourseCardData[] = [
  {
    href: '/math/ny/36',
    title: '星期几问题探险',
    description: '掌握 3 大题型推算任意日期的星期几：同月/跨月天数余数法、跨年平年+1/闰年+2 累计偏移、确定星期几的分布分析。',
    icon: '📅',
    lectureNum: '第 36 讲',
    tags: ['星期几问题', '余数推算', '25 道互动题'],
    variant: 'amber',
  },
  {
    href: '/math/ny/35',
    title: '归一问题探险',
    description: '学会用倍比图解决归一问题，覆盖 5 大题型：基础归一、直接倍比、双归一、反向归一、变化归一。',
    icon: '🎯',
    lectureNum: '第 35 讲',
    tags: ['归一问题', '倍比图', '29 道互动题'],
    variant: 'blue',
  },
  {
    href: '/math/ny/34',
    title: '一袋里有几个',
    description: '用袋子装东西的故事演示 4×25 + 9×25，看两袋合成一袋的过程，直观理解乘法分配律。',
    icon: '🎁',
    lectureNum: '第 34 讲',
    tags: ['乘法分配律', '分步演示', '合并思维'],
    variant: 'violet',
  },
]

export default function MathPage() {
  return (
    <>
      <OrbBackground variant="math" />
      <BackLink />

      <div className="relative z-1 flex min-h-screen flex-col items-center justify-center gap-7 px-5 py-8 pb-12 max-[500px]:gap-5 max-[500px]:px-3.5 max-[500px]:py-6">
        <section className="max-w-[480px] text-center">
          <div className="inline-block animate-bounce-slow text-5xl">🧮</div>
          <h1 className="mt-2 bg-gradient-to-br from-blue-900 via-violet-600 to-amber-500 bg-clip-text text-[clamp(26px,5vw,34px)] font-black leading-tight text-transparent">
            数学探险乐园
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
            选一节课开始今天的数学冒险吧
          </p>
        </section>

        <section className="flex w-full max-w-[680px] flex-col gap-4">
          {courses.map((course) => (
            <CourseCard key={course.href} data={course} />
          ))}
        </section>

        <div className="text-xs text-text-muted">Rosie 的数学探险乐园</div>
      </div>
    </>
  )
}
