'use client'

import { useEffect, useState } from 'react'

const HOP_LEFT = '/brand/rosie-fun-hop-left.png'
const HOP_RIGHT = '/brand/rosie-fun-hop-right.png'
const MASCOT = '/brand/rosie-fun-mascot.png'
const MASCOT_BLINK = '/brand/rosie-fun-mascot-blink.png'

const FIGURE_SIZE = 'h-28 w-28 md:h-36 md:w-36 lg:h-44 lg:w-44'
const CAPTION_STYLE =
  'text-sm font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]'

type LoadingVariant = 'scurry' | 'roundspin'

/** 左右来回蹦：hop-left / hop-right 按方向切换，脚下阴影同步收缩 */
function ScurryFigure() {
  return (
    <div className="relative h-44 w-[240px] md:w-[280px]">
      <div className="absolute inset-0 flex items-start justify-center">
        <div className="rosieload-scurry">
          <div className={`rosieload-bounce relative ${FIGURE_SIZE}`}>
            <img
              src={HOP_RIGHT}
              alt="Rosie 向右跳"
              className={`rosieload-face-right absolute inset-0 h-full w-full object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.25)]`}
            />
            <img
              src={HOP_LEFT}
              alt="Rosie 向左跳"
              className={`rosieload-face-left absolute inset-0 h-full w-full object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.25)]`}
            />
          </div>
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
      <img
        src={MASCOT}
        alt="Rosie 站立"
        className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.25)]"
      />
      <img
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
function RoundSpinLoading() {
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
        <div className="rosieload-turn-shadow -mt-1 h-2.5 w-20 rounded-full bg-black blur-[2px]" />
      </div>
      <p className={CAPTION_STYLE}>加载中...</p>
    </>
  )
}

export default function LoadingOverlay({ visible }: { visible: boolean }) {
  const [variant, setVariant] = useState<LoadingVariant>('roundspin')

  // 每次导航开始随机抽一种表演，避免 SSR/水合阶段的随机性
  useEffect(() => {
    if (visible) {
      setVariant(Math.random() < 0.5 ? 'scurry' : 'roundspin')
    }
  }, [visible])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3 bg-black/30 backdrop-blur-sm"
    >
      {variant === 'scurry' ? <ScurryLoading /> : <RoundSpinLoading />}
    </div>
  )
}
