'use client'

import type { Voucher } from '@/utils/type'
import { VOUCHER_META } from '@/utils/calc-helpers'

interface Props {
  voucher: Voucher
  onMarkUsed?: () => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export default function VoucherCard({ voucher, onMarkUsed }: Props) {
  const meta = VOUCHER_META[voucher.category]
  const used = voucher.usedAt !== null

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={
        used
          ? {
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.06)',
            }
          : {
              border: '1px solid rgba(255,255,255,0.13)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05)',
            }
      }
    >
      {/* Gradient background for active vouchers */}
      {!used && (
        <div
          className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-[0.18]`}
          aria-hidden
        />
      )}

      {/* Subtle dot-pattern overlay */}
      {!used && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '14px 14px',
          }}
          aria-hidden
        />
      )}

      <div className="relative p-4">
        {/* Top: emoji icon + name + cost */}
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[24px] leading-none ${used ? 'opacity-25 grayscale' : ''}`}
            style={used ? {} : {
              background: 'rgba(255,255,255,0.12)',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}
          >
            {meta.emoji}
          </div>

          <div className="min-w-0 flex-1">
            <div
              className="text-[14px] font-black leading-snug"
              style={{ color: used ? 'rgba(245,243,255,0.22)' : '#ffffff' }}
            >
              {used ? <s>{meta.label}</s> : meta.label}
            </div>
            <div
              className="mt-0.5 text-[11px] font-extrabold tabular-nums"
              style={{ color: used ? 'rgba(251,191,36,0.22)' : 'rgba(251,191,36,0.85)' }}
            >
              {voucher.coinsSpent} ⭐
            </div>
          </div>

          {used && (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.2)' }}
            >
              已用
            </span>
          )}
        </div>

        {/* Perforated divider */}
        <div
          className="my-3 border-t border-dashed"
          style={{ borderColor: used ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.14)' }}
        />

        {/* Bottom: date metadata */}
        <div
          className="text-[10px] font-semibold"
          style={{ color: used ? 'rgba(245,243,255,0.18)' : 'rgba(255,255,255,0.45)' }}
        >
          {used
            ? `已用 · ${formatDate(voucher.usedAt!)}`
            : `兑换于 ${formatDate(voucher.redeemedAt)}`}
        </div>

        {/* Action button */}
        {!used && onMarkUsed && (
          <button
            type="button"
            onClick={onMarkUsed}
            className="mt-3 w-full rounded-xl py-2 text-[12px] font-extrabold transition-all hover:opacity-80 active:scale-95"
            style={{
              background: 'rgba(255,255,255,0.13)',
              color: '#fff',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            标记已使用 ✓
          </button>
        )}
      </div>
    </div>
  )
}
