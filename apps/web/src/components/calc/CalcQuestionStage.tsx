'use client'

/**
 * Shared "question stage" — the equation + answer-surface area of a calc screen.
 *
 * This is the single source of truth for how each answer型 is laid out, so the
 * type-preview demo (`/calc/demo`) and the real session (`/calc/session`) stay
 * pixel-for-pixel identical: tweak the styling here and both update at once.
 *
 * Layout per type (all fill their flex-column parent, keypad pinned to bottom):
 *   · 数字键盘 (int / decimal / 逆运算挖空): inline AnswerBox in the equation +
 *     NumberPad at the bottom.
 *   · 竖式 (answerMode='vertical'): no header — the grid IS the question, filling
 *     the space via CalcAnswerInput's `fill`.
 *   · 余数 / 分数: EquationHeader centered above + the dedicated pad below.
 *
 * Grading stays with the caller; this component only renders surfaces and
 * forwards each pad's result.
 */

import CalcAnswerInput from './CalcAnswerInput'
import NumberPad from './NumberPad'
import { type FeedbackKind } from './FeedbackOverlay'
import type { CalcQuestion } from '@rosie/core'

// ── Expression header (used by 余数 / 分数) ─────────────────────────────────────
// Pad-less types render the answer surface below, so the header ends with "=" —
// no lonely "?". `size` lets future callers keep a readable (non-dominating)
// equation above a grid.

export function EquationHeader({
  display,
  size = 'lg',
  withEquals = true,
}: {
  display: string
  size?: 'lg' | 'md'
  withEquals?: boolean
}) {
  const expr = display.replace(/\s*=\s*\?\s*$/, '').trim()
  const fontSize = size === 'lg' ? 'clamp(30px, 9vw, 44px)' : 'clamp(24px, 6.5vw, 34px)'
  return (
    <div className="flex select-none justify-center">
      <span
        className="font-fredoka leading-none font-black tracking-tight"
        style={{ fontSize, color: '#f5f3ff', textShadow: '0 0 20px rgba(139,92,246,0.25)' }}
      >
        {withEquals ? `${expr} =` : expr}
      </span>
    </div>
  )
}

// ── Inline answer box — the box itself IS the "?" ──────────────────────────────

export function AnswerBox({ value }: { value: string }) {
  const filled = value.length > 0
  return (
    <span
      className="inline-flex items-center justify-center rounded-2xl px-3 transition-all"
      style={{
        minWidth: 'clamp(62px, 17vw, 90px)',
        height: 'clamp(52px, 14vw, 68px)',
        border: `2px solid ${filled ? 'rgba(168,139,250,0.75)' : 'rgba(168,139,250,0.3)'}`,
        background: filled ? 'rgba(139,92,246,0.16)' : 'rgba(139,92,246,0.05)',
        boxShadow: filled ? '0 0 22px rgba(139,92,246,0.3)' : 'none',
      }}
    >
      <span
        className="font-fredoka font-black tabular-nums"
        style={{
          fontSize: 'clamp(28px, 8vw, 40px)',
          color: filled ? '#e9d5ff' : 'rgba(196,181,253,0.4)',
        }}
      >
        {value || '?'}
      </span>
    </span>
  )
}

// ── Equation line with the answer box placed where the unknown sits ────────────

export function EquationLine({ display, input }: { display: string; input: string }) {
  const bigNum = (text: string) => (
    <span
      className="font-fredoka leading-none font-black tracking-tight"
      style={{ fontSize: 'clamp(30px, 9vw, 44px)', color: '#f5f3ff', textShadow: '0 0 20px rgba(139,92,246,0.25)' }}
    >
      {text}
    </span>
  )

  let left: string
  let right: string | null
  if (display.includes('□')) {
    // Inverse form: the box sits where the blank is — "48 + ▢ = 105".
    const i = display.indexOf('□')
    left = display.slice(0, i).trim()
    right = display.slice(i + 1).trim()
  } else {
    // Normal form: "7 × 8 =" then the box.
    left = `${display.replace(/\s*=\s*\?\s*$/, '').trim()} =`
    right = null
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 px-2">
      {bigNum(left)}
      <AnswerBox value={input} />
      {right && bigNum(right)}
    </div>
  )
}

// ── Inline feedback (overlay — no layout shift) ───────────────────────────────

