'use client'

import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { Problem } from '@rosie/core'
import ProblemAnalysisImage from '@rosie/math/components/shared/ProblemAnalysisImage'

export type SolutionPanelVariant =
  | 'yellow'
  | 'orange'
  | 'sky'
  | 'green'
  | 'purple'
  | 'violet'
  | 'rose'
  | 'teal'
  | 'fuchsia'
  | 'amber'
  | 'cyan'
  | 'indigo'

const VARIANT_STYLES: Record<
  SolutionPanelVariant,
  { box: string; heading: string; item: string }
> = {
  yellow: {
    box: 'border-[#fde68a] bg-gradient-to-br from-[#fffbeb] to-yellow-light',
    heading: 'text-yellow-dark',
    item: 'text-[#92400e]',
  },
  orange: {
    box: 'border-orange-200 bg-orange-50',
    heading: 'text-orange-700',
    item: 'text-orange-900',
  },
  sky: {
    box: 'border-[#bae6fd] bg-gradient-to-br from-[#f0f9ff] to-[#e0f2fe]',
    heading: 'text-sky-700',
    item: 'text-sky-900',
  },
  green: {
    box: 'border-green-200 bg-gradient-to-br from-green-50 to-[#dcfce7]',
    heading: 'text-green-700',
    item: 'text-green-900',
  },
  purple: {
    box: 'border-purple-200 bg-gradient-to-br from-purple-50 to-[#ede9fe]',
    heading: 'text-purple-700',
    item: 'text-purple-900',
  },
  violet: {
    box: 'border-violet-200 bg-gradient-to-br from-violet-50 to-[#ede9fe]',
    heading: 'text-violet-700',
    item: 'text-violet-900',
  },
  rose: {
    box: 'border-rose-200 bg-gradient-to-br from-rose-50 to-[#ffe4e6]',
    heading: 'text-rose-700',
    item: 'text-rose-900',
  },
  teal: {
    box: 'border-teal-200 bg-gradient-to-br from-teal-50 to-[#ccfbf1]',
    heading: 'text-teal-700',
    item: 'text-teal-900',
  },
  fuchsia: {
    box: 'border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-[#fae8ff]',
    heading: 'text-fuchsia-700',
    item: 'text-fuchsia-900',
  },
  amber: {
    box: 'border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50',
    heading: 'text-amber-700',
    item: 'text-amber-900',
  },
  cyan: {
    box: 'border-cyan-200 bg-gradient-to-br from-cyan-50 to-[#cffafe]',
    heading: 'text-cyan-700',
    item: 'text-cyan-900',
  },
  indigo: {
    box: 'border-indigo-200 bg-gradient-to-br from-indigo-50 to-[#e0e7ff]',
    heading: 'text-indigo-700',
    item: 'text-indigo-900',
  },
}

type Props = {
  problem: Problem
  /** Panel title, default 题型分析 */
  heading?: string
  /** Icon before heading, default 🔍 */
  headingIcon?: string
  variant?: SolutionPanelVariant
  className?: string
  /** Extra content below analysis box (e.g. lesson37 diagram) */
  footer?: ReactNode
  /** Extra content beside analysis box in wide layout (e.g. lesson36 flow chart) */
  children?: ReactNode
  /** Hide analysis image even if available */
  hideImage?: boolean
}

function AnalysisBox({
  problem,
  heading,
  headingIcon,
  variant,
  hideImage,
}: {
  problem: Problem
  heading: string
  headingIcon: string
  variant: SolutionPanelVariant
  hideImage?: boolean
}) {
  const styles = VARIANT_STYLES[variant]
  return (
    <div className={clsx('mb-3.5 rounded-lg border p-3.5', styles.box)}>
      <div className={clsx('mb-1.5 flex items-center gap-1 text-xs font-bold', styles.heading)}>
        {headingIcon} {heading}
      </div>
      {problem.analysis.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {problem.analysis.map((a, i) => (
            <li
              key={i}
              className={clsx(
                'flex items-start gap-1.5 text-xs leading-relaxed [&_strong]:font-bold',
                styles.item,
              )}
            >
              <span className="shrink-0">💡</span>
              <span dangerouslySetInnerHTML={{ __html: a }} />
            </li>
          ))}
        </ul>
      )}
      {!hideImage && <ProblemAnalysisImage problem={problem} />}
    </div>
  )
}

/** Unified 题解 panel: analysis bullets + optional 题解图. Used by all lesson ProblemDetail pages. */
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
  const box = (
    <AnalysisBox
      problem={problem}
      heading={heading}
      headingIcon={headingIcon}
      variant={variant}
      hideImage={hideImage}
    />
  )

  if (children) {
    return (
      <div className={clsx('flex flex-col gap-4 min-[900px]:flex-row min-[900px]:items-start', className)}>
        <div>
          {box}
          {children}
        </div>
      </div>
    )
  }

  if (footer) {
    return (
      <div className={className}>
        {box}
        {footer}
      </div>
    )
  }

  return <div className={className}>{box}</div>
}
