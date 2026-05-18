'use client'

import Link from 'next/link'
import WalletBadge from './WalletBadge'

interface Props {
  balance: number
  soundEnabled: boolean
  onToggleSound: () => void
  title?: string
  backHref?: string
  backLabel?: string
  rightExtra?: React.ReactNode
}

export default function CalcAppHeader({
  balance,
  soundEnabled,
  onToggleSound,
  title = '口算天地',
  backHref = '/',
  backLabel = '首页',
  rightExtra,
}: Props) {
  return (
    <header
      className="sticky top-0 z-30"
      style={{
        background: 'rgba(10,9,30,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(139,92,246,0.18)',
        boxShadow: '0 2px 24px rgba(139,92,246,0.12)',
      }}
    >
      <div className="mx-auto flex h-14 max-w-[640px] items-center gap-3 px-4">
        <Link
          href={backHref}
          className="flex h-9 items-center gap-1.5 rounded-full px-3 text-violet-300 no-underline transition-all hover:text-white"
          style={{
            background: 'rgba(139,92,246,0.15)',
            border: '1px solid rgba(139,92,246,0.25)',
          }}
        >
          <span className="text-[14px] font-bold leading-none">←</span>
          <span className="hidden text-[12px] font-bold sm:inline">{backLabel}</span>
        </Link>

        <div className="flex flex-1 items-center gap-2 min-w-0">
          <span className="inline-block text-xl">🧮</span>
          <div
            className="font-fredoka font-extrabold text-[17px] leading-tight tracking-tight truncate"
            style={{
              background: 'linear-gradient(90deg, #c4b5fd, #f0abfc)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {title}
          </div>
        </div>

        <WalletBadge balance={balance} />
        {rightExtra}

        <button
          type="button"
          onClick={onToggleSound}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[14px] text-violet-300 transition-all hover:text-white"
          style={{
            background: 'rgba(139,92,246,0.15)',
            border: '1px solid rgba(139,92,246,0.2)',
          }}
          aria-label={soundEnabled ? '关闭音效' : '开启音效'}
          title={soundEnabled ? '关闭音效' : '开启音效'}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>
      </div>
    </header>
  )
}