function InlineQuestionFeedback({
  feedback,
  revealAnswer,
}: {
  feedback: FeedbackKind
  revealAnswer: string | null
}) {
  if (!feedback || feedback === 'correct' || feedback === 'challenge-correct') return null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center px-3">
      {feedback === 'retry' && (
        <span
          className="rounded-lg px-3 py-1.5 text-[13px] font-extrabold"
          style={{
            background: 'rgba(251,191,36,0.14)',
            border: '1px solid rgba(251,191,36,0.28)',
            color: '#fbbf24',
          }}
        >
          🤔 再想想～
        </span>
      )}
      {feedback === 'wrong' && (
        <span
          className="rounded-lg px-3 py-1.5 text-[13px] font-extrabold"
          style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#f87171',
          }}
        >
          答案是{' '}
          <span className="font-fredoka text-[18px]" style={{ color: '#fca5a5' }}>
            {revealAnswer}
          </span>
          ，下次加油！
        </span>
      )}
    </div>
  )
}

// ── Challenge badge (optional, above the equation) ─────────────────────────────

function ChallengeBadge() {
  return (
    <div
      className="mb-3 inline-block rounded-full px-3 py-0.5 text-[10px] font-extrabold tracking-widest text-white uppercase"
      style={{
        background: 'linear-gradient(90deg, #f59e0b, #ec4899)',
        boxShadow: '0 0 16px rgba(245,158,11,0.4)',
      }}
    >
      ⭐ 挑战题 ×2
    </div>
  )
}

// ── The stage ──────────────────────────────────────────────────────────────────

type Props = {
  question: CalcQuestion
  /** Highlight this as a challenge question (badge above the equation). */
  isChallenge?: boolean
  disabled: boolean
  /** Remount key forwarded to inner pads so a new question / retry resets them. */
  padKey: string | number
  /** Outer container classes (padding etc.). Defaults to the demo's phone padding. */
  className?: string
  /** Number-pad path (input-driven). */
  input: string
  onInputChange: (v: string) => void
  onNumberSubmit: () => void
  /** Single-shot grade for a "num/den" string. */
  onFractionSubmit: (raw: string) => void
  /** Single-shot grade for a "商…余" string. */
  onRemainderSubmit: (raw: string) => void
  /** Single-shot grade for self-checking 竖式 components (true = correct, plus the child's typed answer for diagnosis). */
  onVerticalSubmit: (correct: boolean, userAnswer: string) => void
  /** Inline retry/wrong hint — rendered over the question area without shifting layout. */
  feedback?: FeedbackKind
  revealAnswer?: string | null
  attempt?: number
  /** 沉浸模式：竖式不显示对错着色，无文字反馈。 */
  immersive?: boolean
}

export default function CalcQuestionStage({
  question,
  isChallenge = false,
  disabled,
  padKey,
  className = 'px-4 pb-5',
  input,
  onInputChange,
  onNumberSubmit,
  onFractionSubmit,
  onRemainderSubmit,
  onVerticalSubmit,
  feedback = null,
  revealAnswer = null,
  attempt = 0,
  immersive = false,
}: Props) {
  const outer = `flex min-h-0 flex-1 flex-col ${className}`

  const isVertical = question.answerMode === 'vertical'
  const isNumberPad =
    !isVertical && (question.answer.kind === 'int' || question.answer.kind === 'decimal')

  const answerInput = (
    <CalcAnswerInput
      key={padKey}
      question={question}
      disabled={disabled}
      variant="full"
      fill={isVertical}
      input={input}
      onInputChange={onInputChange}
      onNumberSubmit={onNumberSubmit}
      onFractionSubmit={onFractionSubmit}
      onRemainderSubmit={onRemainderSubmit}
      onVerticalSubmit={onVerticalSubmit}
      attempt={attempt}
      feedback={immersive ? null : feedback}
      revealAnswer={immersive ? null : revealAnswer}
      immersive={immersive}
    />
  )

  // 数字键盘: equation (with inline answer box) centered, keypad anchored bottom.
  if (isNumberPad) {
    return (
      <div className={outer}>
        <div className="relative flex flex-1 flex-col items-center justify-center">
          {isChallenge && <ChallengeBadge />}
          <EquationLine display={question.display} input={input} />
          <InlineQuestionFeedback feedback={feedback} revealAnswer={revealAnswer} />
        </div>
        <div className="mx-auto w-full max-w-[320px]">
          <NumberPad
            key={padKey}
            value={input}
            onChange={onInputChange}
            onSubmit={onNumberSubmit}
            disabled={disabled}
            allowDecimal={question.answer.kind === 'decimal'}
          />
        </div>
      </div>
    )
  }

  // 竖式: no header — the grid fills the space, keypad pinned at the bottom.
  if (isVertical) {
    return <div className={outer}>{answerInput}</div>
  }

  // 余数 / 分数: equation centered above, answer surface at the bottom.
  return (
    <div className={`${outer} overflow-y-auto`}>
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center py-3">
        {isChallenge && <ChallengeBadge />}
        <EquationHeader display={question.display} size="lg" />
        <InlineQuestionFeedback feedback={feedback} revealAnswer={revealAnswer} />
      </div>
      <div className="shrink-0">{answerInput}</div>
    </div>
  )
}
