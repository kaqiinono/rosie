'use client'

/**
 * Assault-mode banner shown at the top of a session when the previous session
 * scored below 75% (master.md §6.3). Visual cue that this session is biased
 * toward weak problems and old-level mix.
 */
export default function AssaultBanner() {
  return (
    <div
      className="mx-auto mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-extrabold"
      style={{
        background: 'linear-gradient(90deg, rgba(239,68,68,0.12), rgba(245,158,11,0.12))',
        border: '1px solid rgba(239,68,68,0.28)',
        color: '#fca5a5',
      }}
    >
      <span className="text-[14px]">⚔️</span>
      <span>攻坚模式 — 重点突破薄弱题</span>
    </div>
  )
}
