'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@rosie/core'
import { useCalcSettings } from '@/hooks/useCalcSettings'
import { useCalcWallet } from '@rosie/rewards'
import { useCalcMistakes } from '@/hooks/useCalcMistakes'
import CalcAppHeader from '@/components/calc/CalcAppHeader'
import MistakeRow from '@/components/calc/MistakeRow'
import { categoryLabel } from '@/utils/calc-helpers'
import type { CalcCategory, CalcMistake } from '@rosie/core'

export default function CalcMistakesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { settings, update } = useCalcSettings(user)
  const wallet = useCalcWallet(user)
  const { mistakes, isLoading } = useCalcMistakes(user)
  const [showResolved, setShowResolved] = useState(false)

  const grouped = useMemo(() => {
    const buckets: Record<CalcCategory, CalcMistake[]> = { addsub: [], muldiv: [], mixed: [] }
    for (const m of mistakes) {
      if (m.resolved && !showResolved) continue
      buckets[m.category].push(m)
    }
    return buckets
  }, [mistakes, showResolved])

  const unresolvedCount = mistakes.filter(m => !m.resolved).length
  const resolvedCount = mistakes.filter(m => m.resolved).length

  const startPractice = () => {
    if (unresolvedCount === 0) return
    const count = Math.min(unresolvedCount, settings.lastCount)
    router.push(`/calc/session?count=${count}&time=0&mode=mistakes`)
  }

  return (
    <>
      <CalcAppHeader
        balance={wallet.balance}
        soundEnabled={settings.soundEnabled}
        onToggleSound={() => update({ soundEnabled: !settings.soundEnabled })}
        title="错题本"
        backHref="/calc"
        backLabel="口算"
      />

      <main className="mx-auto max-w-[640px] px-4 pt-5 pb-12 space-y-4 relative">
        {/* CTA */}
        <button
          type="button"
          onClick={startPractice}
          disabled={unresolvedCount === 0}
          className="w-full rounded-2xl px-5 py-3.5 text-[16px] font-black text-white transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          style={{
            background: unresolvedCount > 0
              ? 'linear-gradient(135deg, #d97706, #f97316)'
              : 'rgba(255,255,255,0.05)',
            boxShadow: unresolvedCount > 0 ? '0 6px 24px rgba(245,158,11,0.3)' : 'none',
            border: unresolvedCount > 0 ? 'none' : '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {unresolvedCount > 0 ? `📝 一键专项练（${unresolvedCount} 题）→` : '✨ 暂无错题需要练习'}
        </button>

        {isLoading && (
          <div className="py-10 text-center text-[13px]" style={{ color: 'rgba(196,181,253,0.4)' }}>
            加载中…
          </div>
        )}

        {!isLoading && (['addsub', 'muldiv', 'mixed'] as CalcCategory[]).map((cat) => {
          const list = grouped[cat]
          if (list.length === 0) return null
          return (
            <section key={cat}>
              <div className="mb-2 flex items-center gap-2">
                <h3
                  className="text-[11px] font-extrabold tracking-widest uppercase"
                  style={{ color: 'rgba(196,181,253,0.45)' }}
                >
                  {categoryLabel(cat)}
                </h3>
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-extrabold"
                  style={{
                    background: 'rgba(139,92,246,0.18)',
                    color: '#a78bfa',
                  }}
                >
                  {list.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {list.map((m) => (
                  <MistakeRow key={m.signature} mistake={m} />
                ))}
              </div>
            </section>
          )
        })}

        {!isLoading && resolvedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowResolved(v => !v)}
            className="w-full rounded-xl py-2 text-[12px] font-extrabold transition-all"
            style={{
              background: showResolved ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.06)',
              border: '1px solid rgba(34,197,94,0.2)',
              color: '#4ade80',
            }}
          >
            {showResolved ? `🙈 隐藏已掌握（${resolvedCount}）` : `🦋 查看已掌握（${resolvedCount}）`}
          </button>
        )}

        {!isLoading && mistakes.length === 0 && (
          <div
            className="rounded-2xl px-6 py-10 text-center"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '2px dashed rgba(139,92,246,0.2)',
            }}
          >
            <div className="text-4xl mb-2">🌟</div>
            <div className="text-[13px] font-bold" style={{ color: '#c4b5fd' }}>
              还没有错题，太厉害啦！
            </div>
            <div className="text-[11px] mt-1" style={{ color: 'rgba(196,181,253,0.4)' }}>
              继续保持～
            </div>
          </div>
        )}
      </main>
    </>
  )
}
