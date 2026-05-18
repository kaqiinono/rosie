'use client'

export type FeedbackKind = 'correct' | 'retry' | 'wrong' | 'challenge-correct' | null

interface Props {
  kind: FeedbackKind
  coinDelta?: number
  revealAnswer?: number | null
}

export default function FeedbackOverlay({ kind, coinDelta = 0, revealAnswer }: Props) {
  if (!kind) return null

  if (kind === 'correct' || kind === 'challenge-correct') {
    const isChallenge = kind === 'challenge-correct'
    return (
      <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
        <div
          className="flex flex-col items-center gap-3"
          style={{ animation: 'pop-in 0.3s cubic-bezier(.34,1.56,.64,1)' }}
        >
          <div
            className="flex h-28 w-28 items-center justify-center rounded-full text-[56px]"
            style={
              isChallenge
                ? {
                    background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
                    boxShadow: '0 0 40px rgba(245,158,11,0.6), 0 0 80px rgba(236,72,153,0.3)',
                    color: '#fff',
                  }
                : {
                    background: 'linear-gradient(135deg, #059669, #22c55e)',
                    boxShadow: '0 0 40px rgba(34,197,94,0.6), 0 0 80px rgba(34,197,94,0.2)',
                    color: '#fff',
                  }
            }
          >
            ✓
          </div>
          {coinDelta > 0 && (
            <div
              className="rounded-full px-4 py-1.5 text-[15px] font-black"
              style={{
                background: 'rgba(245,158,11,0.2)',
                border: '1px solid rgba(245,158,11,0.4)',
                color: '#fbbf24',
                boxShadow: '0 0 20px rgba(245,158,11,0.3)',
                animation: 'float-up 0.6s ease-out forwards',
              }}
            >
              +{coinDelta} ⭐
            </div>
          )}
        </div>
      </div>
    )
  }

  if (kind === 'retry') {
    return (
      <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
        <div
          className="rounded-2xl px-7 py-4 text-[20px] font-black"
          style={{
            background: 'rgba(245,158,11,0.15)',
            border: '1.5px solid rgba(245,158,11,0.35)',
            color: '#fbbf24',
            boxShadow: '0 0 30px rgba(245,158,11,0.25)',
            animation: 'wiggle 0.5s cubic-bezier(.36,.07,.19,.97) both',
          }}
        >
          🤔 再想想…
        </div>
      </div>
    )
  }

  // wrong (reveal)
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
      <div
        className="flex flex-col items-center gap-3 rounded-2xl px-8 py-6"
        style={{
          background: 'rgba(15,10,35,0.92)',
          border: '1.5px solid rgba(239,68,68,0.3)',
          boxShadow: '0 8px 40px rgba(239,68,68,0.2)',
          animation: 'pop-in 0.3s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full text-[44px]"
          style={{
            background: 'linear-gradient(135deg, #b91c1c, #ef4444)',
            boxShadow: '0 0 30px rgba(239,68,68,0.4)',
            color: '#fff',
          }}
        >
          ✗
        </div>
        <div className="text-[13px] font-bold" style={{ color: 'rgba(245,243,255,0.5)' }}>
          正确答案是
        </div>
        <div
          className="font-fredoka text-[44px] font-black leading-none"
          style={{
            color: '#c4b5fd',
            textShadow: '0 0 20px rgba(196,181,253,0.4)',
          }}
        >
          {revealAnswer}
        </div>
      </div>
    </div>
  )
}
