'use client'

import Link from 'next/link'

interface Props {
  correctCount: number
  retryCount: number
  wrongCount: number
  total: number
  coinsEarned: number
  timeBonusEarned?: number
  timeSpentSec: number
  /** Mean first-attempt solve time this session, in ms (null if no data). */
  avgMs?: number | null
  /** Mean per-question time of the previous session, in ms (null if none). */
  prevAvgMs?: number | null
  maxStreak: number
  challengeCorrect: number
  levelUpTo?: number | null
  levelDownTo?: number | null
  nextSessionAssault?: boolean
  /** Optional caption shown when a level transitioned to abc_passed / review_r1 / review_r2 etc. */
  reviewMilestone?: string | null
  onAgain: () => void
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

function formatTimeChinese(s: number) {
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m === 0) return `${r}秒`
  if (r === 0) return `${m}分钟`
  return `${m}分${r}秒`
}

/** ms → "3.2秒" (one decimal). */
function formatSeconds(ms: number) {
  return `${(ms / 1000).toFixed(1)}秒`
}

export default function SessionSummary({
  correctCount,
  retryCount,
  wrongCount,
  total,
  coinsEarned,
  timeBonusEarned = 0,
  timeSpentSec,
  avgMs = null,
  prevAvgMs = null,
  maxStreak,
  challengeCorrect,
  levelUpTo,
  levelDownTo,
  nextSessionAssault,
  reviewMilestone,
  onAgain,
}: Props) {
  const accuracy = total > 0 ? Math.round(((correctCount + retryCount) / total) * 100) : 0
  const trophy = accuracy >= 90 ? '🏆' : accuracy >= 70 ? '🌟' : '💪'
  const totalCoins = coinsEarned + timeBonusEarned

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

        {levelDownTo && (
          <div
            className="mt-3 rounded-xl px-3 py-2 text-[12px] font-extrabold"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.28)',
              color: '#fca5a5',
            }}
          >
            📉 暂时回到 Lv.{levelDownTo} 多练几次再上来
          </div>
        )}

        {reviewMilestone && (
          <div
            className="mt-3 rounded-xl px-3 py-2 text-[12px] font-extrabold"
            style={{
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.28)',
              color: '#4ade80',
            }}
          >
            ✨ {reviewMilestone}
          </div>
        )}

        {nextSessionAssault && (
          <div
            className="mt-3 rounded-xl px-3 py-2 text-[11px] font-extrabold"
            style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.22)',
              color: '#fbbf24',
            }}
          >
            ⚔️ 下次进入攻坚模式，重点突破薄弱题
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
              {timeBonusEarned > 0 ? '合计星星' : '星星'}
            </div>
            <div className="font-fredoka text-[20px] font-black" style={{ color: '#fbbf24' }}>
              +{totalCoins} ⭐
            </div>
            {timeBonusEarned > 0 && (
              <div className="text-[9px] font-semibold mt-0.5" style={{ color: 'rgba(251,191,36,0.5)' }}>
                基础{coinsEarned} + 限时{timeBonusEarned}
              </div>
            )}
          </div>
        </div>

        {/* Timing analysis — total time, avg per question, and trend vs last session */}
        {avgMs !== null && (() => {
          const deltaMs = prevAvgMs !== null ? prevAvgMs - avgMs : null // +ve = faster = 进步
          const faster = deltaMs !== null && deltaMs > 0
          const meaningful = deltaMs !== null && Math.abs(deltaMs) >= 100 // ignore <0.1s noise
          return (
            <div
              className="mt-3 rounded-xl px-4 py-3 text-left"
              style={{
                background: 'rgba(125,211,252,0.07)',
                border: '1px solid rgba(125,211,252,0.2)',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div
                    className="text-[10px] font-extrabold uppercase tracking-widest"
                    style={{ color: 'rgba(125,211,252,0.6)' }}
                  >
                    ⏱ 本次计时
                  </div>
                  <div className="font-fredoka text-[18px] font-black leading-tight mt-0.5" style={{ color: '#7dd3fc' }}>
                    总用时 {formatTimeChinese(timeSpentSec)}
                  </div>
                  <div className="text-[11px] font-semibold" style={{ color: 'rgba(125,211,252,0.6)' }}>
                    平均每题 {formatSeconds(avgMs)}
                  </div>
                </div>
                {meaningful ? (
                  <div
                    className="shrink-0 rounded-xl px-3 py-2 text-center"
                    style={{
                      background: faster ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                      border: `1px solid ${faster ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    }}
                  >
                    <div className="font-fredoka text-[16px] font-black leading-none" style={{ color: faster ? '#4ade80' : '#fbbf24' }}>
                      {faster ? '↑ 进步' : '↓ 退步'}
                    </div>
                    <div className="text-[10px] font-bold mt-0.5" style={{ color: faster ? 'rgba(74,222,128,0.7)' : 'rgba(251,191,36,0.7)' }}>
                      每题{faster ? '快' : '慢'} {formatSeconds(Math.abs(deltaMs))}
                    </div>
                  </div>
                ) : prevAvgMs !== null ? (
                  <div className="shrink-0 text-[11px] font-bold" style={{ color: 'rgba(125,211,252,0.5)' }}>
                    ≈ 与上次持平
                  </div>
                ) : (
                  <div className="shrink-0 text-[10px] font-semibold" style={{ color: 'rgba(125,211,252,0.4)' }}>
                    首场基准
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Time bonus celebration card */}
        {timeBonusEarned > 0 && (
          <div
            className="mt-3 rounded-xl px-4 py-3 text-left"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(251,113,133,0.1) 100%)',
              border: '1px solid rgba(245,158,11,0.4)',
              boxShadow: '0 0 20px rgba(245,158,11,0.12)',
              animation: 'pop-in 0.5s cubic-bezier(.34,1.56,.64,1) 0.25s both',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div
                  className="text-[11px] font-extrabold uppercase tracking-widest"
                  style={{ color: 'rgba(251,191,36,0.7)' }}
                >
                  ⚡ 限时挑战加成
                </div>
                <div
                  className="font-fredoka text-[28px] font-black leading-tight"
                  style={{
                    background: 'linear-gradient(90deg, #fbbf24, #f97316)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  +{timeBonusEarned} ⭐
                </div>
                <div className="text-[10px] font-semibold mt-0.5" style={{ color: 'rgba(251,191,36,0.55)' }}>
                  {formatTimeChinese(timeSpentSec)} 内完成 · 速度奖励
                </div>
              </div>
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[28px]"
                style={{
                  background: 'rgba(245,158,11,0.15)',
                  border: '2px solid rgba(245,158,11,0.3)',
                }}
              >
                ⚡
              </div>
            </div>
            <div
              className="mt-2 rounded-lg px-3 py-1.5 text-[11px] font-bold text-center"
              style={{
                background: 'rgba(245,158,11,0.12)',
                border: '1px solid rgba(245,158,11,0.2)',
                color: '#fbbf24',
              }}
            >
              太厉害了！继续挑战更短时间赢更多星星！
            </div>
          </div>
        )}

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
