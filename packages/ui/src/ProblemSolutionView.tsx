import type { ReactNode } from 'react'

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

const VARIANTS: Record<SolutionPanelVariant, { box: string; heading: string; item: string }> = {
  yellow: {
    box: 'border-[#fde68a] bg-[#fffbeb]',
    heading: 'text-yellow-dark',
    item: 'text-[#92400e]',
  },
  orange: {
    box: 'border-orange-200 bg-orange-50',
    heading: 'text-orange-700',
    item: 'text-orange-900',
  },
  sky: {
    box: 'border-[#bae6fd] bg-[#f0f9ff]',
    heading: 'text-sky-700',
    item: 'text-sky-900',
  },
  green: {
    box: 'border-green-200 bg-green-50',
    heading: 'text-green-700',
    item: 'text-green-900',
  },
  purple: {
    box: 'border-purple-200 bg-purple-50',
    heading: 'text-purple-700',
    item: 'text-purple-900',
  },
  violet: {
    box: 'border-violet-200 bg-violet-50',
    heading: 'text-violet-700',
    item: 'text-violet-900',
  },
  rose: {
    box: 'border-rose-200 bg-rose-50',
    heading: 'text-rose-700',
    item: 'text-rose-900',
  },
  teal: {
    box: 'border-teal-200 bg-teal-50',
    heading: 'text-teal-700',
    item: 'text-teal-900',
  },
  fuchsia: {
    box: 'border-fuchsia-200 bg-fuchsia-50',
    heading: 'text-fuchsia-700',
    item: 'text-fuchsia-900',
  },
  amber: {
    box: 'border-amber-200 bg-amber-50',
    heading: 'text-amber-700',
    item: 'text-amber-900',
  },
  cyan: {
    box: 'border-cyan-200 bg-cyan-50',
    heading: 'text-cyan-700',
    item: 'text-cyan-900',
  },
  indigo: {
    box: 'border-indigo-200 bg-indigo-50',
    heading: 'text-indigo-700',
    item: 'text-indigo-900',
  },
}

type ProblemSolutionViewProps = {
  analysis: string[]
  heading?: string
  headingIcon?: string
  variant?: SolutionPanelVariant
  className?: string
  image?: ReactNode
  allowTrustedHtml?: boolean
}

export default function ProblemSolutionView({
  analysis,
  heading = '题型分析',
  headingIcon = '🔍',
  variant = 'yellow',
  className,
  image,
  allowTrustedHtml = false,
}: ProblemSolutionViewProps) {
  const styles = VARIANTS[variant]
  return (
    <div
      className={['rounded-2xl border-2 p-3.5', styles.box, className].filter(Boolean).join(' ')}
    >
      <div
        className={['mb-1.5 flex items-center gap-1 text-xs font-bold', styles.heading].join(' ')}
      >
        {headingIcon} {heading}
      </div>
      {analysis.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {analysis.map((item, index) => (
            <li
              key={`${index}-${item}`}
              className={[
                'flex items-start gap-1.5 text-xs leading-relaxed [&_strong]:font-bold',
                styles.item,
              ].join(' ')}
            >
              <span className="shrink-0">💡</span>
              {allowTrustedHtml ? (
                <span dangerouslySetInnerHTML={{ __html: item }} />
              ) : (
                <span>{item}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {image}
    </div>
  )
}
