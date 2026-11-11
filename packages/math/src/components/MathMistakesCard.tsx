'use client'

import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { useMathWrong } from '@rosie/math-kit/hooks/useMathWrong'

export default function MathMistakesCard() {
  const { user } = useAuth()
  const { wrongIds } = useMathWrong(user)
  const count = wrongIds.size

  return (
    <Link
      href="/math/mistakes"
      className="group hover:shadow-sticker relative block h-full w-full overflow-hidden rounded-[20px] no-underline transition-all duration-300 hover:-translate-y-1"
      style={{
        background: '#fee2e2',
        border: '2px solid rgba(239,68,68,.3)',
        boxShadow: '0 3px 0 rgba(239,68,68,.3)',
      }}
    >
      <div className="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full bg-red-300/20" />
      <div className="pointer-events-none absolute -bottom-4 left-8 h-16 w-16 rounded-full bg-rose-300/25" />

      <div className="relative px-4 py-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xl">📕</span>
            <span className="text-[14px] font-extrabold tracking-tight text-red-800">错题本</span>
            {count > 0 && (
              <span
                className="rounded-full px-1.5 py-px text-[10px] font-extrabold text-white"
                style={{ background: '#ef4444' }}
              >
                {count}
              </span>
            )}
          </div>
          <span className="text-[12px] font-bold text-red-500 transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </div>
        <div className="text-[11px] leading-relaxed font-medium text-red-700/80">
          {count > 0 ? (
            <>
              待巩固 <strong className="text-red-800">{count}</strong> 题
              <br />
              答对自动移出
            </>
          ) : (
            <>
              跨讲汇总
              <br />
              集中复习
            </>
          )}
        </div>
      </div>
    </Link>
  )
}
