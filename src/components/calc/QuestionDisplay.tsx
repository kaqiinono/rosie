'use client'

interface Props {
  display: string
  isChallenge?: boolean
}

export default function QuestionDisplay({ display, isChallenge }: Props) {
  const m = display.match(/^(.*?)\s*=\s*\?$/)
  const expr = m?.[1] ?? display
  return (
    <div
      key={display}
      className="text-center select-none"
      style={{ animation: 'fade-up 0.32s ease backwards' }}
    >
      {isChallenge && (
        <div
          className="mb-2 inline-block rounded-full px-3 py-0.5 text-[10px] font-extrabold text-white tracking-widest uppercase"
          style={{
            background: 'linear-gradient(90deg, #f59e0b, #ec4899)',
            boxShadow: '0 0 16px rgba(245,158,11,0.4)',
          }}
        >
          ⭐ 挑战题 ×2
        </div>
      )}
      <div
        className="font-fredoka font-black tracking-tight leading-none"
        style={{
          fontSize: 'clamp(44px, 9vw, 64px)',
          color: isChallenge ? '#e9d5ff' : '#f5f3ff',
          textShadow: isChallenge
            ? '0 0 30px rgba(217,70,239,0.5), 0 0 60px rgba(217,70,239,0.2)'
            : '0 0 20px rgba(139,92,246,0.3)',
        }}
      >
        {expr}
      </div>
      <div
        className="mt-2 font-fredoka font-black leading-none"
        style={{
          fontSize: 'clamp(30px, 6vw, 42px)',
          color: 'rgba(167,139,250,0.55)',
        }}
      >
        = ?
      </div>
    </div>
  )
}
