'use client'

import type { Problem } from '@rosie/core'
import AnalysisGuideBadge from '@rosie/math/components/shared/AnalysisGuideBadge'
import { useProblemImageUrl } from '@rosie/math/hooks/useProblemImageUrl'

type Props = {
  problem: Problem
  size?: 'sm' | 'md'
  className?: string
}

/** Resolves static + cloud analysis image, then shows badge when available. */
export default function AnalysisGuideBadgeForProblem({ problem, size, className }: Props) {
  const url = useProblemImageUrl(problem, 'analysis')
  return <AnalysisGuideBadge hasImage={url !== null} size={size} className={className} />
}
