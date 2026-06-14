'use client'

/**
 * Per-type demo — `/calc/demo/[key]`. Renders ONE answer surface in the exact
 * session frame (via `DemoQuestion`) so each type can be checked against 正常
 * 练习/测试 in isolation. Prev/next chips walk through all types.
 */

import { useParams } from 'next/navigation'
import Link from 'next/link'
import DemoQuestion from '../DemoQuestion'
import { SAMPLES, sampleByKey } from '../samples'

export default function CalcDemoTypePage() {
  const params = useParams<{ key: string }>()
  const key = params.key
  const sample = sampleByKey(key)

  if (!sample) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4" style={{ background: '#07061a' }}>
        <p className="text-[14px]" style={{ color: 'rgba(196,181,253,0.6)' }}>
          找不到题型「{key}」
        </p>
        <Link
          href="/calc/demo"
          className="rounded-full px-4 py-2 text-[13px] font-extrabold no-underline"
          style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}
        >
          ← 返回题型预览
        </Link>
      </main>
    )
  }

  const idx = SAMPLES.findIndex((s) => s.key === sample.key)
  const prev = SAMPLES[(idx - 1 + SAMPLES.length) % SAMPLES.length]
  const next = SAMPLES[(idx + 1) % SAMPLES.length]

  const navChip = (s: typeof prev, label: string) => (
    <Link
      key={label}
      href={`/calc/demo/${s.key}`}
      className="rounded-full px-2.5 py-1 text-[12px] font-extrabold no-underline transition-opacity hover:opacity-80"
      style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}
      aria-label={`${label}：${s.title}`}
      title={s.title}
    >
      {label}
    </Link>
  )

  return (
    <DemoQuestion
      sample={sample}
      headerExtra={
        <div className="flex items-center gap-1.5">
          {navChip(prev, '‹')}
          <span className="text-[11px] font-bold tabular-nums" style={{ color: 'rgba(196,181,253,0.5)' }}>
            {idx + 1}/{SAMPLES.length}
          </span>
          {navChip(next, '›')}
        </div>
      }
    />
  )
}
