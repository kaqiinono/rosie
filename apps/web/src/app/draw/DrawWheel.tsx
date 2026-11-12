'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@rosie/ui/themes'
import type { PoolKind, WheelEntry } from '@rosie/rewards'

const fills = {
  reward: ['#ffe59a', '#ffd0ad', '#fff2c8', '#ffdfba'],
  penalty: ['#ded4fa', '#c6e4f6', '#eee4fc', '#dbe9ff'],
}

function point(radius: number, angle: number) {
  const radians = angle * Math.PI / 180
  return { x: radius * Math.sin(radians), y: -radius * Math.cos(radians) }
}

export default function DrawWheel({ kind, entries, busy, spinningTicket, onStop, onAction }: {
  kind: PoolKind
  entries: WheelEntry[]
  busy: boolean
  spinningTicket: string | null
  onStop: () => void
  onAction: () => void
}) {
  const pointer = useRef<SVGGElement>(null)
  const step = 360 / Math.max(1, entries.length)
  const selected = entries.findIndex(entry => entry.pending_ticket)
  const angle = selected < 0 ? 0 : selected * step
  const spinning = !!spinningTicket
  const reward = kind === 'reward'
  const label = reward ? '奖励' : '惩罚'
  const numbered = entries.length > 16 || entries.some(entry => Array.from(entry.name).length > 10)
  const empty = entries.length === 0
  const allReserved = !empty && entries.every(entry => entry.reserved)

  useEffect(() => {
    if (!spinningTicket) return
    if (!pointer.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onStop()
      return
    }
    const animation = pointer.current.animate(
      [{ transform: 'rotate(0deg)' }, { transform: `rotate(${1080 + angle}deg)` }],
      { duration: 3000, easing: 'cubic-bezier(.12,.57,.18,1)' },
    )
    animation.onfinish = onStop
    return () => animation.cancel()
  }, [spinningTicket, angle, onStop])

  return (
    <>
      <div className="relative mx-auto aspect-square w-full max-w-[26rem]">
        <svg viewBox="-166 -166 332 332" className="size-full" aria-hidden="true">
          <circle r="161" fill={reward ? '#fff0cd' : '#f4edff'} stroke={reward ? '#c79547' : '#9375bd'} strokeWidth="3" />
          {entries.map((entry, index) => {
            const mid = index * step
            const a = point(154, mid - step / 2)
            const b = point(154, mid + step / 2)
            const textAt = point(108, mid)
            const muted = entry.reserved || entry.drawn
            const fill = index === selected && !spinning ? (reward ? '#ffbc55' : '#c5a1ef')
              : muted ? '#e7e2d9' : fills[kind][index % 4]
            const letters = Array.from(entry.name)
            const lines = numbered ? [String(index + 1)] : [letters.slice(0, 5).join(''), letters.slice(5).join('')].filter(Boolean)
            const tilt = mid > 180 ? mid - 270 : mid - 90
            return (
              <g key={entry.id}>
                {entries.length === 1 ? <circle r="154" fill={fill} /> : (
                  <path d={`M0 0 L${a.x} ${a.y} A154 154 0 0 1 ${b.x} ${b.y} Z`} fill={fill} stroke="#fffaf0" strokeWidth="2" />
                )}
                <g transform={`translate(${textAt.x} ${textAt.y}) rotate(${entries.length <= 2 ? 0 : tilt})`}>
                  {lines.map((line, i) => (
                    <text key={i} y={(i - (lines.length - 1) / 2) * 14} dominantBaseline="central" textAnchor="middle" fill="#453529" fontSize="13" fontWeight="700">{line}</text>
                  ))}
                </g>
              </g>
            )
          })}
          {!empty && (
            <g ref={pointer} style={{ transform: `rotate(${angle}deg)`, transformOrigin: 'center', transformBox: 'view-box' }}>
              <path d="M-4 -20 L-2 -68 Q0 -74 2 -68 L4 -20 Z M0 -151 L8 -134 Q9 -131 6 -132 L0 -134 L-6 -132 Q-9 -131 -8 -134 Z" fill="#573b35" stroke="#fffaf0" strokeWidth="2" />
            </g>
          )}
        </svg>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <Button size="3" radius="full" color={reward ? 'amber' : 'violet'}
            disabled={busy || selected >= 0 || allReserved} onClick={onAction}>
            {empty ? '添加第一个' + label : spinning ? '转动中' : selected >= 0 ? '已抽中' : '转一转'}
          </Button>
        </div>
      </div>
      {allReserved && <p className="text-center text-sm">现有奖励都已为生命树盲盒预留，可以添加新奖励。</p>}
      {!reward && !empty && entries.every(entry => entry.drawn) && (
        <p className="text-center text-sm">本轮已抽完，再转一次就开始新一轮。</p>
      )}
      <ol aria-label={label + '条目'} className={numbered || entries.some(e => e.drawn || e.reserved) ? 'grid gap-2 text-sm sm:grid-cols-2' : 'sr-only'}>
        {entries.map((entry, i) => (
          <li key={entry.id} className="break-all">{i + 1}. {entry.name}{entry.reserved ? ' · 盲盒已预留' : entry.drawn ? ' · 本轮已抽' : ''}</li>
        ))}
      </ol>
    </>
  )
}
