'use client'

import {
  ADAPTIVE_PLAN_DEFAULTS,
  BACKLOG_FUSE_OPTIONS,
  REVIEW_CAP_OPTIONS,
  REVIEW_SCHEDULE_HELP,
} from '../../utils/adaptivePlanDefaults'

type ReviewSchedulePickerProps = {
  reviewCap: number
  backlogFuse: number
  newWordsPerDay: number
  onReviewCapChange: (n: number) => void
  onBacklogFuseChange: (n: number) => void
  disabled?: boolean
  savingLabel?: string
}

function chipClass(active: boolean, disabled: boolean): string {
  const base =
    'h-8 min-w-8 cursor-pointer rounded-full border-[1.5px] px-2 text-[.8rem] font-extrabold transition-all disabled:cursor-wait disabled:opacity-60'
  if (active) {
    return `${base} border-[#8b5cf6] bg-[rgba(139,92,246,.15)] text-[#c4b5fd]`
  }
  return `${base} border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[#8b5cf6] hover:text-[#c4b5fd]`
}

export default function ReviewSchedulePicker({
  reviewCap,
  backlogFuse,
  newWordsPerDay,
  onReviewCapChange,
  onBacklogFuseChange,
  disabled = false,
  savingLabel,
}: ReviewSchedulePickerProps) {
  const help = REVIEW_SCHEDULE_HELP
  const suggestedMin = Math.max(ADAPTIVE_PLAN_DEFAULTS.reviewCap, newWordsPerDay * 4)

  return (
    <div className="mb-5 rounded-xl border border-[rgba(139,92,246,.22)] bg-[rgba(139,92,246,.05)] px-4 py-3.5">
      <div className="mb-1 font-fredoka text-[1rem] text-[#c4b5fd]">{help.title}</div>
      <p className="mb-3 text-[.68rem] leading-relaxed font-bold text-[var(--wm-text-dim)]">
        {help.intro}
      </p>

      <div className="mb-3">
        <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[.68rem] font-extrabold tracking-wide text-[#c4b5fd] uppercase">
            {help.reviewCap.label}
          </span>
          <span className="text-[.62rem] font-bold text-[var(--wm-text-dim)]">
            默认 {ADAPTIVE_PLAN_DEFAULTS.reviewCap} · 建议 ≥ {suggestedMin}
            {savingLabel ? ` · ${savingLabel}` : ''}
          </span>
        </div>
        <div className="mb-1.5 flex flex-wrap gap-1">
          {REVIEW_CAP_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onReviewCapChange(n)}
              className={chipClass(reviewCap === n, disabled)}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-[.65rem] leading-relaxed text-[var(--wm-text-dim)]">
          {help.reviewCap.detail}
        </p>
        <p className="mt-0.5 text-[.65rem] leading-relaxed text-[#93c5fd]">{help.reviewCap.example}</p>
      </div>

      <div>
        <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[.68rem] font-extrabold tracking-wide text-[#c4b5fd] uppercase">
            {help.backlogFuse.label}
          </span>
          <span className="text-[.62rem] font-bold text-[var(--wm-text-dim)]">
            默认 {ADAPTIVE_PLAN_DEFAULTS.backlogFuse}
          </span>
        </div>
        <div className="mb-1.5 flex flex-wrap gap-1">
          {BACKLOG_FUSE_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onBacklogFuseChange(n)}
              className={chipClass(backlogFuse === n, disabled)}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-[.65rem] leading-relaxed text-[var(--wm-text-dim)]">
          {help.backlogFuse.detail}
        </p>
        <p className="mt-0.5 text-[.65rem] leading-relaxed text-[#93c5fd]">{help.backlogFuse.example}</p>
      </div>
    </div>
  )
}
