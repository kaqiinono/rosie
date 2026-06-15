'use client'

/**
 * Shared answer-input surface for every calc practice path.
 *
 * Centralises the "which pad does this question need" branching (分数 / 余数 /
 * 竖式 / 数字键盘) so the real session (`/calc/session`) and the settings-page
 * preview modal never drift apart again. Grading stays with the caller — this
 * component only renders the right pad and forwards each pad's result.
 */

import NumberPad from './NumberPad'
import RemainderPad from './RemainderPad'
import FractionPad from './FractionPad'
import FractionPie from './FractionPie'
import VerticalCalc from './VerticalCalc'
import DivisionVertical from './DivisionVertical'
import MultiplicationVertical from './MultiplicationVertical'
import { fractionPieSpec } from '@/utils/calc-helpers'
import { parseSignature } from '@/utils/calc-ast'
import type { CalcQuestion } from '@/utils/type'
import type { FeedbackKind } from './FeedbackOverlay'

type Variant = 'full' | 'compact'

interface NumStyle {
  box: string
  bg: string
  borderOn: string
  borderOff: string
  glow: string
  font: string
  colorOn: string
  colorOff: string
  padWrap: string
}

const NUM_STYLE: Record<Variant, NumStyle> = {
  full: {
    box: 'mx-auto mb-4 flex h-16 max-w-[260px] items-center justify-center rounded-2xl transition-all duration-200',
    bg: 'rgba(139,92,246,0.08)',
    borderOn: 'rgba(139,92,246,0.4)',
    borderOff: 'rgba(139,92,246,0.2)',
    glow: '0 0 14px rgba(139,92,246,0.15)',
    font: 'clamp(28px, 6vw, 38px)',
    colorOn: '#e9d5ff',
    colorOff: 'rgba(196,181,253,0.25)',
    padWrap: 'mx-auto max-w-[320px]',
  },
  compact: {
    box: 'mx-auto mb-3 flex h-14 max-w-[240px] items-center justify-center rounded-2xl transition-all duration-200',
    bg: 'rgba(251,191,36,0.06)',
    borderOn: 'rgba(251,191,36,0.4)',
    borderOff: 'rgba(255,255,255,0.1)',
    glow: '0 0 14px rgba(251,191,36,0.15)',
    font: 'clamp(24px, 5vw, 32px)',
    colorOn: '#fde68a',
    colorOff: 'rgba(255,255,255,0.15)',
    padWrap: '',
  },
}

type Props = {
  question: CalcQuestion
  disabled: boolean
  /** Visual scale: `full` for the session route, `compact` for the modal. */
  variant?: Variant
  /**
   * Stretch the 竖式 surface to fill its parent's height, pinning the keypad to
   * the bottom (full width) and letting the grid use the space above. Requires
   * the parent to be a flex column with a definite height.
   */
  fill?: boolean
  /** Number-pad path (two-try, input-driven). */
  input: string
  onInputChange: (v: string) => void
  onNumberSubmit: () => void
  /** Single-shot grade for a "num/den" string. */
  onFractionSubmit: (raw: string) => void
  /** Single-shot grade for a "商…余" string. */
  onRemainderSubmit: (raw: string) => void
  /** Single-shot grade for self-checking 竖式 components (true = correct, plus the child's typed answer for diagnosis). */
  onVerticalSubmit: (correct: boolean, userAnswer: string) => void
  attempt?: number
  feedback?: FeedbackKind
  revealAnswer?: string | null
  immersive?: boolean
}

export default function CalcAnswerInput({
  question,
  disabled,
  variant = 'full',
  fill = false,
  input,
  onInputChange,
  onNumberSubmit,
  onFractionSubmit,
  onRemainderSubmit,
  onVerticalSubmit,
  attempt = 0,
  feedback = null,
  revealAnswer = null,
  immersive = false,
}: Props) {
  if (question.answer.kind === 'fraction') {
    const spec = fractionPieSpec(question)
    return spec ? (
      <FractionPie
        operands={spec.operands}
        den={spec.den}
        op={spec.op}
        disabled={disabled}
        onSubmit={(n) => onFractionSubmit(`${n}/${spec.den}`)}
      />
    ) : (
      <FractionPad disabled={disabled} onSubmit={onFractionSubmit} />
    )
  }

  if (question.answer.kind === 'remainder') {
    return <RemainderPad disabled={disabled} onSubmit={onRemainderSubmit} />
  }

  if (question.answerMode === 'vertical') {
    const ast = parseSignature(question.signature)
    if (typeof ast === 'number' || typeof ast.left !== 'number' || typeof ast.right !== 'number') {
      return null
    }
    if (ast.op === 'div') {
      return (
        <DivisionVertical
          dividend={ast.left}
          divisor={ast.right}
          disabled={disabled}
          attempt={attempt}
          fill={fill}
          feedback={feedback}
          revealAnswer={revealAnswer}
          immersive={immersive}
          onSubmit={(r) => onVerticalSubmit(r.correct, r.quotient.join(''))}
        />
      )
    }
    // Multi-digit multiplier (e.g. 47 × 38): use the partial-product 竖式 so each
    // a × digit step is shown and graded, then summed. Single-digit multipliers
    // (47 × 8) stay on VerticalCalc — one row IS the answer, no sum step.
    if (ast.op === 'mul' && ast.right >= 10) {
      return (
        <MultiplicationVertical
          a={ast.left}
          b={ast.right}
          disabled={disabled}
          attempt={attempt}
          fill={fill}
          feedback={feedback}
          revealAnswer={revealAnswer}
          immersive={immersive}
          onSubmit={(r) => onVerticalSubmit(r.correct, r.userResult.join(''))}
        />
      )
    }
    const opSym = ast.op === 'add' ? '+' : ast.op === 'sub' ? '-' : '×'
    return (
      <VerticalCalc
        a={ast.left}
        b={ast.right}
        op={opSym}
        disabled={disabled}
        attempt={attempt}
        fill={fill}
        feedback={feedback}
        revealAnswer={revealAnswer}
        immersive={immersive}
        onSubmit={(r) => onVerticalSubmit(r.resultCorrect, r.userResult.join(''))}
      />
    )
  }

  const s = NUM_STYLE[variant]
  return (
    <>
      {/* Input echo */}
      <div
        className={s.box}
        style={{
          background: s.bg,
          border: `1.5px solid ${input ? s.borderOn : s.borderOff}`,
          boxShadow: input ? s.glow : 'none',
        }}
      >
        <span
          className="font-fredoka leading-none font-black tabular-nums"
          style={{ fontSize: s.font, color: input ? s.colorOn : s.colorOff }}
        >
          {input || '·'}
        </span>
      </div>

      {/* Pad */}
      <div className={s.padWrap || undefined}>
        <NumberPad
          value={input}
          onChange={onInputChange}
          onSubmit={onNumberSubmit}
          disabled={disabled}
          allowDecimal={question.answer.kind === 'decimal'}
        />
      </div>
    </>
  )
}
