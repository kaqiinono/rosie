/** Preset font sizes (TipTap FontSize + TextStyle). */
export const RICH_FONT_SIZE_PRESETS = [
  { value: '', label: '默认' },
  { value: '12px', label: '12' },
  { value: '14px', label: '14' },
  { value: '16px', label: '16' },
  { value: '18px', label: '18' },
  { value: '20px', label: '20' },
] as const

const ALLOWED_FONT_SIZES = new Set<string>(
  RICH_FONT_SIZE_PRESETS.map((p) => p.value).filter(Boolean),
)

/** Map font-size to an allowed preset, or null. */
export function normalizeAllowedFontSize(value: string): string | null {
  const raw = value.trim().toLowerCase()
  if (!raw) return null
  return ALLOWED_FONT_SIZES.has(raw) ? raw : null
}
