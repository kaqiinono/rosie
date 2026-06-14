'use client'

/**
 * Single-question demo rendered in the EXACT frame the real session uses:
 * `CalcAppHeader` + a definite-height `<main>` + status / progress / feedback +
 * the shared `CalcQuestionStage`. This is what guarantees a per-type demo page
 * looks identical to 正常练习/测试 — same components, same layout, same sizing
 * (the 竖式's container-query scaling needs the definite-height main to resolve).
 *
 * Grading here is throwaway: a correct/wrong flash that resets for another try.
 */

import { useState, type ReactNode } from 'react'
import CalcAppHeader from '@/components/calc/CalcAppHeader'
import CalcQuestionStage from '@/components/calc/CalcQuestionStage'
import { checkAnswer, formatAnswer } from '@/utils/calc-answer'
import type { Sample } from './samples'

export default function DemoQuestion({ sample, headerExtra }: { sample: Sample; headerExtra?: ReactNode }) {
  const { question } = sample
  const [input, setInput] = useState('')
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null)
  const [round, setRound] = useState(0) // bump to remount the pad/竖式 for a fresh try

  const grade = (ok: boolean) => {
    setResult(ok ? 'correct' : 'wrong')
    // Briefly show the result, then reset so the (self-locking) pads re-enable.
    window.setTimeout(
      () => {
        setResult(null)
        setInput('')
        setRound((r) => r + 1)
      },
      ok ? 750 : 1400,
    )
  }
  const gradeRaw = (raw: string) => grade(checkAnswer(raw, question.answer))
  const reset = () => {
    setInput('')
    setResult(null)
    setRound((r) => r + 1)
  }

  return (
    <>
      <CalcAppHeader
        balance={0}
        soundEnabled
        onToggleSound={() => {}}
        title={sample.title}
        backHref="/calc/demo"
        backLabel="题型预览"
        rightExtra={headerExtra}
      />

      <main
        // Mirrors the session: a definite height (not min-height) so the 竖式's
        // container-type:size answer area resolves its cqh units.
        className="relative mx-auto flex w-full max-w-[640px] flex-col px-4 pt-3 pb-6"
        style={{ height: 'calc(100svh - 56px)' }}
      >
        {/* Top status */}
        <div
          className="mb-2 flex items-center justify-between text-[12px] font-bold tabular-nums"
          style={{ color: 'rgba(196,181,253,0.6)' }}
        >
          <div>⏱ ∞</div>
          <div style={{ color: 'rgba(245,243,255,0.5)' }}>1 / 10</div>
          <button
            type="button"
            onClick={reset}
            className="font-bold transition-opacity hover:opacity-70"
            style={{ color: 'rgba(196,181,253,0.5)' }}
          >
            ↺ 重置
          </button>
        </div>

        {/* Star chip */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1"
            style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.22)' }}
          >
            <span className="text-[13px]">⭐</span>
            <span className="font-fredoka text-[14px] font-black tabular-nums" style={{ color: '#fbbf24' }}>
              0
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-5 h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: '10%', background: 'linear-gradient(90deg, #7c3aed, #d946ef)', boxShadow: '0 0 8px rgba(139,92,246,0.5)' }}
          />
        </div>

        {/* Feedback banner */}
        <div className="mb-2 shrink-0" style={{ minHeight: 26 }}>
          {result === 'correct' && (
            <div
              className="rounded-xl py-3 text-center text-[15px] font-extrabold"
              style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', animation: 'pop-in 0.25s ease' }}
            >
              ✓ 答对啦！
            </div>
          )}
          {result === 'wrong' && (
            <div
              className="rounded-xl py-3 text-center text-[14px] font-extrabold"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.28)', color: '#f87171', animation: 'pop-in 0.25s ease' }}
            >
              答案是{' '}
              <span className="font-fredoka text-[22px]" style={{ color: '#fca5a5' }}>
                {formatAnswer(question.answer)}
              </span>
              ，下次加油！
            </div>
          )}
        </div>

        <CalcQuestionStage
          padKey={`${sample.key}-${round}`}
          question={question}
          isChallenge={question.isChallenge}
          disabled={result !== null}
          className=""
          input={input}
          onInputChange={setInput}
          onNumberSubmit={() => gradeRaw(input)}
          onFractionSubmit={gradeRaw}
          onRemainderSubmit={gradeRaw}
          onVerticalSubmit={grade}
        />
      </main>
    </>
  )
}
