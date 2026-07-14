export type FilterChipTone = 'stage' | 'unit' | 'lesson' | 'word' | 'mastery' | 'neutral'

const ACTIVE: Record<FilterChipTone, string> = {
  stage:
    'border-[#a855f7] bg-gradient-to-br from-[#a855f7] to-[#7c3aed] text-white shadow-[0_2px_8px_rgba(168,85,247,.3)]',
  unit: 'border-[var(--wm-accent)] bg-gradient-to-br from-[var(--wm-accent)] to-[#c0392b] text-white shadow-[0_2px_8px_rgba(233,69,96,.3)]',
  lesson:
    'border-[var(--wm-accent4)] bg-gradient-to-br from-[var(--wm-accent4)] to-[#3b82f6] text-white shadow-[0_2px_8px_rgba(96,165,250,.3)]',
  word: 'border-[var(--wm-accent2)] bg-gradient-to-br from-[var(--wm-accent2)] to-[#e67e22] text-white shadow-[0_2px_8px_rgba(245,166,35,.3)]',
  mastery:
    'border-[#4ade80] bg-gradient-to-br from-[#4ade80] to-[#22c55e] text-white shadow-[0_2px_8px_rgba(74,222,128,.3)]',
  neutral:
    'border-[var(--wm-accent4)] bg-gradient-to-br from-[var(--wm-accent4)] to-[#3b82f6] text-white shadow-[0_2px_8px_rgba(96,165,250,.3)]',
}

const INACTIVE: Record<FilterChipTone, string> = {
  stage:
    'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[#a855f7] hover:text-[var(--wm-text)]',
  unit: 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent4)] hover:text-[var(--wm-text)]',
  lesson:
    'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent4)] hover:text-[var(--wm-text)]',
  word: 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent4)] hover:text-[var(--wm-text)]',
  mastery:
    'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent4)] hover:text-[var(--wm-text)]',
  neutral:
    'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent4)] hover:text-[var(--wm-text)]',
}

export function filterChipClass(active: boolean, tone: FilterChipTone): string {
  const base =
    'font-nunito cursor-pointer rounded-lg border-[1.5px] px-3 py-1.5 text-[0.875rem] font-bold whitespace-nowrap transition-all select-none'
  return `${base} ${active ? ACTIVE[tone] : INACTIVE[tone]}`
}
