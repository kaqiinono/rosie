'use client'

/**
 * 口算题型预览 Demo — `/calc/demo`
 *
 * A gallery of every answer surface the calc module can produce, each rendered
 * through the shared `CalcQuestionStage` — the SAME component the real session
 * uses — so a preview can never drift from the real thing. Cards are playable in
 * place (real input echo + the pads' own self-check); full grading/scoring lives
 * only in the real session, reached via each card's 「打开」link to
 * `/calc/demo/[key]`. This page adds NO custom styling or logic of its own.
 */

import { useState } from 'react'
import Link from 'next/link'
import CalcQuestionStage from '@/components/calc/CalcQuestionStage'
import CalcSessionStatusBar from '@/components/calc/CalcSessionStatusBar'
import CalcFeedbackBanner from '@/components/calc/CalcFeedbackBanner'
import { SAMPLES, type Sample } from './samples'

const noop = () => {}

// ── One phone-frame preview — playable in place; 「打开」links to the detail page ──

function DemoCard({ sample }: { sample: Sample }) {
  const { question } = sample
  // Local input state so the number pad echoes; self-grading pads (竖式/分数/余数)
  // drive their own internal state, so they're fully interactive on the card too.
  const [input, setInput] = useState('')

  return (
    <div className="flex flex-col gap-2">
      {/* Label */}
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h3 className="text-[14px] font-black" style={{ color: '#e9d5ff' }}>
          {sample.title}
        </h3>
        <Link
          href={`/calc/demo/${sample.key}`}
          className="shrink-0 text-[11px] font-bold no-underline"
          style={{ color: '#c4b5fd' }}
        >
          打开 ↗
        </Link>
      </div>
      <p className="px-1 text-[11px] leading-snug" style={{ color: 'rgba(196,181,253,0.45)' }}>
        {sample.note}
      </p>

      {/* Phone frame — playable preview */}
      <div
        className="relative mx-auto flex w-full max-w-[400px] flex-col overflow-hidden rounded-[2rem]"
        style={{
          height: 'min(720px, 78svh)',
          minHeight: 560,
          background: 'radial-gradient(120% 80% at 50% 0%, #15132e 0%, #0a0820 60%)',
          border: '1px solid rgba(139,92,246,0.22)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
        }}
      >
        {/* Session chrome — the SAME shared components the real session renders,
            so the demo can't drift. Static idle props (untimed, question 1, no
            coins/feedback) reflect the real first-question state. */}
        <div className="shrink-0 px-4 pt-3">
          <CalcSessionStatusBar
            remainingSec={null}
            idx={0}
            planned={10}
            total={10}
            streak={0}
            coinsTotal={0}
            lastResult={null}
          />
          <CalcFeedbackBanner feedback={null} reduceHint={false} lastResult={null} revealAnswer={null} secondTry={false} />
        </div>

        {/* Playable stage — local input only; submit/grade lives on the detail page */}
        <div className="flex min-h-0 flex-1 flex-col">
          <CalcQuestionStage
            padKey={sample.key}
            question={question}
            isChallenge={question.isChallenge}
            disabled={false}
            input={input}
            onInputChange={setInput}
            onNumberSubmit={noop}
            onFractionSubmit={noop}
            onRemainderSubmit={noop}
            onVerticalSubmit={noop}
          />
        </div>
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function CalcDemoPage() {
  return (
    <main className="min-h-screen px-3 pt-5 pb-16 sm:px-5" style={{ background: '#07061a' }}>
      <div className="mx-auto max-w-[1280px]">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-fredoka text-[24px] font-black" style={{ color: '#f5f3ff' }}>
              口算题型预览
            </h1>
            <p className="mt-0.5 text-[12px]" style={{ color: 'rgba(196,181,253,0.5)' }}>
              {SAMPLES.length} 种作答形态 · 卡片可直接试玩，点「打开」进入与练习一致的单题全屏页
            </p>
          </div>
          <Link
            href="/calc/settings"
            className="rounded-full px-3 py-1.5 text-[12px] font-extrabold no-underline"
            style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}
          >
            ← 返回设置
          </Link>
        </div>

        {/* Gallery */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {SAMPLES.map((s) => (
            <DemoCard key={s.key} sample={s} />
          ))}
        </div>
      </div>
    </main>
  )
}
