'use client'

import clsx from 'clsx'

type CircularTimerProps = {
  totalMs: number
  remainingMs: number
  size?: number
}

function CircularTimer({ totalMs, remainingMs, size = 48 }: CircularTimerProps) {
  const strokeWidth = 4
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0
  const dashOffset = circumference * (1 - progress)

  const percent = progress * 100

  const strokeColor = clsx({
    'stroke-green-500': percent > 50,
    'stroke-yellow-500': percent > 25 && percent <= 50,
    'stroke-red-500': percent <= 25,
  })

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="transform -rotate-90"
      aria-label="计时器"
    >
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        className={clsx('transition-all duration-300', strokeColor)}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
      />
    </svg>
  )
}

export default CircularTimer
