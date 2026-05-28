'use client'

import clsx from 'clsx'

type StreakIndicatorProps = {
  streak: number
  maxDisplay?: number
}

function StreakIndicator({ streak, maxDisplay = 5 }: StreakIndicatorProps) {
  const dots = Array.from({ length: maxDisplay }, (_, i) => i < streak)

  const dotColor = clsx({
    'text-red-500': streak >= 10,
    'text-amber-500': streak >= 5 && streak < 10,
    'text-blue-500': streak > 0 && streak < 5,
  })

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-semibold text-gray-500 mr-1">连击</span>
      {dots.map((active, i) => (
        <span
          key={i}
          className={clsx(
            'text-base leading-none',
            active ? dotColor : 'text-gray-300'
          )}
        >
          {active ? '●' : '○'}
        </span>
      ))}
      {streak > maxDisplay && (
        <span className={clsx('text-xs font-bold ml-0.5', dotColor)}>
          +{streak - maxDisplay}
        </span>
      )}
    </div>
  )
}

export default StreakIndicator
