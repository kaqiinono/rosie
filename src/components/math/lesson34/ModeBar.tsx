'use client'

import type { Lesson34Mode } from '@/utils/type'

interface ModeBarProps {
  mode: Lesson34Mode
  onSwitch: (mode: Lesson34Mode) => void
}

export default function ModeBar({ mode, onSwitch }: ModeBarProps) {
  return (
    <div className="flex justify-center gap-2">
      <button
        className={`cursor-pointer rounded-[14px] px-[22px] py-2.5 text-[15px] font-bold shadow-[0_3px_10px_rgba(0,0,0,.08)] transition-all duration-250 ${
          mode === 'merge'
            ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-[0_4px_16px_rgba(239,68,68,.3)]'
            : 'border-2 border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700'
        }`}
        onClick={() => onSwitch('merge')}
      >
        合并：两袋 → 一袋
      </button>
      <button
        className={`cursor-pointer rounded-[14px] px-[22px] py-2.5 text-[15px] font-bold shadow-[0_3px_10px_rgba(0,0,0,.08)] transition-all duration-250 ${
          mode === 'split'
            ? 'bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-[0_4px_16px_rgba(99,102,241,.3)]'
            : 'border-2 border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700'
        }`}
        onClick={() => onSwitch('split')}
      >
        拆分：一袋 → 两袋
      </button>
    </div>
  )
}
