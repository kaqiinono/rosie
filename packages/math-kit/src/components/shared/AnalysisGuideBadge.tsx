import clsx from 'clsx'

type Props = {
  hasImage: boolean
  /** When true, also show a badge for problems without an analysis image (admin UIs). */
  showMissing?: boolean
  size?: 'sm' | 'md'
  /** List cards: icon only */
  compact?: boolean
  className?: string
}

/** Marks whether a problem has a 题解配图. */
export default function AnalysisGuideBadge({
  hasImage,
  showMissing = false,
  size = 'sm',
  compact = false,
  className,
}: Props) {
  if (!hasImage && !showMissing) return null

  if (compact && hasImage) {
    return (
      <span
        title="本题有详细图解解析"
        className={clsx('inline-flex shrink-0 text-[11px] leading-none opacity-80', className)}
      >
        📊
      </span>
    )
  }

  const sizeClass =
    size === 'md'
      ? 'px-2 py-0.5 text-[11px]'
      : 'px-1.5 py-px text-[10px]'

  if (hasImage) {
    return (
      <span
        title="本题有详细图解解析"
        className={clsx(
          'inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 font-semibold text-amber-800',
          sizeClass,
          className,
        )}
      >
        📊 图解
      </span>
    )
  }

  return (
    <span
      title="尚未上传题解图"
      className={clsx(
        'inline-flex shrink-0 items-center rounded-full border border-dashed border-slate-300 bg-slate-50 font-medium text-slate-400',
        sizeClass,
        className,
      )}
    >
      无解图
    </span>
  )
}
