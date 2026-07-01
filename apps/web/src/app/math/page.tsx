'use client'

import { OrbBackground, BackLink } from '@rosie/ui'
import GradeCard from '@rosie/math/components/GradeCard'
import MathDailyCard from '@rosie/math/components/MathDailyCard'
import MathSeaCard from '@rosie/math/components/MathSeaCard'
import { MathFavoritesCard } from '@rosie/math'
import MathQuizCard from '@rosie/math/components/MathQuizCard'
import MathCatalogCard from '@rosie/math/components/MathCatalogCard'
import MathPriorityCard from '@rosie/math/components/MathPriorityCard'
import MathMistakesCard from '@rosie/math/components/MathMistakesCard'
import { gradesForLanding, GRADE_LABEL, lessonsForGrade } from '@rosie/math/utils/lesson-grade'
import { gradeCourseSummary } from '@rosie/math/utils/courses-data'
import { gradeProblemStats } from '@rosie/math/utils/grade-stats'
import { useMathSolved } from '@rosie/math/hooks/useMathSolved'
import { useAuth } from '@rosie/core'

export default function MathPage() {
  const { user } = useAuth()
  const { solveCount } = useMathSolved(user)
  const raw = user?.email?.replace('@rosie.app', '') ?? user?.email?.split('@')[0]
  const username = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : undefined
  return (
    <>
      <OrbBackground variant="math" />
      <BackLink />

      <div className="relative z-1 flex min-h-screen flex-col items-center gap-7 px-5 pt-24 pb-12 max-[500px]:gap-5 max-[500px]:px-3.5 max-[500px]:pt-20 max-[500px]:pb-8">
        <section className="max-w-[480px] text-center">
          <div className="animate-bounce-slow inline-block text-5xl">🧮</div>
          <h1 className="mt-2 bg-gradient-to-br from-blue-900 via-violet-600 to-amber-500 bg-clip-text text-[clamp(26px,5vw,34px)] leading-tight font-black text-transparent">
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
            <MathPriorityCard />
            <MathMistakesCard />
          </div>
          <section className="grid w-full grid-cols-1 gap-4 min-[501px]:grid-cols-2">
            {gradesForLanding().map((g) => {
              const { total, practiced } = gradeProblemStats(g, solveCount)
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
