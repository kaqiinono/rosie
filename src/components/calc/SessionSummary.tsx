'use client'

import Link from 'next/link'

interface Props {
  correctCount: number
  retryCount: number
  wrongCount: number
  total: number
  coinsEarned: number
  timeSpentSec: number
  maxStreak: number
  challengeCorrect: number
  levelUpTo?: number | null
  onAgain: () => void
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export default function SessionSummary({
  correctCount,
  retryCount,
  wrongCount,
  total,
  coinsEarned,
  timeSpentSec,
  maxStreak,
  challengeCorrect,
  levelUpTo,
  onAgain,
}: Props) {
  const accuracy = total > 0 ? Math.round(((correctCount + retryCount) / total) * 100) : 0
  const trophy = accuracy >= 90 ? '🏆' : accuracy >= 70 ? '🌟' : '💪'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(6,7,26,0.85)', backdropFilter: 'blur(16px)' }}
    >
      <div
        className="mx-4 w-full max-w-[420px] rounded-3xl p-7 text-center"
        style={{
          background: 'rgba(13,11,38,0.98)',
          border: '1px solid rgba(139,92,246,0.25)',
          boxShadow: '0 24px 60px rgba(139,92,246,0.2), 0 0 0 1px rgba(255,255,255,0.04)',
          animation: 'pop-in 0.35s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        <div className="text-[48px]">{trophy}</div>
        <div
          className="mt-1 font-fredoka text-[26px] font-black"
          style={{
            background: 'linear-gradient(90deg, #c4b5fd, #f0abfc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          练习完成！
        </div>
        <div className="text-[12px] mt-0.5" style={{ color: 'rgba(245,243,255,0.4)' }}>
          用时 {formatTime(timeSpentSec)}
        </div>

        {levelUpTo && (
          <div
            className="mt-3 rounded-xl px-3 py-2 text-[13px] font-extrabold"
            style={{
              background: 'rgba(245,158,11,0.12)',
              border: '1px solid rgba(245,158,11,0.3)',
              color: '#fbbf24',
              animation: 'float-up 0.6s ease-out forwards',
            }}
          >
            🎉 升级到 Lv.{levelUpTo} 啦！
          </div>
        )}

        {/* Stats grid */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { label: '一次对', value: correctCount, color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)' },
            { label: '再试对', value: retryCount, color: '#fbbf24', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
            { label: '未答对', value: wrongCount, color: '#f87171', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
          ].map(({ label, value, color, bg, border }) => (
            <div
              key={label}
              className="rounded-xl px-2 py-3"
              style={{ background: bg, border: `1px solid ${border}` }}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `${color}99` }}>
                {label}
              </div>
              <div className="font-fredoka text-[24px] font-black" style={{ color }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div
            className="rounded-xl px-3 py-2.5"
            style={{
              background: 'rgba(139,92,246,0.1)',
              border: '1px solid rgba(139,92,246,0.2)',
            }}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(196,181,253,0.5)' }}>
              正确率
            </div>
            <div className="font-fredoka text-[20px] font-black" style={{ color: '#c4b5fd' }}>
              {accuracy}%
            </div>
          </div>
          <div
            className="rounded-xl px-3 py-2.5"
            style={{
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.2)',
            }}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(251,191,36,0.5)' }}>
              金币
            </div>
            <div className="font-fredoka text-[20px] font-black" style={{ color: '#fbbf24' }}>
              +{coinsEarned} ⭐
            </div>
          </div>
        </div>

        {(maxStreak >= 3 || challengeCorrect > 0) && (
          <div className="mt-3 flex justify-center gap-3 text-[11px]" style={{ color: 'rgba(245,243,255,0.4)' }}>
            {maxStreak >= 3 && <span>🔥 最长连对 {maxStreak}</span>}
            {challengeCorrect > 0 && <span>⭐ 挑战题 {challengeCorrect} 道</span>}
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <Link
            href="/calc"
            className="flex-1 rounded-xl py-2.5 text-[14px] font-extrabold no-underline transition-all"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(245,243,255,0.6)',
            }}
          >
            返回
          </Link>
          <button
            onClick={onAgain}
            className="flex-[2] rounded-xl py-2.5 text-[14px] font-extrabold text-white transition-all hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              boxShadow: '0 4px 20px rgba(139,92,246,0.4)',
            }}
          >
            再来一组 →
          </button>
        </div>
      </div>
    </div>
  )
}
