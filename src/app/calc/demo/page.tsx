'use client'

/**
 * 口算题型预览 Demo — `/calc/demo`
 *
 * A non-persisted gallery of every answer surface the calc module can produce,
 * each shown inside a phone-sized frame laid out the way the session screen looks.
 * The frames here are NON-interactive previews — the whole card links to the
 * per-type detail page (`/calc/demo/[key]`), where the question is fully playable
 * in the exact session frame. Both render through the shared `CalcQuestionStage`,
 * so the preview and the real thing can't drift.
 */

import Link from 'next/link'
import CalcQuestionStage from '@/components/calc/CalcQuestionStage'
import { SAMPLES, type Sample } from './samples'

const noop = () => {}

// ── One clickable phone-frame preview (links to the detail page) ────────────

function DemoCard({ sample }: { sample: Sample }) {
  const { question } = sample

  return (
    <Link
      href={`/calc/demo/${sample.key}`}
      className="group flex flex-col gap-2 no-underline"
    >
      {/* Label */}
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h3 className="text-[14px] font-black" style={{ color: '#e9d5ff' }}>
          {sample.title}
        </h3>
        <span
          className="shrink-0 text-[11px] font-bold opacity-70 transition-opacity group-hover:opacity-100"
          style={{ color: '#c4b5fd' }}
        >
          打开 ↗
        </span>
      </div>
      <p className="px-1 text-[11px] leading-snug" style={{ color: 'rgba(196,181,253,0.45)' }}>
        {sample.note}
      </p>

      {/* Phone frame — preview only; clicks fall through to the card link */}
      <div
        className="relative mx-auto flex w-full max-w-[400px] flex-col overflow-hidden rounded-[2rem] transition-transform group-hover:-translate-y-1"
        style={{
          height: 'min(720px, 78svh)',
          minHeight: 560,
          background: 'radial-gradient(120% 80% at 50% 0%, #15132e 0%, #0a0820 60%)',
          border: '1px solid rgba(139,92,246,0.22)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
        }}
      >
        {/* Top bar — collapsed to a single row */}
        <div className="shrink-0 px-4 pt-4">
          <div className="flex items-center justify-between text-[12px] font-bold">
            <span style={{ color: 'rgba(196,181,253,0.55)' }}>⏱ ∞</span>
            <span style={{ color: 'rgba(245,243,255,0.55)' }}>1 / 10</span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5"
              style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}
            >
              ⭐ 0
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div className="h-full w-[10%] rounded-full" style={{ background: 'linear-gradient(90deg,#7c3aed,#a855f7)' }} />
          </div>
        </div>

        {/* Banner slot spacer (parity with the session's feedback row) */}
        <div className="h-7 shrink-0" />

        {/* Non-interactive stage — pointer events disabled so the card link wins */}
        <div className="pointer-events-none flex min-h-0 flex-1 flex-col">
          <CalcQuestionStage
            padKey={sample.key}
            question={question}
            isChallenge={question.isChallenge}
            disabled={false}
            input=""
            onInputChange={noop}
            onNumberSubmit={noop}
            onFractionSubmit={noop}
            onRemainderSubmit={noop}
            onVerticalSubmit={noop}
          />
        </div>
      </div>
    </Link>
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
              {SAMPLES.length} 种作答形态 · 点卡片进入与练习一致的单题全屏页作答
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
