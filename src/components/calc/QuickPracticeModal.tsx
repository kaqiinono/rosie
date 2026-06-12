'use client'

/**
 * Reusable "quick practice" modal.
 * Used by: vouchers page (earn stars), settings page (test a difficulty level).
 * Shows real-time per-question star earnings, streak bonuses, and running total.
 */

import { useEffect, useMemo } from 'react'
import NumberPad from './NumberPad'
import { buildSession } from '@/utils/calc-helpers'
import { REMAINDER_BLOCK_IDS } from '@/utils/calc-blocks'
import { formatAnswer } from '@/utils/calc-answer'
import { useCalcSession } from '@/hooks/useCalcSession'
import type { CalcQuestion, CalcSettings } from '@/utils/type'

interface Props {
  /** Modal title shown in the header bar */
  title: string
  /** Subtitle / description line */
  subtitle?: string
  /** Pre-built question list, OR pass `settings` + `buildCount` to auto-build */
  questions?: CalcQuestion[]
  /** If `questions` is omitted, build from these settings */
  settings?: CalcSettings
  /** Number of questions to build (ignored when `questions` is provided) */
  buildCount?: number
  soundEnabled: boolean
  /** Goal stars — shown as progress denominator; omit to hide the goal */
  goalStars?: number
  /** Called when the session ends (user finishes or dismisses).
   *  starsEarned = total first-try stars accumulated. */
  onClose: (starsEarned: number) => void
  /** Customise the completion CTA label */
  doneLabel?: string
}

