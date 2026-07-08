import { normalizeAllowedFontSize } from '@rosie/math/components/shared/rich-text-font-size'

/** Preset text colors (TipTap Color + TextStyle). */
export const RICH_TEXT_COLOR_PRESETS = [
  { value: '', label: '默认', swatch: '#1e293b' },
  { value: '#dc2626', label: '红', swatch: '#dc2626' },
  { value: '#2563eb', label: '蓝', swatch: '#2563eb' },
  { value: '#16a34a', label: '绿', swatch: '#16a34a' },
  { value: '#9333ea', label: '紫', swatch: '#9333ea' },
  { value: '#ea580c', label: '橙', swatch: '#ea580c' },
] as const

/** Preset highlighter colors (TipTap Highlight multicolor). */
export const RICH_HIGHLIGHT_PRESETS = [
  { value: '', label: '无', swatch: '#ffffff' },
  { value: '#fef08a', label: '黄', swatch: '#fef08a' },
  { value: '#bbf7d0', label: '绿', swatch: '#bbf7d0' },
  { value: '#bfdbfe', label: '蓝', swatch: '#bfdbfe' },
  { value: '#fbcfe8', label: '粉', swatch: '#fbcfe8' },
  { value: '#fed7aa', label: '橙', swatch: '#fed7aa' },
] as const

const ALLOWED_COLOR_VALUES = new Set<string>([
  ...RICH_TEXT_COLOR_PRESETS.map((c) => c.value).filter(Boolean),
  ...RICH_HIGHLIGHT_PRESETS.map((c) => c.value).filter(Boolean),
])

function expandHex(hex: string): string {
  const h = hex.toLowerCase()
  if (/^#[0-9a-f]{3}$/.test(h)) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`
  }
  return h
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, n))
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')}`
}

/** Map rgb()/hex to an allowed preset hex, or null. */
export function normalizeAllowedColor(value: string): string | null {
  const raw = value.trim()
  if (!raw) return null

  const lower = raw.toLowerCase()
  if (ALLOWED_COLOR_VALUES.has(lower)) return lower

  const hex = expandHex(lower)
  if (ALLOWED_COLOR_VALUES.has(hex)) return hex

  const rgbMatch = lower.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (rgbMatch) {
    const fromRgb = rgbToHex(
      parseInt(rgbMatch[1]!, 10),
      parseInt(rgbMatch[2]!, 10),
      parseInt(rgbMatch[3]!, 10),
    )
    if (ALLOWED_COLOR_VALUES.has(fromRgb)) return fromRgb
  }

  return null
}

/** @deprecated Use normalizeAllowedColor */
export function isAllowedRichColor(value: string): boolean {
  return normalizeAllowedColor(value) !== null
}

/** Keep only whitelisted color / background-color / font-size declarations. */
export function sanitizeRichInlineStyle(style: string): string | null {
  const parts: string[] = []
  for (const chunk of style.split(';')) {
    const sep = chunk.indexOf(':')
    if (sep < 0) continue
    const prop = chunk.slice(0, sep).trim().toLowerCase()
    const rawValue = chunk.slice(sep + 1).trim()
    if (prop === 'color' || prop === 'background-color') {
      const normalized = normalizeAllowedColor(rawValue)
      if (normalized) parts.push(`${prop}: ${normalized}`)
    } else if (prop === 'font-size') {
      const normalized = normalizeAllowedFontSize(rawValue)
      if (normalized) parts.push(`${prop}: ${normalized}`)
    }
  }
  return parts.length > 0 ? parts.join('; ') : null
}

/** Ensure TipTap highlight marks carry inline background-color for display. */
export function normalizeRichColorMarks(html: string): string {
  if (typeof document === 'undefined') return html
  const root = document.createElement('div')
  root.innerHTML = html
  root.querySelectorAll('mark[data-color]').forEach((el) => {
    const color = el.getAttribute('data-color')
    if (!color) return
    const normalized = normalizeAllowedColor(color)
    if (!normalized) {
      el.removeAttribute('data-color')
      return
    }
    el.setAttribute('data-color', normalized)
    const existing = sanitizeRichInlineStyle(el.getAttribute('style') ?? '') ?? ''
    const bg = `background-color: ${normalized}`
    el.setAttribute('style', existing ? `${existing}; ${bg}` : bg)
  })
  return root.innerHTML
}

/** Ensure text color spans keep inline color (TipTap TextStyle + Color). */
export function normalizeRichTextColorSpans(html: string): string {
  if (typeof document === 'undefined') return html
  const root = document.createElement('div')
  root.innerHTML = html
  root.querySelectorAll('span[style]').forEach((el) => {
    const safe = sanitizeRichInlineStyle(el.getAttribute('style') ?? '')
    if (safe) el.setAttribute('style', safe)
    else el.removeAttribute('style')
  })
  return root.innerHTML
}
