import clsx from 'clsx'

type PracticeCountBadgeProps = {
  count: number
  /** List cards: shorter label */
  compact?: boolean
}

export default function PracticeCountBadge({ count, compact = false }: PracticeCountBadgeProps) {
  if (count === 0) {
    return (
      <span
        className={clsx(
          'inline-flex shrink-0 items-center font-medium text-slate-400',
          compact ? 'text-[10px]' : 'gap-0.5 rounded-full bg-amber-100 px-2 py-px text-[10px] font-bold text-amber-700 ring-1 ring-amber-300',
        )}
      >
        {compact ? '未练' : '✨ 未练习'}
      </span>
    )
  }
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center text-slate-500',
        compact ? 'text-[10px]' : 'rounded-full bg-slate-100 px-2 py-px text-[10px] font-semibold',
      )}
    >
      {compact ? `${count} 次` : `练习 ${count} 次`}
    </span>
  )
}
