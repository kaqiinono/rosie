'use client'

import { STAR_COLOR_HEX, type StarColor } from './star-types'

interface Props {
  color: StarColor
  size?: number
  /** Render the Chinese category letter (口/英/数) centered inside the icon. */
  withBadge?: boolean
  /** Drop-shadow glow intensity. 0 disables glow. */
  glow?: number
  className?: string
  ariaLabel?: string
}

/**
 * Color-coded reward icon. The shape switches by category:
 *   yellow → 5-point star (口算)
 *   red    → crescent moon  (英语)
 *   blue   → radiant sun    (数学)
 * Each shape shares the soft → primary → outline vertical gradient and a
 * matching dark outline so the silhouettes feel like one cohesive set.
 */
export default function ColoredStar({
  color,
  size = 18,
  withBadge = false,
  glow = 6,
  className,
  ariaLabel,
}: Props) {
  const hex = STAR_COLOR_HEX[color]
  const gradId = `cstar-grad-${color}-${size}`
  const { shape } = hex

  // Badge anchor — tweaked per shape so the 口/英/数 letter sits in the
  // visually densest part of the silhouette.
  const badge = (() => {
    if (shape === 'moon') {
      return { x: 10, y: 15.6, fontSize: 6.2 }
    }
    if (shape === 'sun') {
      return { x: 12, y: 14, fontSize: 5.4 }
    }
    return { x: 12, y: 14.6, fontSize: 6.4 }
  })()

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-label={ariaLabel ?? `${hex.cnLabel}${hex.shapeLabel}`}
      role="img"
      className={className}
      style={glow > 0 ? { filter: `drop-shadow(0 0 ${glow}px ${hex.glow})` } : undefined}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={hex.soft} />
          <stop offset="55%" stopColor={hex.primary} />
          <stop offset="100%" stopColor={hex.outline} />
        </linearGradient>
      </defs>

      {shape === 'star' && (
        <path
          d="M12 2.4l2.85 6.05 6.65.78-4.95 4.5 1.4 6.55L12 17.05l-5.95 3.23 1.4-6.55L2.5 9.23l6.65-.78L12 2.4z"
          fill={`url(#${gradId})`}
          stroke={hex.outline}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      )}

      {shape === 'moon' && (
        <path
          d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4C12.92 3.04 12.46 3 12 3z"
          fill={`url(#${gradId})`}
          stroke={hex.outline}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      )}

      {shape === 'sun' && (
        <g>
          {/* 8 evenly-spaced rays as rounded pills around the disk. */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <rect
              key={deg}
              x="11.1"
              y="1.4"
              width="1.8"
              height="3.4"
              rx="0.9"
              fill={hex.outline}
              transform={`rotate(${deg} 12 12)`}
            />
          ))}
          {/* Center disk with the same gradient as the other shapes. */}
          <circle
            cx="12"
            cy="12"
            r="5.4"
            fill={`url(#${gradId})`}
            stroke={hex.outline}
            strokeWidth="1.5"
          />
        </g>
      )}

      {withBadge && (
        <text
          x={badge.x}
          y={badge.y}
          textAnchor="middle"
          fontFamily="Fredoka, system-ui, sans-serif"
          fontWeight="900"
          fontSize={badge.fontSize}
          fill="#ffffff"
          stroke={hex.outline}
          strokeWidth="0.35"
        >
          {hex.badge}
        </text>
      )}
    </svg>
  )
}
