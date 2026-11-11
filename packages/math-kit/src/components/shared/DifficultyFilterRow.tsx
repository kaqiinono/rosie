'use client'

import {
  ALL_DIFFICULTY_LEVELS,
  DIFFICULTY_FILTER_BTNS,
  allDifficultiesSelected,
  type ProblemDifficulty,
} from '@rosie/core'
import { Button } from '@rosie/ui/themes'

type Props = {
  selected: Set<ProblemDifficulty>
  onToggle: (level: ProblemDifficulty) => void
  /** Tailwind classes for section label + select-all link, e.g. text-cyan-700 */
  accentClass: string
}

export default function DifficultyFilterRow({ selected, onToggle, accentClass }: Props) {
  const allSelected = allDifficultiesSelected(selected)

  return (
    <div className="mb-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className={`text-[11px] font-bold ${accentClass}`}>⭐ 难度筛选</span>
        <Button
          type="button"
          size="1"
          variant="ghost"
          onClick={() => {
            ALL_DIFFICULTY_LEVELS.forEach((level) => {
              if (allSelected || !selected.has(level)) onToggle(level)
            })
          }}
        >
          {allSelected ? '全不选' : '全选'}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DIFFICULTY_FILTER_BTNS.map((b) => (
          <Button
            key={b.key}
            type="button"
            size="1"
            radius="full"
            variant={selected.has(b.key) ? 'solid' : 'soft'}
            onClick={() => onToggle(b.key)}
          >
            {b.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
