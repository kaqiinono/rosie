export type FilterChipTone = 'stage' | 'unit' | 'lesson' | 'word' | 'mastery' | 'neutral'

const ACTIVE: Record<FilterChipTone, string> = {
  stage: 'border-[#a855f7] bg-[#a855f7] text-white shadow-sticker-sm',
  unit: 'border-[var(--wm-accent)] bg-[var(--wm-accent)] text-white shadow-sticker-sm',
  lesson: 'border-[var(--wm-accent4)] bg-[var(--wm-accent4)] text-white shadow-sticker-sm',
  word: 'border-[var(--wm-accent2)] bg-[var(--wm-accent2)] text-white shadow-sticker-sm',
  mastery: 'border-[#4ade80] bg-[#4ade80] text-white shadow-sticker-sm',
  neutral: 'border-[var(--wm-accent4)] bg-[var(--wm-accent4)] text-white shadow-sticker-sm',
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
