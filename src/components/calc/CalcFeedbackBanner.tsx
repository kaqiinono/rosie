'use client'

/**
 * Shared inline feedback banner (答对 / 挑战答对 / 再想想 / 答案揭晓).
 *
 * Reserves a fixed-height row above the question stage so the layout never jumps
 * when feedback appears. Single source of truth shared by the real session
 * (`/calc/session`) and the type preview (`/calc/demo`).
 */

import { type FeedbackKind } from './FeedbackOverlay'

type Props = {
  feedback: FeedbackKind
  /** 分数题约分提示 — shows "还能再约一约哦～" on a correct-but-unreduced answer. */
  reduceHint: boolean
  lastResult: { stars: number } | null
  /** The correct answer text revealed on a final wrong answer. */
  revealAnswer: string | null
  /**
   * Whether this correct answer came on the second try (no stars). Drives the
   * "（第二次）" note. Must be stated explicitly by the caller — NOT inferred from
   * `lastResult` being null, since a first-try correct can also award no stars.
   */
  secondTry: boolean
}

export default function CalcFeedbackBanner({
  feedback,
  reduceHint,
  lastResult,
  revealAnswer,
  secondTry,
}: Props) {
  return (
    <div className="mb-2 shrink-0" style={{ minHeight: 26 }}>
      {feedback === 'correct' && (
        <div
          className="rounded-xl py-3 text-center text-[15px] font-extrabold"
          style={{
            background: 'rgba(34,197,94,0.15)',
            border: '1px solid rgba(34,197,94,0.3)',
            color: '#4ade80',
            animation: 'pop-in 0.25s ease',
          }}
        >
          ✓ 答对啦！
          {reduceHint
            ? '还能再约一约哦～'
            : lastResult && lastResult.stars > 0
              ? `本题 +${lastResult.stars} ⭐`
              : secondTry
                ? '（第二次）'
                : ''}
        </div>
      )}
      {feedback === 'challenge-correct' && (
        <div
          className="rounded-xl py-3 text-center text-[15px] font-extrabold"
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(236,72,153,0.15))',
            border: '1px solid rgba(245,158,11,0.4)',
            color: '#fbbf24',
            animation: 'pop-in 0.3s cubic-bezier(.34,1.56,.64,1)',
          }}
        >
          🌟 挑战题答对！{lastResult && lastResult.stars > 0 ? `+${lastResult.stars} ⭐` : ''}
        </div>
      )}
      {feedback === 'retry' && (
        <div
          className="rounded-xl py-3 text-center text-[15px] font-extrabold"
          style={{
            background: 'rgba(251,191,36,0.12)',
            border: '1px solid rgba(251,191,36,0.25)',
            color: '#fbbf24',
            animation: 'wiggle 0.4s ease',
          }}
        >
          🤔 再想想～
        </div>
      )}
      {feedback === 'wrong' && (
        <div
          className="rounded-xl py-3 text-center text-[14px] font-extrabold"
          style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.28)',
            color: '#f87171',
            animation: 'pop-in 0.25s ease',
          }}
        >
          答案是{' '}
          <span className="font-fredoka text-[22px]" style={{ color: '#fca5a5' }}>
            {revealAnswer}
          </span>
          ，下次加油！
        </div>
      )}
    </div>
  )
}
