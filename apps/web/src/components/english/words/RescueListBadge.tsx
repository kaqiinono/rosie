'use client'

import type { RescueQueueItem } from '@rosie/core'

interface Props {
  items: RescueQueueItem[]
}

export default function RescueListBadge({ items }: Props) {
  if (items.length === 0) return null

  const visible = items.slice(0, 5)
  const more = items.length - visible.length

  return (
    <div className="mb-3 rounded-2xl border border-white/10 bg-white/[.04] px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between text-[.7rem] font-extrabold tracking-wider text-white/60">
        <span>🧡 拯救清单</span>
        <span>{items.length} 个待救</span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {visible.map((it) => {
          const cfg = chipConfig(it)
          return (
            <span
              key={it.wordKey}
              className={`shrink-0 rounded-full border-[1.5px] px-2.5 py-0.5 text-[.75rem] font-extrabold transition-colors duration-200 ${cfg.pulse ? 'animate-[chip-pulse_2s_ease-in-out_infinite]' : ''}`}
              style={{
                background: cfg.bg,
                borderColor: cfg.border,
                color: cfg.color,
              }}
              title={`${cfg.tag} · ${it.entry.explanation ?? ''}`}
            >
              {cfg.icon} {it.entry.word}
            </span>
          )
        })}
        {more > 0 && (
          <span className="shrink-0 self-center text-[.7rem] font-bold text-white/40">
            … +{more}
          </span>
        )}
      </div>
    </div>
  )
}

type ChipConfig = {
  icon: string
  tag: string
  bg: string
  border: string
  color: string
  pulse: boolean
}

function chipConfig(it: RescueQueueItem): ChipConfig {
  if (it.stage === 'saved' || it.stage === 'consolidated') {
    return {
      icon: '💚',
      tag: '已救回',
      bg: 'rgba(52,211,153,.15)',
      border: 'var(--rescue-saved)',
      color: 'var(--rescue-saved)',
      pulse: false,
    }
  }
  if (it.stage === 'lost' || it.stage === 'still_half') {
    return {
      icon: '🌙',
      tag: '下次再战',
      bg: 'rgba(255,255,255,.06)',
      border: 'rgba(255,255,255,.18)',
      color: 'rgba(255,255,255,.55)',
      pulse: false,
    }
  }
  if (it.severity === 'eaten') {
    return {
      icon: '🧡',
      tag: '待拯救',
      bg: 'rgba(251,146,60,.15)',
      border: 'var(--rescue-eaten)',
      color: 'var(--rescue-eaten)',
      pulse: true,
    }
  }
  return {
    icon: '🧪',
    tag: '待巩固',
    bg: 'rgba(96,165,250,.15)',
    border: 'var(--rescue-half)',
    color: 'var(--rescue-half)',
    pulse: false,
  }
}
