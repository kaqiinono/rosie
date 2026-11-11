'use client'

import Link from 'next/link'
import { useMathFavoritesContext } from '@rosie/math-kit/components/MathFavoritesProvider'

export default function MathFavoritesCard() {
  const { favorites } = useMathFavoritesContext()
  const total = favorites.size

  return (
    <Link
      href="/math/favorites"
      className="group hover:shadow-sticker relative flex h-full w-full flex-col overflow-hidden rounded-[20px] no-underline transition-all duration-300 hover:-translate-y-1"
      style={{
        background: '#ffe4e6',
        border: '2px solid rgba(244,63,94,.3)',
        boxShadow: '0 3px 0 rgba(244,63,94,.3)',
      }}
    >
      <div className="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full bg-rose-300/20" />
      <div className="relative px-4 py-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xl">❤️</span>
            <span className="text-[14px] font-extrabold tracking-tight text-rose-700">
              我的收藏
            </span>
          </div>
          <span className="text-[12px] font-bold text-rose-500 transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </div>
        <div className="text-[11px] leading-relaxed font-medium text-rose-700/80">
          已收藏 <strong className="text-rose-800">{total}</strong> 道好题
          <br />
          挑出来反复练
        </div>
      </div>
    </Link>
  )
}
