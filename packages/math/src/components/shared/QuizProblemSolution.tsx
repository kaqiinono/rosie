'use client'

import type { Problem } from '@rosie/core'
import ProblemSolutionPanel from '@rosie/math/components/shared/ProblemSolutionPanel'
import { useProblemImageUrl } from '@rosie/math/hooks/useProblemImageUrl'

type QuizProblemSolutionProps = {
  problem: Problem
  className?: string
}

/** 组卷答卷交卷后展示题解（文字分析 + 题解图） */
export default function QuizProblemSolution({ problem, className }: QuizProblemSolutionProps) {
  const analysisUrl = useProblemImageUrl(problem, 'analysis')
  const hasContent =
    problem.analysis.length > 0 || Boolean(problem.analysisImg) || Boolean(analysisUrl)

  if (!hasContent) return null

  return (
    <ProblemSolutionPanel
      problem={problem}
      variant="indigo"
      heading="题解"
      headingIcon="📖"
      className={className}
    />
  )
}
