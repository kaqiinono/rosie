'use client'

import type { Voucher } from '@/utils/type'
import { VOUCHER_META, VOUCHER_PRICES } from '@/utils/calc-helpers'
import ColoredStar from '@/components/stars/ColoredStar'

interface Props {
  voucher: Voucher
  onMarkUsed?: () => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

// Light foreground tones for the vibrant gradient background — pale enough
// to stay readable against any of the saturated voucher gradients.
const STAR_TEXT = { yellow: '#fef3c7', red: '#fee2e2', blue: '#dbeafe' } as const

export default function VoucherCard({ voucher, onMarkUsed }: Props) {
  const meta = VOUCHER_META[voucher.category]
  const used = voucher.usedAt !== null
  const price = VOUCHER_PRICES[voucher.category]
  const breakdown = price
    ? [
        { color: 'yellow' as const, value: price[0] },
        { color: 'red' as const, value: price[1] },
        { color: 'blue' as const, value: price[2] },
      ].filter((c) => c.value > 0)
    : []

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={
        used
          ? {
              background: 'linear-gradient(160deg, #e2e8f0, #cbd5e1)',
              border: '1.5px solid rgba(15,23,42,0.12)',
              boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
            }
          : {
              border: '1.5px solid rgba(15,23,42,0.10)',
              boxShadow: '0 10px 28px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.35)',
            }
      }
    >
      {/* Solid vibrant gradient for active vouchers — full opacity so white text is legible */}
      {!used && (
        <div
          className={`absolute inset-0 bg-gradient-to-br ${meta.gradient}`}
          aria-hidden
        />
      )}

      {/* Subtle dot-pattern overlay for tactile "ticket" feel */}
      {!used && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '14px 14px',
          }}
          aria-hidden
        />
      )}

      {/* Top sheen for depth */}
      {!used && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.18), transparent)' }}
          aria-hidden
        />
      )}

      <div className="relative p-4">
        {/* Top: emoji icon + name + cost */}
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[24px] leading-none ${used ? 'opacity-40 grayscale' : ''}`}
            style={
              used
                ? { background: 'rgba(255,255,255,0.6)' }
                : {
                    background: 'rgba(255,255,255,0.28)',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.5)',
                  }
            }
          >
            {meta.emoji}
          </div>

          <div className="min-w-0 flex-1">
            <div
              className="text-[15px] leading-snug font-black"
              style={{
                color: used ? '#475569' : '#ffffff',
                textShadow: used ? 'none' : '0 1px 2px rgba(0,0,0,0.22)',
              }}
            >
              {used ? <s>{meta.label}</s> : meta.label}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {breakdown.length > 0 ? (
                breakdown.map((c) => (
                  <span
                    key={c.color}
                    className="inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[11px] font-black tabular-nums"
                    style={{
                      background: used ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.22)',
                      color: used ? '#475569' : STAR_TEXT[c.color],
                      opacity: used ? 0.7 : 1,
                    }}
                  >
                    <ColoredStar color={c.color} size={11} glow={used ? 0 : 4} />
                    {c.value}
                  </span>
                ))
              ) : (
                <span
                  className="text-[11px] font-extrabold tabular-nums"
                  style={{ color: used ? '#94a3b8' : 'rgba(255,255,255,0.95)' }}
                >
                  {voucher.coinsSpent} ⭐
                </span>
              )}
            </div>
          </div>

          {used && (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wider uppercase"
              style={{ background: 'rgba(15,23,42,0.10)', color: '#475569' }}
            >
              已用
            </span>
          )}
        </div>

        {/* Perforated divider */}
        <div
          className="my-3 border-t border-dashed"
          style={{ borderColor: used ? 'rgba(15,23,42,0.18)' : 'rgba(255,255,255,0.45)' }}
        />

        {/* Bottom: date metadata */}
        <div
          className="text-[11px] font-bold"
          style={{ color: used ? '#64748b' : 'rgba(255,255,255,0.92)' }}
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
            className="mt-3 w-full cursor-pointer rounded-xl py-2 text-[13px] font-extrabold transition-all hover:bg-white hover:text-slate-900 active:scale-95"
            style={{
              background: 'rgba(255,255,255,0.92)',
              color: '#0f172a',
              boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
              border: '1px solid rgba(255,255,255,0.6)',
            }}
          >
            用掉它 ✓
          </button>
        )}
      </div>
    </div>
  )
}
