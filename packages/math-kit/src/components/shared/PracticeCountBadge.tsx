import clsx from 'clsx'

type PracticeCountBadgeProps = {
  count: number
  /** List cards: shorter label */
  compact?: boolean
}

export default function PracticeCountBadge({ count, compact = false }: PracticeCountBadgeProps) {
  if (count <= 0) {
    return (
      <span
        title="这题还没练过，来试试吧！"
        className={clsx(
          'inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 font-bold text-amber-900 ring-1 ring-inset ring-amber-300',
          compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
        )}
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3 shrink-0">
          <circle cx="8" cy="8" r="6" /><path d="M8 4.5v4M8 11h.01" strokeLinecap="round" />
        </svg>
        {compact ? '未练' : '未练习 · 来试试'}
      </span>
    )
  }
  return (
    <span
      title={`已练习 ${count} 次，每次练习都算进步，继续加油！`}
      className={clsx(
        'inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 font-bold text-emerald-800 ring-1 ring-inset ring-emerald-200',
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
      )}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-3 w-3 shrink-0">
        <path d="m3.5 8 3 3 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {compact ? `已练 ${count} 次` : `已练习 ${count} 次 · 继续加油`}
    </span>
  )
}
