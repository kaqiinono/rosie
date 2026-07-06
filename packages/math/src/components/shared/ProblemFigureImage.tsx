'use client'

import type { Problem } from '@rosie/core'
import { useProblemImageUrl } from '@rosie/math/hooks/useProblemImageUrl'

interface ProblemFigureImageProps {
  problem: Problem
}

/** Renders 题面配图 — DB upload replaces `figureNode` when present. */
export default function ProblemFigureImage({ problem }: ProblemFigureImageProps) {
  const dbUrl = useProblemImageUrl(problem, 'figure')

  if (dbUrl) {
    return (
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dbUrl}
          alt={problem.title}
          className="w-full max-w-md rounded-lg border border-teal-200 bg-white"
        />
      </div>
    )
  }

  if (!problem.figureNode) return null
  return <div>{problem.figureNode}</div>
}
