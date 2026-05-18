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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
            }
          : {
              background: `linear-gradient(135deg, var(--tw-gradient-stops))`,
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 6px 24px rgba(0,0,0,0.3)',
            }
      }
    >
      {!used && (
        <div
          className={`absolute inset-0 bg-gradient-to-br ${meta.gradient}`}
          aria-hidden
        />
      )}

      <div className="relative p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-[28px] ${used ? 'grayscale opacity-40' : ''}`}>
              {meta.emoji}
            </span>
            <div>
              <div
                className="text-[15px] font-black"
                style={{ color: used ? 'rgba(245,243,255,0.3)' : '#ffffff' }}
              >
                {used ? <s>{meta.label}</s> : meta.label}
              </div>
              <div
                className="text-[10px] font-semibold mt-0.5"
                style={{ color: used ? 'rgba(245,243,255,0.25)' : 'rgba(255,255,255,0.7)' }}
              >
                {used ? `已使用 ${formatDate(voucher.usedAt!)}` : `${formatDate(voucher.redeemedAt)} 兑换`}
              </div>
            </div>
          </div>
          {!used && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                backdropFilter: 'blur(4px)',
              }}
            >
              50 ⭐
            </span>
          )}
        </div>

        {!used && onMarkUsed && (
          <button
            type="button"
            onClick={onMarkUsed}
            className="mt-3 w-full rounded-xl py-2 text-[12px] font-extrabold transition-all hover:opacity-90"
            style={{
              background: 'rgba(255,255,255,0.18)',
              color: '#fff',
              backdropFilter: 'blur(4px)',
            }}
          >
            标记已使用
          </button>
        )}
      </div>
    </div>
  )
}
