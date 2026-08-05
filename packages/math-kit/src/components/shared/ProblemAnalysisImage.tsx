'use client'

import type { Problem } from '@rosie/core'
import AnalysisImage from '@rosie/math-kit/components/shared/AnalysisImage'
import { useProblemImageUrl } from '@rosie/math-kit/hooks/useProblemImageUrl'

interface ProblemAnalysisImageProps {
  problem: Problem
}

/** Renders 题解配图 — DB upload overrides static `analysisImg`. */
export default function ProblemAnalysisImage({ problem }: ProblemAnalysisImageProps) {
  const url = useProblemImageUrl(problem, 'analysis')
  if (!url) return null
  return <AnalysisImage src={url} alt={problem.title} />
}
