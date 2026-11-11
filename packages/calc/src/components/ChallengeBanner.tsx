'use client'

export default function ChallengeBanner({ coins }: { coins: number }) {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <div
        className="flex flex-col items-center gap-3 rounded-3xl px-12 py-8"
        style={{
          background: 'rgba(245,158,11,0.15)',
          border: '1.5px solid rgba(245,158,11,0.4)',
          boxShadow: '0 3px 0 rgba(245,158,11,.3), 0 3px 0 rgba(236,72,153,.3)',
          animation: 'pop-in 0.4s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        <div className="text-[52px]" style={{ animation: 'wiggle 0.6s ease infinite' }}>
          ⭐
        </div>
        <div
          className="font-fredoka text-[34px] font-black"
          style={{
            background: '#fbbf24',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          挑战来啦！
        </div>
        <div
          className="rounded-full px-5 py-2 text-[14px] font-extrabold"
          style={{
            background: 'rgba(245,158,11,0.2)',
            border: '1px solid rgba(245,158,11,0.35)',
            color: '#fbbf24',
          }}
        >
          答对 +{coins} ⭐（×2 加成）
        </div>
      </div>
    </div>
  )
}
