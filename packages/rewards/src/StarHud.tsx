'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useStarHud } from './StarHudProvider'
import { STAR_COLOR_HEX, type StarColor } from './star-types'
import ColoredStar from './ColoredStar'

const ORDER: StarColor[] = ['yellow', 'red', 'blue']

interface ChipProps {
  color: StarColor
  value: number
  bumped: boolean
}

function Chip({ color, value, bumped }: ChipProps) {
  const hex = STAR_COLOR_HEX[color]
  return (
    <div
      className="flex items-center gap-0.5 rounded-full px-1 py-0.5 transition-transform"
      style={{
        background: hex.bg,
        border: `1.5px solid ${hex.border}`,
        boxShadow: `0 2px 0 ${hex.border}`,
        color: hex.outline,
        transform: bumped ? 'scale(1.18)' : 'scale(1)',
        transition: 'transform 280ms cubic-bezier(.34,1.56,.64,1)',
      }}
      aria-label={`${hex.cnLabel}${hex.shapeLabel} ${value}`}
    >
      <ColoredStar color={color} size={15} glow={0} />
      <span
        className="font-fredoka text-[12px] leading-none font-black tabular-nums"
        style={{ color: hex.outline }}
      >
        {value}
      </span>
    </div>
  )
}

const HIDE_ON = ['/login']

function useBalanceBump(balance: number) {
  const [bumped, setBumped] = useState(false)
  const [prev, setPrev] = useState(balance)
  if (balance !== prev) {
    if (balance > prev) setBumped(true)
    setPrev(balance)
  }
  useEffect(() => {
    if (!bumped) return
    const t = window.setTimeout(() => setBumped(false), 360)
    return () => window.clearTimeout(t)
  }, [bumped])
  return bumped
}

export default function StarHud() {
  const { yellowBalance, redBalance, blueBalance } = useStarHud()
  const router = useRouter()
  const pathname = usePathname()
  const bumpY = useBalanceBump(yellowBalance)
  const bumpR = useBalanceBump(redBalance)
  const bumpB = useBalanceBump(blueBalance)

  if (HIDE_ON.some((p) => pathname?.startsWith(p))) return null

  const values: Record<StarColor, number> = {
    yellow: yellowBalance,
    red: redBalance,
    blue: blueBalance,
  }
  const bumps: Record<StarColor, boolean> = { yellow: bumpY, red: bumpR, blue: bumpB }

  return (
    <button // native-ok: 该包不能依赖 @rosie/ui
      type="button"
      onClick={() => router.push('/vouchers')}
      aria-label="查看奖券与星星余额"
      className="group flex h-9 items-center gap-1.5 rounded-full px-1.5 transition-all hover:-translate-y-0.5 active:scale-95"
      style={{
        background: 'rgba(255,255,255,0.78)',
        border: '2px solid rgba(245,158,11,0.35)',
        boxShadow: '0 3px 0 rgba(251,191,36,.3), inset 0 1px 0 rgba(255,255,255,0.7)',
      }}
    >
      {ORDER.map((c) => (
        <Chip key={c} color={c} value={values[c]} bumped={bumps[c]} />
      ))}
      <span
        className="mr-1 ml-0.5 hidden text-[11px] font-extrabold sm:inline"
        style={{ color: 'rgba(91,33,182,0.6)' }}
      >
        奖券 →
      </span>
    </button>
  )
}
