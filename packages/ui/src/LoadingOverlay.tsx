'use client'

import Image from 'next/image'
import { useHydrated } from '@rosie/core'
import { useEffect, useState } from 'react'

const HOP_LEFT = '/brand/rosie-fun-hop-left.png'
const HOP_RIGHT = '/brand/rosie-fun-hop-right.png'
const MASCOT = '/brand/rosie-fun-mascot.png'
const MASCOT_BLINK = '/brand/rosie-fun-mascot-blink.png'

const FIGURE_SIZE = 'h-28 w-28 md:h-36 md:w-36 lg:h-44 lg:w-44'
const CAPTION_STYLE = 'text-sm font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]'

type LoadingVariant = 'scurry' | 'roundspin'

/** 左右来回蹦：hop-left / hop-right 按方向切换，脚下阴影同步收缩 */
function ScurryFigure() {
  return (
    <div className="relative h-44 w-[240px] md:w-[280px]">
      <div className="absolute inset-0 flex items-start justify-center">
        <div className="rosieload-scurry">
          <div className={`rosieload-bounce relative ${FIGURE_SIZE}`}>
            <Image
              fill
              sizes="(min-width: 1024px) 176px, (min-width: 768px) 144px, 112px"
              loading="eager"
              src={HOP_RIGHT}
              alt="Rosie 向右跳"
              className={`rosieload-face-right absolute inset-0 h-full w-full object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.25)]`}
            />
            <Image
              fill
              sizes="(min-width: 1024px) 176px, (min-width: 768px) 144px, 112px"
              loading="eager"
              src={HOP_LEFT}
              alt="Rosie 向左跳"
              className={`rosieload-face-left absolute inset-0 h-full w-full object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.25)]`}
            />
          </div>
          {/* visual-ok: 吉祥物脚下的地面投影，属于插画 */}
          <div className="rosieload-shadow mx-auto mt-1 h-2.5 w-20 rounded-full bg-black blur-[2px]" />
        </div>
      </div>
    </div>
  )
}

/** 慢等待安抚态：站立 + 周期性眨眼 */
function CalmFigure() {
  return (
    <div className={`relative ${FIGURE_SIZE}`}>
      <Image
        fill
        sizes="(min-width: 1024px) 176px, (min-width: 768px) 144px, 112px"
        loading="eager"
        src={MASCOT}
        alt="Rosie 站立"
        className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.25)]"
      />
      <Image
        fill
        sizes="(min-width: 1024px) 176px, (min-width: 768px) 144px, 112px"
        loading="eager"
        src={MASCOT_BLINK}
        alt=""
        aria-hidden
        className="rosieload-blink absolute inset-0 h-full w-full object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.25)]"
      />
    </div>
  )
}

/** 方案三：先左右蹦蹦，等待超过 3 秒切换为站立眨眼安抚 */
function ScurryLoading() {
  const [calm, setCalm] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setCalm(true), 3000)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <>
      {calm ? <CalmFigure /> : <ScurryFigure />}
      <p className={CAPTION_STYLE}>{calm ? '别急，马上就好…' : '加载中...'}</p>
    </>
  )
}

/** 方案五：圆球身体 sprite 转圈（8 帧真实视角），身体起伏 + 脚下阴影 */
function RoundSpinLoading({ inContent = false }: { inContent?: boolean }) {
  return (
    <>
      <div className="flex flex-col items-center">
        <div className="rosieload-turn-body drop-shadow-[0_12px_18px_rgba(0,0,0,0.25)]">
          <div
            role="img"
            aria-label="Rosie 开心地转圈"
            className={`rosieload-round-turn-sprite ${FIGURE_SIZE}`}
          />
        </div>
        {/* visual-ok: 吉祥物脚下的地面投影，属于插画 */}
        <div className="rosieload-turn-shadow -mt-1 h-2.5 w-20 rounded-full bg-black blur-[2px]" />
      </div>
      <p className={inContent ? 'text-text-secondary text-sm font-semibold' : CAPTION_STYLE}>
        加载中...
      </p>
    </>
  )
}

type ConfettiShape = 'flower' | 'star' | 'dot'
type ConfettiPiece = {
  left: string
  top: string
  size: number
  shape: ConfettiShape
  color: string
  delay: number
  dur: number
}

