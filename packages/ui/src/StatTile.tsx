import clsx from 'clsx'
import type { ReactNode } from 'react'

// 统计小块：小标签 + 大数字（+ 单位 / 说明）。用于 今日 / 报告 / 管理页的数据概览。
// 外观只通过 tone / size 选择；className 只写布局（栅格列宽、间距）。

export type StatTileTone = 'white' | 'accent' | 'success' | 'warning' | 'danger' | 'info'
export type StatTileSize = 'sm' | 'md' | 'lg'

export type StatTileProps = {
  label: ReactNode
  value: ReactNode
  /** 数字后的小号单位，如「题」「天」。 */
  unit?: ReactNode
  /** 数字下方的说明，如「正确率 90%」。 */
  hint?: ReactNode
  tone?: StatTileTone
  /** 数字大小：sm 20px / md 28px（默认）/ lg 40px。 */
  size?: StatTileSize
  className?: string
}

const TONE: Record<StatTileTone, { box: string; value: string }> = {
  white: { box: 'bg-white border-kid-line', value: 'text-slate-800' },
  accent: {
    box: 'bg-[var(--accent-2)] border-[var(--accent-6)]',
    value: 'text-[var(--accent-11)]',
  },
  success: { box: 'bg-green-50 border-green-200', value: 'text-green-800' },
  warning: { box: 'bg-amber-50 border-amber-300', value: 'text-amber-800' },
  danger: { box: 'bg-red-50 border-red-200', value: 'text-red-800' },
  info: { box: 'bg-sky-50 border-sky-200', value: 'text-sky-800' },
}

const VALUE_SIZE: Record<StatTileSize, string> = {
  sm: 'text-xl',
  md: 'text-[28px]',
  lg: 'text-[40px]',
}

export function StatTile({
  label,
  value,
  unit,
  hint,
  tone = 'white',
  size = 'md',
  className,
}: StatTileProps) {
  const t = TONE[tone]
  return (
    <div className={clsx('shadow-sticker-sm rounded-2xl border-2 px-4 py-3', t.box, className)}>
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div
        className={clsx('mt-0.5 leading-tight font-black tabular-nums', VALUE_SIZE[size], t.value)}
      >
        {value}
        {unit ? <span className="ml-1 text-sm font-bold text-slate-500">{unit}</span> : null}
      </div>
      {hint ? <div className="mt-0.5 text-xs font-semibold text-slate-500">{hint}</div> : null}
    </div>
  )
}

export default StatTile
