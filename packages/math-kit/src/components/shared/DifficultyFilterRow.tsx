'use client'

import {
  ALL_DIFFICULTY_LEVELS,
  DIFFICULTY_FILTER_BTNS,
  allDifficultiesSelected,
  type ProblemDifficulty,
} from '@rosie/core'

type Props = {
  selected: Set<ProblemDifficulty>
  onToggle: (level: ProblemDifficulty) => void
  btnBase: string
  btnOn: string
  btnOff: string
  /** Tailwind classes for section label + select-all link, e.g. text-cyan-700 */
  accentClass: string
}

export default function DifficultyFilterRow({
  selected,
  onToggle,
  btnBase,
  btnOn,
  btnOff,
  accentClass,
}: Props) {
  const allSelected = allDifficultiesSelected(selected)

  return (
    <div className="mb-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className={`text-[11px] font-bold ${accentClass}`}>⭐ 难度筛选</span>
        <button
          type="button"
          onClick={() => {
            ALL_DIFFICULTY_LEVELS.forEach(level => {
              if (allSelected || !selected.has(level)) onToggle(level)
            })
          }}
          className={`cursor-pointer text-[10px] opacity-80 hover:opacity-100 transition-colors ${accentClass}`}
        >
          {allSelected ? '全不选' : '全选'}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DIFFICULTY_FILTER_BTNS.map(b => (
          <button
            key={b.key}
            type="button"
            onClick={() => onToggle(b.key)}
            className={`${btnBase} ${selected.has(b.key) ? btnOn : btnOff}`}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  )
}
