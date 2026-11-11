'use client'

import { voucherSolidClass, type Voucher, type VoucherTemplate } from '@rosie/core'
import { ColoredStar } from '@rosie/rewards'

interface Props {
  voucher: Voucher
  /** Template metadata — passed in by the parent which holds the catalog. */
  template?: VoucherTemplate
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

const FALLBACK_GRADIENT = 'from-slate-500 to-zinc-500'

export default function VoucherCard({ voucher, template, onMarkUsed }: Props) {
  const meta = {
    emoji: template?.emoji ?? '🎁',
    label: template?.label ?? voucher.category,
    gradient: template?.gradient ?? FALLBACK_GRADIENT,
  }
  const used = voucher.usedAt !== null
  const breakdown = template
    ? [
        { color: 'yellow' as const, value: template.priceYellow },
        { color: 'red' as const, value: template.priceRed },
        { color: 'blue' as const, value: template.priceBlue },
      ].filter((c) => c.value > 0)
    : []

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={
        used
          ? {
              background: '#e2e8f0',
              border: '1.5px solid rgba(15,23,42,0.12)',
              boxShadow: '0 3px 0 rgba(15,23,42,.3)',
            }
          : {
              border: '1.5px solid rgba(15,23,42,0.10)',
              boxShadow: '0 3px 0 rgba(15,23,42,.3), inset 0 1px 0 rgba(255,255,255,0.35)',
            }
      }
    >
      {/* Solid vibrant gradient for active vouchers — full opacity so white text is legible */}
      {!used && (
        <div className={`absolute inset-0 ${voucherSolidClass(meta.gradient)}`} aria-hidden />
      )}

      {/* Subtle dot-pattern overlay for tactile "ticket" feel */}
      {!used && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.10]"
          style={{
            // visual-ok: 票券圆点纹理
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
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[24px] leading-none ${used ? 'opacity-40 grayscale' : ''}`}
            style={
              used
                ? { background: 'rgba(255,255,255,0.6)' }
                : {
                    background: 'rgba(255,255,255,0.28)',
                    boxShadow: '0 3px 0 rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,0.5)',
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
              boxShadow: '0 3px 0 rgba(0,0,0,.3)',
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
