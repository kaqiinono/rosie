'use client'

import { useState } from 'react'
import type { VoucherCategory } from '@/utils/type'
import { VOUCHER_META, VOUCHER_PRICE } from '@/utils/calc-helpers'

interface Props {
  balance: number
  onCancel: () => void
  onConfirm: (category: VoucherCategory) => Promise<void> | void
}

const CATEGORIES: VoucherCategory[] = ['movie', 'snack', 'toy', 'wish', 'cartoon', 'generic']

export default function VoucherRedeemModal({ balance, onCancel, onConfirm }: Props) {
  const [selected, setSelected] = useState<VoucherCategory | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const canSubmit = selected !== null && balance >= VOUCHER_PRICE && !submitting

  const handleConfirm = async () => {
    if (!selected || submitting) return
    setSubmitting(true)
    await onConfirm(selected)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
      onClick={() => !submitting && onCancel()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-3xl p-6"
        style={{
          background: 'rgba(13,11,38,0.98)',
          border: '1px solid rgba(139,92,246,0.25)',
          boxShadow: '0 24px 60px rgba(139,92,246,0.2)',
          animation: 'pop-in 0.32s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        <div
          className="mb-0.5 font-fredoka text-[22px] font-black"
          style={{
            background: 'linear-gradient(90deg, #c4b5fd, #f0abfc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          兑换奖券
        </div>
        <div className="text-[12px] mb-4" style={{ color: 'rgba(245,243,255,0.4)' }}>
          消耗{' '}
          <span className="font-extrabold" style={{ color: '#fbbf24' }}>
            {VOUCHER_PRICE} ⭐
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {CATEGORIES.map(cat => {
            const meta = VOUCHER_META[cat]
            const active = selected === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelected(cat)}
                className="relative overflow-hidden rounded-2xl p-3 transition-all"
                style={{
                  background: active ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${active ? 'rgba(139,92,246,0.55)' : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: active ? '0 4px 20px rgba(139,92,246,0.25)' : 'none',
                  transform: active ? 'scale(1.04)' : 'scale(1)',
                }}
              >
                {active && (
                  <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-10`} />
                )}
                <div className="relative text-[28px]">{meta.emoji}</div>
                <div
                  className="relative mt-1 text-[11px] font-extrabold"
                  style={{ color: active ? '#c4b5fd' : 'rgba(245,243,255,0.5)' }}
                >
                  {meta.label}
                </div>
              </button>
            )
          })}
        </div>

        <div
          className="rounded-xl px-3 py-2 text-[12px] font-bold mb-5"
          style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.2)',
            color: '#fbbf24',
          }}
        >
          当前 ⭐ {balance}
          {selected && balance >= VOUCHER_PRICE
            ? `，兑换后剩 ${balance - VOUCHER_PRICE}`
            : balance < VOUCHER_PRICE ? '（不足 50）' : ''}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 rounded-xl py-2.5 text-[13px] font-extrabold transition-all disabled:opacity-50"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(245,243,255,0.5)',
            }}
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="flex-[2] rounded-xl py-2.5 text-[13px] font-extrabold text-white transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              boxShadow: canSubmit ? '0 4px 20px rgba(139,92,246,0.4)' : 'none',
            }}
          >
            {submitting ? '兑换中…' : '确认兑换'}
          </button>
        </div>
      </div>
    </div>
  )
}
