'use client'

import { type FeedbackKind } from './FeedbackOverlay'

/** Compact retry / wrong hint — fixed slot height so the page does not jump. */
export default function QuestionFeedbackHint({
  feedback,
  revealAnswer,
}: {
  feedback: FeedbackKind
  revealAnswer: string | null
}) {
  const show =
    feedback === 'retry' || feedback === 'wrong'

  return (
    <div
      className="flex shrink-0 items-center justify-center px-3 text-center text-[13px] font-extrabold"
      style={{ minHeight: 36, color: show ? undefined : 'transparent' }}
      aria-live="polite"
    >
      {feedback === 'retry' && <span style={{ color: '#fbbf24' }}>🤔 再想想～</span>}
      {feedback === 'wrong' && (
        <span style={{ color: '#f87171' }}>
          答案是{' '}
          <span className="font-fredoka text-[18px]" style={{ color: '#fca5a5' }}>
            {revealAnswer}
          </span>
          ，下次加油！
        </span>
      )}
      {!show && <span aria-hidden>·</span>}
    </div>
  )
}
