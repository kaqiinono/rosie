'use client'

import type { CalcMistake } from '@/utils/type'
import { formatAnswer } from '@/utils/calc-answer'

interface Props {
  mistake: CalcMistake
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = (Date.now() - t) / 1000
  if (diff < 86400) return '今天'
  if (diff < 86400 * 2) return '昨天'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function MistakeRow({ mistake }: Props) {
  const display = mistake.display.replace(/\s*=\s*\?\s*$/, '')
  const dots = [0, 1, 2].map((i) => mistake.consecutiveCorrect > i)
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2.5"
      style={
        mistake.resolved
          ? {
              background: 'rgba(34,197,94,0.05)',
              border: '1px solid rgba(34,197,94,0.15)',
              opacity: 0.7,
            }
          : {
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(139,92,246,0.15)',
            }
      }
    >
      <div
        className="font-fredoka text-[16px] font-extrabold tabular-nums"
        style={{ color: mistake.resolved ? 'rgba(245,243,255,0.6)' : '#f5f3ff' }}
      >
        {display} ={' '}
        <span style={{ color: mistake.resolved ? '#4ade80' : '#c4b5fd' }}>
          {formatAnswer(mistake.answer)}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="flex gap-0.5">
          {dots.map((on, i) => (
            <span
              key={i}
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background: on ? '#22c55e' : 'rgba(255,255,255,0.1)',
                boxShadow: on ? '0 0 4px rgba(34,197,94,0.5)' : 'none',
              }}
            />
          ))}
        </div>
        <span
          className="text-[10px] font-semibold whitespace-nowrap"
          style={{ color: mistake.resolved ? 'rgba(74,222,128,0.6)' : 'rgba(245,243,255,0.35)' }}
        >
          {mistake.resolved ? '已掌握' : formatRelative(mistake.lastWrongAt)}
        </span>
      </div>
    </div>
  )
}
