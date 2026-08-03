'use client'

import Link from 'next/link'

interface Props {
  title?: string
  backHref?: string
  backLabel?: string
  /** When set, renders a button instead of Link (e.g. flush cloud then navigate). */
  onBack?: () => void
  rightExtra?: React.ReactNode
}

export default function CalcAppHeader({
  title = '口算天地',
  backHref = '/',
  backLabel = '首页',
  onBack,
  rightExtra,
}: Props) {
  const backClassName =
    'flex h-9 items-center gap-1.5 rounded-full px-3 text-violet-300 transition-all hover:text-white'
  const backStyle = {
    background: 'rgba(139,92,246,0.15)',
    border: '1px solid rgba(139,92,246,0.25)',
  }

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
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className={backClassName}
            style={backStyle}
          >
            <span className="text-[14px] leading-none font-bold">←</span>
            <span className="hidden text-[12px] font-bold sm:inline">{backLabel}</span>
          </button>
        ) : (
          <Link
            href={backHref}
            className={`${backClassName} no-underline`}
            style={backStyle}
          >
            <span className="text-[14px] leading-none font-bold">←</span>
            <span className="hidden text-[12px] font-bold sm:inline">{backLabel}</span>
          </Link>
        )}

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="inline-block text-xl">🧮</span>
          <div
            className="font-fredoka truncate text-[17px] leading-tight font-extrabold tracking-tight"
            style={{
              background: 'linear-gradient(90deg, #c4b5fd, #f0abfc)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {title}
          </div>
        </div>
        {rightExtra}
      </div>
    </header>
  )
}
