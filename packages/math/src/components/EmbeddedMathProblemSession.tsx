'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@rosie/core'
import { useMathPracticeStats } from '@rosie/math-kit/hooks/useMathPracticeStats'
import { useMathWrong } from '@rosie/math-kit/hooks/useMathWrong'
import PracticeProblemBody from '@rosie/math/components/shared/practice-queue/PracticeProblemBody'
import { SEA_POOL } from '@rosie/math/utils/sea-data'
import { lookupMathProblem } from '@rosie/math/utils/math-problem-lookup'

type EmbeddedMathProblemSessionProps = {
  problemId: string
}

export default function EmbeddedMathProblemSession({ problemId }: EmbeddedMathProblemSessionProps) {
  const { user } = useAuth()
  const { correctCount } = useMathPracticeStats(user)
  const { wrongIds } = useMathWrong(user)
  const [finished, setFinished] = useState(false)
  const entry = useMemo(() => {
    const direct = SEA_POOL.find((item) => item.problem.id === problemId)
    if (direct) return direct
    const resolved = lookupMathProblem(problemId)
    return resolved
      ? (SEA_POOL.find((item) => item.problem.id === resolved.problemId) ?? null)
      : null
  }, [problemId])

  if (!entry) {
    return (
      <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-100">
        暂时无法加载这道题，请尝试输入完整题目编号。
      </div>
    )
  }

  if (finished) {
    return (
      <div className="rounded-2xl bg-emerald-50 p-4 text-center ring-1 ring-emerald-100">
        <p className="font-bold text-emerald-800">本题练习已记录 ✓</p>
        <button
          type="button"
          onClick={() => setFinished(false)}
          className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200"
        >
          再做一次
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-100 sm:p-3">
      <div className="mb-2 flex flex-wrap gap-2 px-1 text-xs font-bold">
        <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-indigo-700">
          已正确完成 {correctCount[entry.problem.id] ?? 0} 次
        </span>
        {wrongIds.has(entry.problem.id) ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">待巩固</span>
        ) : null}
      </div>
      <PracticeProblemBody
        key={entry.problem.id}
        item={{
          problem: entry.problem,
          lessonId: entry.lessonId,
          section: entry.section,
          detailHref: entry.href,
        }}
        onAnswerCorrect={() => setFinished(true)}
        onAnswerWrong={() => {}}
        onAdvance={() => setFinished(true)}
        isLast
      />
    </div>
  )
}
