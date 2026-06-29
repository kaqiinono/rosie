type PracticeCountBadgeProps = {
  count: number
}

export default function PracticeCountBadge({ count }: PracticeCountBadgeProps) {
  if (count === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-px text-[10px] font-bold text-amber-700 ring-1 ring-amber-300">
        ✨ 未练习
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-px text-[10px] font-semibold text-slate-500">
      练习 {count} 次
    </span>
  )
}
