'use client'

import type { RescueQueueItem } from '@rosie/core'

type Props = {
  eatenList: RescueQueueItem[]
}

export default function RescueCompletionView({ eatenList }: Props) {
  if (eatenList.length === 0) return null

  const saved = eatenList.filter((i) => i.stage === 'saved')
  const lost = eatenList.filter((i) => i.stage === 'lost')

  let headline = ''
  let headlineEmoji = ''
  if (lost.length === 0) {
    headlineEmoji = '🏆'
    headline = '太强啦！这一关被吃掉的单词全部救回来！'
  } else if (saved.length > 0) {
    headlineEmoji = '⚔️'
    headline = `救回 ${saved.length} 个单词！还有 ${lost.length} 个等你下次去打怪兽~`
  } else {
    headlineEmoji = '🌟'
    headline = '这关怪兽有点厉害，没关系，下次还有机会！'
  }

  return (
    <div
      className="mt-5 rounded-3xl p-5"
      style={{
        background: 'linear-gradient(135deg, #1a1200 0%, #0d0d0d 50%, #001a08 100%)',
        boxShadow:
          'inset 0 0 0 1px color-mix(in srgb, var(--rescue-flash-warn) 18%, transparent), 0 0 28px 0 color-mix(in srgb, var(--rescue-flash-warn) 7%, transparent)',
        border: '1px solid color-mix(in srgb, var(--rescue-flash-warn) 35%, transparent)',
      }}
    >
      {/* Section label */}
      <div className="mb-3 border-b border-amber-400/20 pb-2 text-[.7rem] font-black tracking-[.22em] text-amber-400">
        ✦ ⚔️ 拯救成果
      </div>

      {/* Headline */}
      <div className="mb-4 flex items-start gap-1.5 text-[1rem] font-black leading-snug text-white">
        <span className="inline-block animate-bounce-slow shrink-0">{headlineEmoji}</span>
        <span>{headline}</span>
      </div>

      {/* Word chips */}
      <div className="flex flex-wrap gap-2">
        {saved.map((i, idx) => (
          <span
            key={i.wordKey}
            className="rounded-full border-[1.5px] px-3.5 py-1.5 text-[.82rem] font-extrabold transition-all duration-200 hover:scale-105"
            style={{
              background: 'rgba(52,211,153,.14)',
              borderColor: 'rgba(52,211,153,.45)',
              color: 'var(--rescue-saved)',
              boxShadow: '0 0 8px rgba(52,211,153,.22)',
              animation: `fade-up .3s ease both ${idx * 40}ms`,
            }}
            title="已救回"
          >
            💚 {i.entry.word}
          </span>
        ))}
        {lost.map((i, idx) => (
          <span
            key={i.wordKey}
            className="rounded-full border-[1.5px] px-3.5 py-1.5 text-[.82rem] font-bold"
            style={{
              background: 'rgba(255,255,255,.04)',
              borderColor: 'rgba(251,191,36,.22)',
              color: 'color-mix(in srgb, var(--rescue-flash-warn) 58%, transparent)',
              animation: `fade-up .3s ease both ${(saved.length + idx) * 40}ms`,
            }}
            title="下次再战！"
          >
            🧡 {i.entry.word}
          </span>
        ))}
      </div>
    </div>
  )
}
