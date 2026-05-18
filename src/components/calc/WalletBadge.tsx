'use client'

interface Props {
  balance: number
  className?: string
}

export default function WalletBadge({ balance, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-extrabold tabular-nums ${className}`}
      style={{
        background: 'rgba(245,158,11,0.15)',
        border: '1px solid rgba(245,158,11,0.35)',
        color: '#fbbf24',
        boxShadow: '0 0 10px rgba(245,158,11,0.15)',
      }}
    >
      <span className="text-[13px] leading-none">⭐</span>
      <span>{balance}</span>
    </span>
  )
}
