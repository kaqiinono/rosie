'use client'

/**
 * Single-question demo rendered in the EXACT frame the real session uses:
 * `CalcAppHeader` + a definite-height `<main>` + the SHARED session chrome
 * (`CalcSessionStatusBar` + `CalcFeedbackBanner`) + the shared `CalcQuestionStage`.
 * Every visible surface comes from the real session components, so a per-type
 * demo can't drift from 正常练习/测试 (and the 竖式's container-query scaling gets
 * the definite-height main it needs to resolve).
 *
 * Grading here is throwaway: a correct/wrong flash that resets for another try.
 */

import { useState, type ReactNode } from 'react'
import CalcAppHeader from '@/components/calc/CalcAppHeader'
import CalcQuestionStage from '@/components/calc/CalcQuestionStage'
import CalcSessionStatusBar from '@/components/calc/CalcSessionStatusBar'
import { checkAnswer, formatAnswer } from '@/utils/calc-answer'
import type { Sample } from './samples'

export default function DemoQuestion({ sample, headerExtra }: { sample: Sample; headerExtra?: ReactNode }) {
  const { question } = sample
  const [input, setInput] = useState('')
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null)
  const [round, setRound] = useState(0) // bump to remount the pad/竖式 for a fresh try

  const grade = (ok: boolean) => {
    if (ok) {
      setInput('')
      setRound((r) => r + 1)
      return
    }
    setResult('wrong')
    window.setTimeout(() => {
      setResult(null)
      setInput('')
      setRound((r) => r + 1)
    }, 1200)
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
        rightExtra={
          <div className="flex items-center gap-2">
            {headerExtra}
            <button
              type="button"
              onClick={reset}
              className="text-[12px] font-bold transition-opacity hover:opacity-70"
              style={{ color: 'rgba(196,181,253,0.5)' }}
            >
              ↺ 重置
            </button>
          </div>
        }
      />

      <main
        // Mirrors the session: a definite height (not min-height) so the 竖式's
        // container-type:size answer area resolves its cqh units.
        className="relative mx-auto flex w-full max-w-[640px] flex-col px-4 pt-3 pb-6"
        style={{ height: 'calc(100svh - 56px)' }}
      >
        <CalcSessionStatusBar
          remainingSec={null}
          idx={0}
          planned={10}
          total={10}
          streak={0}
          coinsTotal={0}
          lastResult={null}
        />

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
          feedback={result}
          revealAnswer={formatAnswer(question.answer)}
        />
      </main>
    </>
  )
}
