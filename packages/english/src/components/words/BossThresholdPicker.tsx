'use client'

import {
  ADAPTIVE_PLAN_DEFAULTS,
  BOSS_EVERY_N_NEW_OPTIONS,
  BOSS_PACK_LIMIT_OPTIONS,
  BOSS_STUBBORN_THRESHOLD_OPTIONS,
  bossEveryNNewLabel,
  bossThresholdHelp,
} from '../../utils/adaptivePlanDefaults'

type BossThresholdPickerProps = {
  bossEveryNNew: number
  bossStubbornThreshold: number
  bossPackLimit: number
  onBossEveryNNewChange: (n: number) => void
  onBossStubbornThresholdChange: (n: number) => void
  onBossPackLimitChange: (n: number) => void
  disabled?: boolean
  savingLabel?: string
}

function chipClass(active: boolean, disabled: boolean): string {
  const base =
    'h-8 min-w-8 cursor-pointer rounded-full border-[1.5px] px-2 text-[.8rem] font-extrabold transition-all disabled:cursor-wait disabled:opacity-60'
  if (active) {
    return `${base} border-[#f59e0b] bg-[rgba(245,158,11,.14)] text-[#fbbf24]`
  }
  return `${base} border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[#f59e0b] hover:text-[#fbbf24]`
}

export default function BossThresholdPicker({
  bossEveryNNew,
  bossStubbornThreshold,
  bossPackLimit,
  onBossEveryNNewChange,
  onBossStubbornThresholdChange,
  onBossPackLimitChange,
  disabled = false,
  savingLabel,
}: BossThresholdPickerProps) {
  const help = bossThresholdHelp(bossPackLimit)

  return (
    <div className="mb-5 rounded-xl border border-[rgba(245,158,11,.22)] bg-[rgba(245,158,11,.05)] px-4 py-3.5">
      <div className="mb-1 font-fredoka text-[1rem] text-[#fbbf24]">{help.title}</div>
      <p className="mb-3 text-[.68rem] leading-relaxed font-bold text-[var(--wm-text-dim)]">
        {help.intro}
      </p>

      <div className="mb-3">
        <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[.68rem] font-extrabold tracking-wide text-[#fbbf24] uppercase">
            {help.everyNNew.label}
          </span>
          <span className="text-[.62rem] font-bold text-[var(--wm-text-dim)]">
            默认 {ADAPTIVE_PLAN_DEFAULTS.bossEveryNNew}
            {savingLabel ? ` · ${savingLabel}` : ''}
          </span>
        </div>
        <div className="mb-1.5 flex flex-wrap gap-1">
          {BOSS_EVERY_N_NEW_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onBossEveryNNewChange(n)}
              className={chipClass(bossEveryNNew === n, disabled)}
            >
              {bossEveryNNewLabel(n)}
            </button>
          ))}
        </div>
        <p className="text-[.65rem] leading-relaxed text-[var(--wm-text-dim)]">
          {help.everyNNew.detail}
        </p>
        <p className="mt-0.5 text-[.65rem] leading-relaxed text-[#c4b5fd]">{help.everyNNew.example}</p>
      </div>

      <div className="mb-3">
        <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[.68rem] font-extrabold tracking-wide text-[#fbbf24] uppercase">
            {help.stubborn.label}
          </span>
          <span className="text-[.62rem] font-bold text-[var(--wm-text-dim)]">
            默认 {ADAPTIVE_PLAN_DEFAULTS.bossStubbornThreshold}
          </span>
        </div>
        <div className="mb-1.5 flex flex-wrap gap-1">
          {BOSS_STUBBORN_THRESHOLD_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onBossStubbornThresholdChange(n)}
              className={chipClass(bossStubbornThreshold === n, disabled)}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-[.65rem] leading-relaxed text-[var(--wm-text-dim)]">
          {help.stubborn.detail}
        </p>
        <p className="mt-0.5 text-[.65rem] leading-relaxed text-[#c4b5fd]">{help.stubborn.example}</p>
      </div>

      <div>
        <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[.68rem] font-extrabold tracking-wide text-[#fbbf24] uppercase">
            {help.packLimit.label}
          </span>
          <span className="text-[.62rem] font-bold text-[var(--wm-text-dim)]">
            默认 {ADAPTIVE_PLAN_DEFAULTS.bossPackLimit}
          </span>
        </div>
        <div className="mb-1.5 flex flex-wrap gap-1">
          {BOSS_PACK_LIMIT_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onBossPackLimitChange(n)}
              className={chipClass(bossPackLimit === n, disabled)}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-[.65rem] leading-relaxed text-[var(--wm-text-dim)]">
          {help.packLimit.detail}
        </p>
        <p className="mt-0.5 text-[.65rem] leading-relaxed text-[#c4b5fd]">{help.packLimit.example}</p>
      </div>

      <p className="mt-3 border-t border-[rgba(245,158,11,.15)] pt-2.5 text-[.62rem] leading-relaxed text-[var(--wm-text-dim)]">
        {help.note}
      </p>
    </div>
  )
}
