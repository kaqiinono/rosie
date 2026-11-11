'use client'

import type { CSSProperties, KeyboardEvent } from 'react'
import { SUBJECTS, flowersOfBud, type Bud } from './model'

export const bubbleStates = {
  ready: { tint: '#81d4ff', label: '▷ 待开始' },
  overdue: { tint: '#ffb257', label: '↻ 待补做' },
  running: { tint: '#ffe24f', label: '◷ 进行中' },
  done: { tint: '#70df8c', label: '✓ 已完成 · 点我开花' },
}
export type BubbleState = keyof typeof bubbleStates

type Props = {
  bubbles: Bud[]
  states?: Record<string, BubbleState>
  slots: Record<string, number>
  onOpen: (budId: string) => void
}

type BubbleStyle = CSSProperties & Record<'--tg-size' | '--tg-tint' | '--tg-dur' | '--tg-delay', string>

/** 放学以后飘在树旁边和上方的泡泡，同时最多 4 个，各占一个固定天空位置 */
export default function Bubbles({ bubbles, slots, states, onOpen }: Props) {
  return (
    <>
      {bubbles.map((bud) => {
        const n = flowersOfBud(bud)
        const meta = SUBJECTS[bud.subject]
        const slot = slots[bud.id] ?? 0
        const status = states?.[bud.id]
        const label = status ? bubbleStates[status].label + (status === 'running' && bud.overdue ? ' · 补做' : '') : ''
        const style: BubbleStyle = {
          '--tg-size': `clamp(${72 + n * 4}px, ${12 + n}vw, ${104 + n * 10}px)`,
          '--tg-tint': status ? bubbleStates[status].tint : meta.tint,
          '--tg-dur': `${3.8 + (slot % 3) * 0.7}s`,
          '--tg-delay': `${-slot * 0.9}s`,
        }
        return (
          <div key={bud.id} className="tg-bslot" data-slot={slot}>
            {/* native-ok: 泡泡是游戏物件，不是标准按钮，用 div + role=button 并支持键盘 */}
            <div
              role="button"
              tabIndex={0}
              data-state={status}
              data-bubble-id={bud.id}
              aria-label={`${meta.label}：${bud.name}，${n} 朵花 ${label}`}
              className="tg-bubble"
              style={style}
              onClick={() => onOpen(bud.id)}
              onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOpen(bud.id)
                }
              }}
            >
              <span className="tg-bubble-in">
                <span className="block text-[calc(var(--tg-size)*0.26)] leading-none">{meta.emoji}</span>
                <span className="mt-0.5 line-clamp-2 block text-[calc(var(--tg-size)*0.13)] font-extrabold leading-tight text-[#4a3728]">
                  {bud.name}
                </span>
                <span className="block text-[calc(var(--tg-size)*0.1)] leading-none tracking-wider">{label || '🌸'.repeat(n)}</span>
              </span>
            </div>
          </div>
        )
      })}
    </>
  )
}
