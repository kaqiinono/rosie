export type StarColor = 'yellow' | 'red' | 'blue'
export type StarShape = 'star' | 'moon' | 'sun'

export interface BurstEvent {
  id: number
  color: StarColor
  amount: number
  bonus?: number
  /** Human-readable label, e.g. "全对加成 +20%" */
  bonusLabel?: string
  /** Session total of this color after the award (for hero display). */
  sessionTotal: number
  /** Lifetime balance after award. */
  total: number
  /** Optional anchor screen position; falls back to viewport center. */
  origin?: { x: number; y: number }
}

export interface StarTheme {
  /** Saturated primary used for outline + main fill. */
  primary: string
  /** Darker shade used for star outline so the silhouette is unmistakable. */
  outline: string
  /** Light highlight used for the top-half gradient. */
  soft: string
  /** Glow drop-shadow color (rgba). */
  glow: string
  /** Background tint for chips/cards (rgba). */
  bg: string
  /** Strong border color for chips (used in addition to the colored star). */
  border: string
  label: string
  /** Single-character Chinese category badge (口/英/数). */
  badge: string
  cnLabel: string
  /** Iconographic silhouette rendered for this category. */
  shape: StarShape
  /** Chinese word for the silhouette (星星/月亮/太阳). */
  shapeLabel: string
}

// Saturated, kid-friendly hues chosen to be unmistakable side by side.
// Yellow → warm sun gold, Red → candy-apple coral, Blue → royal sapphire.
export const STAR_COLOR_HEX: Record<StarColor, StarTheme> = {
  yellow: {
    primary: '#f59e0b',          // amber-500
    outline: '#b45309',          // amber-700 — dark gold outline
    soft: '#fde68a',             // amber-200
    glow: 'rgba(245,158,11,0.7)',
    bg: 'rgba(245,158,11,0.14)',
    border: 'rgba(180,83,9,0.55)',
    label: 'Yellow',
    badge: '口',
    cnLabel: '口算',
    shape: 'star',
    shapeLabel: '星星',
  },
  red: {
    primary: '#ef4444',          // red-500
    outline: '#991b1b',          // red-800 — deep crimson outline
    soft: '#fecaca',             // red-200
    glow: 'rgba(239,68,68,0.7)',
    bg: 'rgba(239,68,68,0.14)',
    border: 'rgba(153,27,27,0.55)',
    label: 'Red',
    badge: '英',
    cnLabel: '英语',
    shape: 'moon',
    shapeLabel: '月亮',
  },
  blue: {
    primary: '#2563eb',          // blue-600 — vivid royal blue
    outline: '#1e3a8a',          // blue-900 — navy outline
    soft: '#bfdbfe',             // blue-200
    glow: 'rgba(37,99,235,0.7)',
    bg: 'rgba(37,99,235,0.14)',
    border: 'rgba(30,58,138,0.55)',
    label: 'Blue',
    badge: '数',
    cnLabel: '数学',
    shape: 'sun',
    shapeLabel: '太阳',
  },
}
