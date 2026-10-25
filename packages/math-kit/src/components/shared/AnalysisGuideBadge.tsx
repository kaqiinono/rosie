import clsx from 'clsx'
import ProblemActionIcon from './ProblemActionIcon'

type Props = {
  hasImage: boolean
  /** When true, also show a badge for problems without an analysis image (admin UIs). */
  showMissing?: boolean
  size?: 'sm' | 'md'
  /** List cards: circular 图 marker */
  compact?: boolean
  className?: string
  variant?: 'default' | 'toolbar'
}

/** Marks whether a problem has a 题解配图. */
export default function AnalysisGuideBadge({
  hasImage,
  showMissing = false,
  size = 'sm',
  compact = false,
  className,
  variant = 'default',
}: Props) {
  if (!hasImage && !showMissing) return null

  if (variant === 'toolbar' && hasImage) {
    return (
      <span title="本题有详细图解解析" className={clsx('inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center text-text-secondary', className)}>
        <ProblemActionIcon name="diagram" />
        <span className="sr-only">本题有详细图解解析</span>
      </span>
    )
  }

  if (compact && hasImage) {
    return (
      <span
        title="本题有详细图解解析"
        aria-label="本题有详细图解解析"
        className={clsx(
          'inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-app-blue-light text-[11px] font-semibold leading-none text-app-blue-dark',
          className,
        )}
      >
        图
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