export default function QuickPracticeModal({
  title,
  subtitle,
  questions: propQuestions,
  settings,
  buildCount = 15,
  soundEnabled,
  goalStars,
  onClose,
  doneLabel = '收好星星，返回 →',
}: Props) {
  // Build or use provided questions exactly once
  const questions = useMemo<CalcQuestion[]>(() => {
    if (propQuestions) return propQuestions
    if (!settings) return []
    // The modal only has a NumberPad; remainder needs the商/余 pad, so drop those blocks here.
    const padSettings = {
      ...settings,
      selectedBlocks: settings.selectedBlocks.filter((id) => !REMAINDER_BLOCK_IDS.has(id)),
    }
    return buildSession(padSettings, buildCount, { problemStates: new Map() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const session = useCalcSession(questions, soundEnabled)
  const { idx, currentQ, input, setInput, feedback, streak, starsTotal, lastResult, done, progress, results } = session

  const starsLeft = goalStars !== undefined ? Math.max(0, goalStars - starsTotal) : null

  // ── Done screen ───────────────────────────────────────────────────────
  if (done) {
    const total = results.length
    const correct = results.filter(r => r.firstTry).length
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0

    return (
      <ModalShell onClose={() => onClose(starsTotal)}>
        <div className="text-center">
          <div
            className="text-[52px] mb-1"
            style={{ animation: 'pop-in 0.4s cubic-bezier(.34,1.56,.64,1)' }}
          >
            {accuracy >= 90 ? '🎉' : accuracy >= 70 ? '🌈' : '💫'}
          </div>
          <div
            className="font-fredoka text-[24px] font-black mb-1"
            style={{
              background: 'linear-gradient(90deg, #fbbf24, #f9a8d4, #a5f3fc)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            挑战完成！
          </div>

          {/* Stars earned */}
          <div
            className="mx-auto mt-3 mb-4 inline-block rounded-2xl px-5 py-3"
            style={{
              background: 'rgba(251,191,36,0.12)',
              border: '1.5px solid rgba(251,191,36,0.35)',
            }}
          >
            <div
              className="text-[11px] font-extrabold tracking-widest uppercase mb-0.5"
              style={{ color: 'rgba(251,191,36,0.55)' }}
            >
              本次获得
            </div>
            <div
              className="font-fredoka text-[36px] font-black leading-none"
              style={{
                background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              ⭐ {starsTotal}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-5">
            <div
              className="rounded-xl px-3 py-2"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'rgba(74,222,128,0.6)' }}>一次答对</div>
              <div className="font-fredoka text-[20px] font-black" style={{ color: '#4ade80' }}>{correct}</div>
            </div>
            <div
              className="rounded-xl px-3 py-2"
              style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}
            >
              <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'rgba(196,181,253,0.5)' }}>正确率</div>
              <div className="font-fredoka text-[20px] font-black" style={{ color: '#c4b5fd' }}>{accuracy}%</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onClose(starsTotal)}
            className="w-full rounded-2xl py-3 text-[15px] font-black text-white transition-all hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #d97706, #ec4899)',
              boxShadow: '0 6px 20px rgba(245,158,11,0.3)',
            }}
          >
            {doneLabel}
          </button>
        </div>
      </ModalShell>
    )
  }

  // ── Answering screen ──────────────────────────────────────────────────
  return (
    <ModalShell title={title} subtitle={subtitle} onClose={() => onClose(starsTotal)}>
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="flex-1 h-2 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.07)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #fbbf24, #f9a8d4)',
              boxShadow: '0 0 8px rgba(251,191,36,0.5)',
            }}
          />
        </div>
        <span
          className="shrink-0 text-[11px] font-bold tabular-nums"
          style={{ color: 'rgba(245,243,255,0.4)' }}
        >
          {idx + 1}/{questions.length}
        </span>
      </div>

      {/* ── Real-time star row ── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {/* Running total */}
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1 shrink-0"
          style={{
            background: 'rgba(251,191,36,0.12)',
            border: '1px solid rgba(251,191,36,0.25)',
          }}
        >
          <span className="text-[14px]">⭐</span>
          <span
            className="font-fredoka text-[15px] font-black tabular-nums"
            style={{ color: '#fbbf24' }}
          >
            {starsTotal}
          </span>
          {starsLeft !== null && starsLeft > 0 && (
            <span className="text-[10px] font-semibold" style={{ color: 'rgba(251,191,36,0.45)' }}>
              /{goalStars}
            </span>
          )}
          {starsLeft === 0 && goalStars !== undefined && (
            <span className="text-[10px] font-extrabold" style={{ color: '#4ade80' }}>✓ 达成!</span>
          )}
        </div>

        {/* Streak + bonus label */}
        {streak >= 2 && (
          <div
            className="flex items-center gap-1 rounded-full px-2.5 py-1"
            style={{
              background: 'rgba(251,146,60,0.15)',
              border: '1px solid rgba(251,146,60,0.3)',
            }}
          >
            <span className="text-[12px]">🔥</span>
            <span className="text-[11px] font-extrabold" style={{ color: '#fb923c' }}>
              {streak >= 10 ? `连对${streak} +2加成` : streak >= 5 ? `连对${streak} +1加成` : `连对${streak}`}
            </span>
          </div>
        )}

        {/* Per-question result badge */}
        {lastResult && lastResult.stars > 0 && (
          <div
            className="flex items-center gap-1 rounded-full px-2.5 py-1"
            style={{
              background: 'rgba(34,197,94,0.15)',
              border: '1px solid rgba(34,197,94,0.3)',
              animation: 'float-up 0.7s ease-out forwards',
            }}
          >
            <span className="text-[11px] font-extrabold" style={{ color: '#4ade80' }}>
              +{lastResult.stars} ⭐
              {lastResult.bonus > 0 && (
                <span style={{ color: '#fb923c' }}> 含+{lastResult.bonus}加成</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* ── Question ── */}
      <div
        className="py-5 text-center select-none"
        key={idx}
        style={{ animation: 'fade-up 0.28s ease backwards' }}
      >
        {currentQ && (() => {
          const m = currentQ.display.match(/^(.*?)\s*=\s*\?\s*$/)
          const hasSeparator = m !== null
          const expr = m?.[1] ?? currentQ.display
          return (
          <>
            <div
              className="font-fredoka font-black tracking-tight leading-none"
              style={{
                fontSize: 'clamp(38px, 8vw, 54px)',
                color: '#f5f3ff',
                textShadow: '0 0 20px rgba(251,191,36,0.2)',
              }}
            >
              {expr}
            </div>
            {hasSeparator && (
              <div
                className="mt-2 font-fredoka font-black"
                style={{ fontSize: 'clamp(26px, 5vw, 36px)', color: 'rgba(251,191,36,0.35)' }}
              >
                = ?
              </div>
            )}
          </>
          )
        })()}
      </div>

      {/* ── Inline feedback banner ── */}
      <div className="mb-3" style={{ minHeight: 46 }}>
        {feedback === 'correct' && (
          <div
            className="py-2 text-center rounded-xl text-[15px] font-extrabold"
            style={{
              background: 'rgba(34,197,94,0.15)',
              border: '1px solid rgba(34,197,94,0.3)',
              color: '#4ade80',
              animation: 'pop-in 0.25s ease',
            }}
          >
            ✓ 答对啦！{lastResult && lastResult.stars > 0 ? `本题 +${lastResult.stars} ⭐` : '（第二次）'}
          </div>
        )}
        {feedback === 'retry' && (
          <div
            className="py-2 text-center rounded-xl text-[15px] font-extrabold"
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
            className="py-2 text-center rounded-xl text-[14px] font-extrabold"
            style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#f87171',
            }}
          >
            答案是{' '}
            <span className="font-fredoka text-[18px]" style={{ color: '#fca5a5' }}>
              {currentQ ? formatAnswer(currentQ.answer) : ''}
            </span>
            ，下次加油！
          </div>
        )}
      </div>

      {/* ── Input ── */}
      <div
        className="mx-auto mb-3 h-14 max-w-[240px] flex items-center justify-center rounded-2xl transition-all duration-200"
        style={{
          background: 'rgba(251,191,36,0.06)',
          border: `1.5px solid ${input ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.1)'}`,
          boxShadow: input ? '0 0 14px rgba(251,191,36,0.15)' : 'none',
        }}
      >
        <span
          className="font-fredoka font-black leading-none tabular-nums"
          style={{
            fontSize: 'clamp(24px, 5vw, 32px)',
            color: input ? '#fde68a' : 'rgba(255,255,255,0.15)',
          }}
        >
          {input || '·'}
        </span>
      </div>

      {/* ── NumberPad ── */}
      <NumberPad
        value={input}
        onChange={setInput}
        onSubmit={session.handleSubmit}
        disabled={!!feedback || done}
      />

      <button
        type="button"
        onClick={() => onClose(starsTotal)}
        className="mt-4 w-full text-[11px] font-semibold hover:opacity-70 transition-opacity"
        style={{ color: 'rgba(245,243,255,0.28)' }}
      >
        先这样，保留 {starsTotal} ⭐ 离开
      </button>
    </ModalShell>
  )
}

