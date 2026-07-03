'use client'

import { useMemo, type CSSProperties } from 'react'
import clsx from 'clsx'
import { parseBlankDisplay } from '../../utils/chinese-blank-display'

type QuizBlankSize = 'lg' | 'md'
type QuizBlankAlign = 'center' | 'start'

interface QuizBlankSentenceProps {
  display: string
  size?: QuizBlankSize
  align?: QuizBlankAlign
  className?: string
}

function BlankSlot({ charCount }: { charCount: number }) {
  return (
    <span
      className="cn-blank-slot"
      style={{ '--cn-blank-chars': charCount } as CSSProperties}
      aria-label={`${charCount}字空格`}
      role="img"
    >
      <span className="cn-blank-slot-mark" aria-hidden>
        ?
      </span>
    </span>
  )
}

export default function QuizBlankSentence({
  display,
  size = 'lg',
  align = 'center',
  className,
}: QuizBlankSentenceProps) {
  const segments = useMemo(() => parseBlankDisplay(display), [display])

  return (
    <p
      className={clsx(
        'cn-blank-sentence text-stone-800',
        align === 'start' ? 'text-left' : 'text-center',
        size === 'lg' ? 'cn-blank-sentence--lg' : 'cn-blank-sentence--md',
        className,
      )}
    >
      {segments.map((seg, index) =>
        seg.kind === 'text' ? (
          <span key={`t-${index}`} className="cn-blank-sentence-text">
            {seg.text}
          </span>
        ) : (
          <BlankSlot key={`b-${index}`} charCount={seg.charCount} />
        ),
      )}
    </p>
  )
}
