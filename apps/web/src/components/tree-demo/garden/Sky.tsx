'use client'

export type Daypart = 'morning' | 'day' | 'dusk' | 'night'

export function daypartOf(hour: number): Daypart {
  if (hour < 5 || hour >= 19) return 'night'
  if (hour < 10) return 'morning'
  if (hour < 16) return 'day'
  return 'dusk'
}

const DECOS: { emoji: string; style: { left?: string; right?: string; bottom: string; fontSize?: number; animationDelay: string } }[] = [
  { emoji: '🌼', style: { left: '6%', bottom: '6%', animationDelay: '0s' } },
  { emoji: '🍄', style: { left: '16%', bottom: '12%', fontSize: 22, animationDelay: '0.8s' } },
  { emoji: '🌱', style: { right: '8%', bottom: '8%', animationDelay: '1.4s' } },
  { emoji: '🌷', style: { right: '20%', bottom: '14%', fontSize: 22, animationDelay: '0.4s' } },
  { emoji: '🌿', style: { left: '40%', bottom: '4%', animationDelay: '2s' } },
]

/** 天空、日月星云和草地山丘，纯装饰 */
export default function Sky({ daypart }: { daypart: Daypart }) {
  const night = daypart === 'night'
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="tg-sky">
        <div className="tg-aurora" />
        {night ? (
          <>
            <div className="tg-moon" />
            <div className="tg-stars" />
          </>
        ) : (
          <div className="tg-sun">
            <i />
          </div>
        )}
        <div className="tg-cloud" style={{ top: '12%', animationDuration: '95s', animationDelay: '-20s' }} />
        <div className="tg-cloud" style={{ top: '26%', animationDuration: '130s', animationDelay: '-70s', scale: '0.72', opacity: 0.85 }} />
        <div className="tg-cloud" style={{ top: '7%', animationDuration: '110s', animationDelay: '-90s', scale: '0.55', opacity: 0.7 }} />
        <div className="tg-cloud" style={{ top: '36%', animationDuration: '150s', animationDelay: '-40s', scale: '0.85', opacity: 0.75 }} />
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[1] h-[24dvh]">
        <svg className="absolute inset-0 size-full" viewBox="0 0 1440 220" preserveAspectRatio="none">
          <path className="tg-hill-a" d="M0,120 C240,40 420,150 720,110 C1020,70 1200,140 1440,90 L1440,220 L0,220 Z" />
          <path className="tg-hill-b" d="M0,160 C260,100 520,190 820,150 C1100,115 1280,180 1440,150 L1440,220 L0,220 Z" />
          <path className="tg-hill-c" d="M0,195 C300,160 600,215 900,190 C1150,170 1320,205 1440,190 L1440,220 L0,220 Z" />
        </svg>
        {DECOS.map((d) => (
          <span key={d.emoji} className="tg-deco" style={d.style}>
            {d.emoji}
          </span>
        ))}
      </div>
    </div>
  )
}