// ── Modal shell ───────────────────────────────────────────────────────────────

interface ShellProps {
  title?: string
  subtitle?: string
  children: React.ReactNode
  onClose: () => void
}

function ModalShell({ title, subtitle, children, onClose }: ShellProps) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(14px)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-[420px] rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5"
        style={{
          background: 'rgba(10,9,30,0.98)',
          border: '1px solid rgba(251,191,36,0.18)',
          boxShadow: '0 -8px 40px rgba(251,191,36,0.1), 0 0 80px rgba(139,92,246,0.15)',
          animation: 'slide-up 0.3s cubic-bezier(.34,1.56,.64,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div
          className="mx-auto mb-4 h-1 w-10 rounded-full sm:hidden"
          style={{ background: 'rgba(255,255,255,0.15)' }}
        />
        {title && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[18px]">✨</span>
            <div>
              <div
                className="font-fredoka text-[17px] font-black leading-tight"
                style={{
                  background: 'linear-gradient(90deg, #fbbf24, #f9a8d4)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {title}
              </div>
              {subtitle && (
                <div className="text-[11px] font-semibold mt-0.5" style={{ color: 'rgba(245,243,255,0.35)' }}>
                  {subtitle}
                </div>
              )}
            </div>
            <span className="text-[14px] ml-auto">🌟</span>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
