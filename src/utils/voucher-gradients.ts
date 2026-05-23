/**
 * Tailwind gradient presets for voucher template colors.
 * The {@link VoucherTemplateModal} renders these as a swatch picker,
 * and {@link VoucherCard} applies the chosen class verbatim.
 */
export interface GradientPreset {
  /** Tailwind utility classes — pasted into `bg-gradient-to-br ${value}` */
  value: string
  /** Human-readable Chinese label shown next to the swatch */
  label: string
  /** Two hex colors used for swatch preview (must match the Tailwind classes) */
  swatch: [string, string]
}

export const GRADIENT_PRESETS: readonly GradientPreset[] = [
  { value: 'from-indigo-500 to-purple-500',   label: '紫蓝', swatch: ['#6366f1', '#a855f7'] },
  { value: 'from-pink-500 to-rose-400',       label: '粉玫', swatch: ['#ec4899', '#fb7185'] },
  { value: 'from-yellow-400 to-orange-400',   label: '金橙', swatch: ['#facc15', '#fb923c'] },
  { value: 'from-green-500 to-teal-500',      label: '青绿', swatch: ['#22c55e', '#14b8a6'] },
  { value: 'from-teal-500 to-emerald-500',    label: '翠绿', swatch: ['#14b8a6', '#10b981'] },
  { value: 'from-blue-500 to-cyan-400',       label: '海蓝', swatch: ['#3b82f6', '#22d3ee'] },
  { value: 'from-orange-500 to-rose-500',     label: '夕阳', swatch: ['#f97316', '#f43f5e'] },
  { value: 'from-pink-500 to-fuchsia-500',    label: '樱粉', swatch: ['#ec4899', '#d946ef'] },
  { value: 'from-amber-500 to-violet-500',    label: '霞紫', swatch: ['#f59e0b', '#8b5cf6'] },
  { value: 'from-violet-500 to-purple-400',   label: '葡萄', swatch: ['#8b5cf6', '#c084fc'] },
  { value: 'from-yellow-500 to-amber-400',    label: '蜂蜜', swatch: ['#eab308', '#fbbf24'] },
  { value: 'from-slate-500 to-zinc-500',      label: '石灰', swatch: ['#64748b', '#71717a'] },
] as const

export const DEFAULT_GRADIENT = GRADIENT_PRESETS[0].value
