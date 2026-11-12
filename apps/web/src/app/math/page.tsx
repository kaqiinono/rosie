'use client'

import { LearningIcon, OrbBackground, PageBreadcrumb } from '@rosie/ui'
import GradeCard from '@rosie/math/components/GradeCard'
import MathDailyCard from '@rosie/math/components/MathDailyCard'
import MathSeaCard from '@rosie/math/components/MathSeaCard'
import { MathFavoritesCard } from '@rosie/math'
import MathQuizCard from '@rosie/math/components/MathQuizCard'
import MathCatalogCard from '@rosie/math/components/MathCatalogCard'
import MathNotesCard from '@rosie/math/components/MathNotesCard'
import MathMistakesCard from '@rosie/math/components/MathMistakesCard'
import { gradesForLanding, GRADE_LABEL, lessonsForGrade } from '@rosie/math-kit/utils/lesson-grade'
import { gradeCourseSummary } from '@rosie/math-kit/utils/courses-data'
import { gradeProblemStats } from '@rosie/math/utils/grade-stats'
import { useMathPracticeStats } from '@rosie/math-kit/hooks/useMathPracticeStats'
import { useAuth } from '@rosie/core'

export default function MathPage() {
  const { user } = useAuth()
  const { practiceCount } = useMathPracticeStats(user)
  const raw = user?.email?.replace('@rosie.app', '') ?? user?.email?.split('@')[0]
  const username = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : undefined
  return (
    <>
      <OrbBackground variant="math" />

      {/* 面包屑 inline 与内容同层（fixed 变体宽屏时会悬在左侧留白里） */}
      <div className="relative z-1 flex min-h-screen flex-col items-center gap-7 px-5 pt-5 pb-12 max-[500px]:gap-5 max-[500px]:px-3.5 max-[500px]:pb-8">
        <div className="w-fit self-start">
          <PageBreadcrumb variant="inline" />
        </div>
        <section className="max-w-[480px] text-center">
          <div aria-hidden="true" className="relative inline-flex items-center justify-center px-5">
            <span className="absolute top-0 left-0 -rotate-12 text-lg leading-none text-amber-400">★</span>
            <span className="inline-flex origin-bottom motion-safe:animate-[bounce-slow_550ms_ease-in-out,wiggle_600ms_ease-in-out_550ms]">
              <LearningIcon name="calculator" size={48} />
            </span>
            <span className="absolute right-0 bottom-0 rotate-12 text-xl leading-none font-black text-emerald-400">+</span>
          </div>
          <h1 className="mt-2 text-[clamp(26px,5vw,34px)] leading-tight font-black text-amber-700">
            数学探险乐园
          </h1>
          <p className="text-text-secondary mt-1.5 text-sm leading-relaxed">
            选一个年级开始今天的数学冒险吧
          </p>
        </section>

        <section className="flex w-full max-w-[680px] flex-col gap-4">
          <MathDailyCard />
          <div className="grid grid-cols-3 items-stretch gap-3">
            <MathSeaCard />
            <MathFavoritesCard />
            <MathQuizCard />
            <MathCatalogCard />
            <MathNotesCard />
            <MathMistakesCard />
          </div>
          <section className="grid w-full grid-cols-1 gap-4 min-[501px]:grid-cols-2">
            {gradesForLanding().map((g) => {
              const { total, practiced } = gradeProblemStats(g, practiceCount)
              return (
                <GradeCard
                  key={g}
                  grade={g}
                  label={GRADE_LABEL[g] ?? `${g} 年级`}
                  lessonCount={lessonsForGrade(g).length}
                  summary={gradeCourseSummary(g)}
                  totalProblems={total}
                  practicedProblems={practiced}
                />
              )
            })}
          </section>
        </section>

        <div className="text-text-muted text-xs">{username ?? 'Rosie'} 的数学探险乐园</div>
      </div>
    </>
  )
}