/** 位置固定（避免 SSR / hydrate 不一致），中间留给吉祥物；纯色，无渐变和投影 */
const CONFETTI: ConfettiPiece[] = [
  { left: '8%', top: '14%', size: 26, shape: 'flower', color: 'text-rose-300', delay: 0, dur: 3.6 },
  { left: '24%', top: '8%', size: 14, shape: 'dot', color: 'text-amber-300', delay: 0.6, dur: 3 },
  { left: '40%', top: '16%', size: 20, shape: 'star', color: 'text-amber-400', delay: 1.1, dur: 4 },
  { left: '62%', top: '9%', size: 24, shape: 'flower', color: 'text-sky-300', delay: 0.3, dur: 3.8 },
  { left: '80%', top: '15%', size: 16, shape: 'dot', color: 'text-rose-300', delay: 1.4, dur: 3.2 },
  { left: '91%', top: '30%', size: 22, shape: 'star', color: 'text-emerald-300', delay: 0.9, dur: 4.2 },
  { left: '5%', top: '38%', size: 18, shape: 'star', color: 'text-sky-300', delay: 1.7, dur: 3.4 },
  { left: '17%', top: '52%', size: 28, shape: 'flower', color: 'text-amber-300', delay: 0.4, dur: 4 },
  { left: '84%', top: '50%', size: 28, shape: 'flower', color: 'text-rose-300', delay: 1.2, dur: 3.7 },
  { left: '30%', top: '70%', size: 14, shape: 'dot', color: 'text-emerald-300', delay: 0.2, dur: 3.1 },
  { left: '10%', top: '78%', size: 20, shape: 'star', color: 'text-rose-300', delay: 1.5, dur: 3.9 },
  { left: '48%', top: '82%', size: 24, shape: 'flower', color: 'text-sky-300', delay: 0.8, dur: 3.5 },
  { left: '68%', top: '72%', size: 16, shape: 'dot', color: 'text-amber-300', delay: 1.9, dur: 3.3 },
  { left: '88%', top: '80%', size: 20, shape: 'star', color: 'text-amber-400', delay: 0.5, dur: 4.1 },
  { left: '74%', top: '30%', size: 12, shape: 'dot', color: 'text-sky-300', delay: 1, dur: 3.6 },
  { left: '22%', top: '28%', size: 12, shape: 'dot', color: 'text-rose-300', delay: 2, dur: 3.2 },
]

function ConfettiShapeIcon({ shape }: { shape: ConfettiShape }) {
  if (shape === 'dot') return <circle cx="12" cy="12" r="7" fill="currentColor" />
  if (shape === 'star') {
    return (
      <path
        d="M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.7L12 17.5l-5.9 3.3 1.3-6.7L2.5 9.5l6.6-.8z"
        fill="currentColor"
        strokeLinejoin="round"
      />
    )
  }
  return (
    <g fill="currentColor">
      <circle cx="12" cy="6" r="4.5" />
      <circle cx="18" cy="12" r="4.5" />
      <circle cx="12" cy="18" r="4.5" />
      <circle cx="6" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="3" className="fill-amber-100" />
    </g>
  )
}

/** 加载页背景撒花：纯装饰，不拦截点击，对读屏隐藏 */
function ConfettiBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {CONFETTI.map((piece, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          width={piece.size}
          height={piece.size}
          className={`rosieload-confetti absolute ${piece.color}`}
          style={{
            left: piece.left,
            top: piece.top,
            ['--confetti-delay' as string]: `${piece.delay}s`,
            ['--confetti-dur' as string]: `${piece.dur}s`,
          }}
        >
          <ConfettiShapeIcon shape={piece.shape} />
        </svg>
      ))}
    </div>
  )
}

type LoadingOverlayProps = { visible: boolean; placement?: 'overlay' | 'content' }

export default function LoadingOverlay({ visible, placement = 'overlay' }: LoadingOverlayProps) {
  if (!visible) return null
  if (placement === 'content') {
    return (
      <div
        role="status"
        className="relative flex flex-1 flex-col items-center justify-center gap-3 overflow-hidden"
      >
        <ConfettiBackdrop />
        <div className="relative flex flex-col items-center gap-3">
          <RoundSpinLoading inContent />
        </div>
      </div>
    )
  }
  return <LoadingAnimation />
}

function LoadingAnimation() {
  const hydrated = useHydrated()
  const [variant] = useState<LoadingVariant>(() => (Math.random() < 0.5 ? 'scurry' : 'roundspin'))

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3 bg-amber-950/30"
    >
      {hydrated && variant === 'scurry' ? <ScurryLoading /> : <RoundSpinLoading />}
    </div>
  )
}
