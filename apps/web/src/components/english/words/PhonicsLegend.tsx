'use client'

import { PHONICS_LEGEND } from '@/utils/phonics'

export default function PhonicsLegend() {
  return (
    <div className="bg-[var(--wm-surface)] border border-[var(--wm-border)] rounded-[var(--wm-radius)] px-4 py-3 mb-4">
      <div className="text-[.68rem] font-extrabold text-[var(--wm-text-dim)] uppercase tracking-wider mb-2">
        🎨 自然拼读颜色图例（单词级别生效）
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {PHONICS_LEGEND.map(item => (
          <div key={item.cls} className="flex items-center gap-1 text-[.7rem] font-bold">
            <div className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: item.color }} />
            <span className={item.cls}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
