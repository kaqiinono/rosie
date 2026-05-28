'use client'

import clsx from 'clsx'
import type { ChoiceOption } from '@/utils/calculate-types'

type ChoiceGridProps = {
  options: ChoiceOption[]
  onSelect: (option: ChoiceOption) => void
  selectedValue: string | null
  correctValue: string | null
  showResult: boolean
  disabled?: boolean
}

function ChoiceGrid({
  options,
  onSelect,
  selectedValue,
  correctValue,
  showResult,
  disabled = false,
}: ChoiceGridProps) {
  function getOptionClasses(option: ChoiceOption): string {
    const isSelected = selectedValue === option.value
    const isCorrect = correctValue === option.value

    if (showResult) {
      if (isCorrect) {
        return 'border-green-500 bg-green-50 text-green-700'
      }
      if (isSelected && !isCorrect) {
        return 'border-red-500 bg-red-50 text-red-700'
      }
      return 'border-gray-200 bg-white text-gray-400'
    }

    if (isSelected) {
      return 'border-blue-500 bg-blue-50 text-blue-700'
    }

    return 'border-gray-200 bg-white text-gray-900'
  }

  return (
    <div className="grid grid-cols-2 gap-3 w-full">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled || showResult}
          onClick={() => onSelect(option)}
          className={clsx(
            'p-4 rounded-xl border-2 text-center text-xl font-bold',
            'transition-colors select-none',
            getOptionClasses(option),
            (disabled || showResult) ? 'cursor-not-allowed' : 'hover:shadow-md active:scale-[0.98]'
          )}
        >
          {option.value}
        </button>
      ))}
    </div>
  )
}

export default ChoiceGrid
