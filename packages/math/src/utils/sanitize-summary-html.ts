import DOMPurify from 'dompurify'
import { MATH_IMAGES_BUCKET } from '@rosie/math/constants'
import { isNoteBodyEmpty } from '@rosie/math/utils/sanitize-note-html'
import {
  normalizeAllowedColor,
  normalizeRichColorMarks,
  normalizeRichTextColorSpans,
  sanitizeRichInlineStyle,
} from '@rosie/math/components/shared/rich-text-colors'
import {
  DEFAULT_RICH_IMG_WIDTH_PCT,
  RICH_CONTENT_IMG_TW,
  RICH_IMG_ALIGN_VALUES,
  richImgClassAttr,
  parseRichImgWidthPct,
  parseRichImgAlign,
  clampRichImgWidthPct,
  type RichImgAlign,
} from '@rosie/math/components/shared/rich-text-image'

export {
  RICH_INLINE_IMG_CLASS,
  RICH_CONTENT_IMG_TW,
} from '@rosie/math/components/shared/rich-text-image'

const RICH_ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'img', 'span', 'mark']
const RICH_ALLOWED_ATTR = ['src', 'alt', 'class', 'style', 'data-img-align', 'data-img-width-pct', 'data-color']

let domPurifyHookReady = false

function ensureDomPurifyHooks(): void {
  if (domPurifyHookReady || typeof window === 'undefined') return
  domPurifyHookReady = true
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName === 'style' && typeof data.attrValue === 'string') {
      const safe = sanitizeRichInlineStyle(data.attrValue)
      if (safe) data.attrValue = safe
      else data.keepAttr = false
      return
    }
    if (data.attrName === 'data-color' && typeof data.attrValue === 'string') {
      const safe = normalizeAllowedColor(data.attrValue)
      if (safe) data.attrValue = safe
      else data.keepAttr = false
    }
  })
}

/** Images uploaded to math bucket summaries/ or notes/ paths. */
export function isAllowedRichImageSrc(src: string): boolean {
  if (!src) return false
  try {
    const url = new URL(src)
    const base = `/storage/v1/object/public/${MATH_IMAGES_BUCKET}/`
    return (
      url.pathname.includes(`${base}summaries/`) ||
      url.pathname.includes(`${base}notes/`)
    )
  } catch {
    return false
  }
}

function stripInvalidImages(html: string): string {
  if (typeof document === 'undefined') return html
  const root = document.createElement('div')
  root.innerHTML = html
  root.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') ?? ''
    if (!isAllowedRichImageSrc(src)) img.remove()
    else {
      const className = img.getAttribute('class') ?? ''
      const widthPct = img.getAttribute('data-img-width-pct')
        ? clampRichImgWidthPct(parseInt(img.getAttribute('data-img-width-pct')!, 10))
        : parseRichImgWidthPct(className)
      const dataAlign = img.getAttribute('data-img-align')
      const align: RichImgAlign =
        dataAlign && RICH_IMG_ALIGN_VALUES.includes(dataAlign as RichImgAlign)
          ? (dataAlign as RichImgAlign)
          : parseRichImgAlign(className)
      img.setAttribute('class', richImgClassAttr(widthPct, align))
      img.setAttribute('data-img-width-pct', String(widthPct))
      img.setAttribute('data-img-align', align)
    }
  })
  return root.innerHTML
}

function normalizeRichTextColors(html: string): string {
  return normalizeRichTextColorSpans(normalizeRichColorMarks(html))
}

/** Rich note/summary body: text formatting + inline images from our storage bucket. */
export function sanitizeRichHtml(html: string): string {
  if (typeof window !== 'undefined') ensureDomPurifyHooks()
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: RICH_ALLOWED_TAGS,
    ALLOWED_ATTR: RICH_ALLOWED_ATTR,
  })
  return normalizeRichTextColors(stripInvalidImages(clean))
}

/** @deprecated Use sanitizeRichHtml */
export const sanitizeSummaryHtml = sanitizeRichHtml

/** True when body has no visible text and no images. */
export function isRichBodyEmpty(html: string): boolean {
  const clean = sanitizeRichHtml(html)
  if (/<img\b/i.test(clean)) return false
  return isNoteBodyEmpty(clean)
}

/** @deprecated Use isRichBodyEmpty */
export const isSummaryBodyEmpty = isRichBodyEmpty

/** @deprecated Use isAllowedRichImageSrc */
export const isAllowedSummaryImageSrc = isAllowedRichImageSrc

/** Single inline image paragraph for note/summary bodies (PDF slice or editor upload). */
export function richInlineImageHtml(url: string): string {
  return `<p><img src="${url}" alt="" class="${richImgClassAttr(DEFAULT_RICH_IMG_WIDTH_PCT)}" /></p>`
}

/** Append an inline image to existing rich HTML (creates new paragraph). */
export function appendRichInlineImage(html: string, url: string): string {
  const img = richInlineImageHtml(url)
  if (isRichBodyEmpty(html)) return img
  return `${html}${img}`
}

export const RICH_CONTENT_IMG_TW_COMPACT = RICH_CONTENT_IMG_TW
