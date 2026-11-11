'use client'

import { Button } from '@rosie/ui/themes'
import {
  ADAPTIVE_PLAN_DEFAULTS,
  BOSS_EVERY_N_NEW_OPTIONS,
  bossEveryNNewLabel,
  bossThresholdHelp,
} from '../../utils/adaptivePlanDefaults'

type BossThresholdPickerProps = {
  bossEveryNNew: number
  onBossEveryNNewChange: (n: number) => void
  disabled?: boolean
  savingLabel?: string
}

export default function BossThresholdPicker({
  bossEveryNNew,
  onBossEveryNNewChange,
  disabled = false,
  savingLabel,
}: BossThresholdPickerProps) {
  const help = bossThresholdHelp()

  return (
    <div className="mb-5 rounded-xl border border-[rgba(245,158,11,.22)] bg-[rgba(245,158,11,.05)] px-4 py-3.5">
      <div className="font-fredoka mb-1 text-[1rem] text-[#fbbf24]">{help.title}</div>
      <p className="mb-3 text-[.68rem] leading-relaxed font-bold text-[var(--wm-text-dim)]">
        {help.intro}
      </p>

      <div>
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
            <Button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onBossEveryNNewChange(n)}
              variant={bossEveryNNew === n ? 'solid' : 'soft'}
              color={bossEveryNNew === n ? 'amber' : 'gray'}
              size="1"
              radius="full"
            >
              {bossEveryNNewLabel(n)}
            </Button>
          ))}
        </div>
        <p className="text-[.65rem] leading-relaxed text-[var(--wm-text-dim)]">
          {help.everyNNew.detail}
        </p>
        <p className="mt-0.5 text-[.65rem] leading-relaxed text-[#c4b5fd]">
          {help.everyNNew.example}
        </p>
      </div>

      <p className="mt-3 border-t border-[rgba(245,158,11,.15)] pt-2.5 text-[.62rem] leading-relaxed text-[var(--wm-text-dim)]">
        {help.note}
      </p>
    </div>
  )
}
