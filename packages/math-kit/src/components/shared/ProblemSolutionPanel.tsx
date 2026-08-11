'use client'

import type { ReactNode } from 'react'
import type { Problem } from '@rosie/core'
import ProblemSolutionView, { type SolutionPanelVariant } from '@rosie/ui/ProblemSolutionView'
import ProblemAnalysisImage from '@rosie/math-kit/components/shared/ProblemAnalysisImage'

export type { SolutionPanelVariant }

type Props = {
  problem: Problem
  heading?: string
  headingIcon?: string
  variant?: SolutionPanelVariant
  className?: string
  footer?: ReactNode
  children?: ReactNode
  hideImage?: boolean
}

/** Math data wrapper around the shared solution view; resolves uploaded/static analysis images. */
export default function ProblemSolutionPanel({
  problem,
  heading = '题型分析',
  headingIcon = '🔍',
  variant = 'yellow',
  className,
  footer,
  children,
  hideImage,
}: Props) {
  const panel = (
    <ProblemSolutionView
      analysis={problem.analysis}
      heading={heading}
      headingIcon={headingIcon}
      variant={variant}
      allowTrustedHtml
      image={hideImage ? undefined : <ProblemAnalysisImage problem={problem} />}
    />
  )

  if (children) {
    return (
      <div
        className={`flex flex-col gap-4 min-[900px]:flex-row min-[900px]:items-start ${className ?? ''}`}
      >
        <div>
          {panel}
          {children}
        </div>
      </div>
    )
  }
  return (
    <div className={className}>
      {panel}
      {footer}
    </div>
  )
}
