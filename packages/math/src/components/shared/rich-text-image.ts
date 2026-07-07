import Image from '@tiptap/extension-image'

export const RICH_INLINE_IMG_CLASS = 'rich-inline-img'

/** Allowed width presets (percent of container). */
export const RICH_IMG_WIDTH_PCTS = [40, 60, 80, 100] as const

export type RichImgWidthPct = (typeof RICH_IMG_WIDTH_PCTS)[number]

export const DEFAULT_RICH_IMG_WIDTH_PCT: RichImgWidthPct = 80

export const RICH_IMG_WIDTH_PCT_LABELS: Record<RichImgWidthPct, string> = {
  40: '40%',
  60: '60%',
  80: '80%',
  100: '100%',
}

/** Legacy size class → width percent (migration). */
const LEGACY_SIZE_TO_PCT: Record<string, RichImgWidthPct> = {
  'rich-img-sm': 40,
  'rich-img-md': 60,
  'rich-img-lg': 80,
  'rich-img-full': 100,
}

export function richImgPctClass(pct: number): string {
  return `rich-img-pct-${clampRichImgWidthPct(pct)}`
}

export function clampRichImgWidthPct(pct: number): RichImgWidthPct {
  const allowed = RICH_IMG_WIDTH_PCTS as readonly number[]
  if (allowed.includes(pct)) return pct as RichImgWidthPct
  let nearest: RichImgWidthPct = DEFAULT_RICH_IMG_WIDTH_PCT
  let minDiff = Infinity
  for (const p of RICH_IMG_WIDTH_PCTS) {
    const diff = Math.abs(p - pct)
    if (diff < minDiff) {
      minDiff = diff
      nearest = p
    }
  }
  return nearest
}

export function parseRichImgWidthPct(className: string): RichImgWidthPct {
  const match = className.match(/rich-img-pct-(\d+)/)
  if (match) return clampRichImgWidthPct(parseInt(match[1]!, 10))
  for (const [legacy, pct] of Object.entries(LEGACY_SIZE_TO_PCT)) {
    if (className.includes(legacy)) return pct
  }
  return DEFAULT_RICH_IMG_WIDTH_PCT
}

/** Min width floor (px) paired with each width preset. */
export const RICH_IMG_MIN_WIDTH_PX: Record<RichImgWidthPct, number> = {
  40: 300,
  60: 500,
  80: 600,
  100: 800,
}

export function richImgMinWidth(pct: RichImgWidthPct): string {
  return `${RICH_IMG_MIN_WIDTH_PX[pct]}px`
}

export const RICH_IMG_ALIGN_CLASSES = {
  block: 'rich-img-block',
  left: 'rich-img-left',
  right: 'rich-img-right',
} as const

export type RichImgAlign = (typeof RICH_IMG_ALIGN_CLASSES)[keyof typeof RICH_IMG_ALIGN_CLASSES]

export const RICH_IMG_ALIGN_VALUES: RichImgAlign[] = Object.values(RICH_IMG_ALIGN_CLASSES)

export const DEFAULT_RICH_IMG_ALIGN: RichImgAlign = RICH_IMG_ALIGN_CLASSES.block

export const RICH_IMG_ALIGN_LABELS: Record<RichImgAlign, string> = {
  [RICH_IMG_ALIGN_CLASSES.block]: '独占',
  [RICH_IMG_ALIGN_CLASSES.left]: '左图',
  [RICH_IMG_ALIGN_CLASSES.right]: '右图',
}

export function parseRichImgAlign(className: string): RichImgAlign {
  const tokens = className.split(/\s+/).filter(Boolean)
  for (const align of RICH_IMG_ALIGN_VALUES) {
    if (tokens.includes(align)) return align
  }
  return DEFAULT_RICH_IMG_ALIGN
}

export function richImgClassAttr(
  widthPct: RichImgWidthPct = DEFAULT_RICH_IMG_WIDTH_PCT,
  align: RichImgAlign = DEFAULT_RICH_IMG_ALIGN,
): string {
  return `${RICH_INLINE_IMG_CLASS} ${richImgPctClass(widthPct)} ${align}`
}

export const RICH_IMG_SIZE_TW = [
  '[&_img.rich-img-pct-40]:w-[40%] [&_img.rich-img-pct-40]:min-w-[300px] [&_img.rich-img-pct-40]:max-w-full',
  '[&_img.rich-img-pct-60]:w-[60%] [&_img.rich-img-pct-60]:min-w-[500px] [&_img.rich-img-pct-60]:max-w-full',
  '[&_img.rich-img-pct-80]:w-[80%] [&_img.rich-img-pct-80]:min-w-[600px] [&_img.rich-img-pct-80]:max-w-full',
  '[&_img.rich-img-pct-100]:w-[100%] [&_img.rich-img-pct-100]:min-w-[800px] [&_img.rich-img-pct-100]:max-w-full',
  '[&_img.rich-img-left.rich-img-pct-100]:w-[50%] [&_img.rich-img-left.rich-img-pct-100]:min-w-[500px]',
  '[&_img.rich-img-right.rich-img-pct-100]:w-[50%] [&_img.rich-img-right.rich-img-pct-100]:min-w-[500px]',
].join(' ')

export const RICH_IMG_ALIGN_TW = [
  '[&_img.rich-img-block]:float-none [&_img.rich-img-block]:clear-both',
  '[&_img.rich-img-left]:float-left [&_img.rich-img-left]:mr-3 [&_img.rich-img-left]:mb-2 [&_img.rich-img-left]:clear-none',
  '[&_img.rich-img-right]:float-right [&_img.rich-img-right]:ml-3 [&_img.rich-img-right]:mb-2 [&_img.rich-img-right]:clear-none',
].join(' ')

/** Narrow viewports: stack image + text; ignore float / min-width from desktop presets. */
export const RICH_IMG_MOBILE_TW = [
  'max-md:[&_img.rich-inline-img]:float-none',
  'max-md:[&_img.rich-inline-img]:clear-both',
  'max-md:[&_img.rich-inline-img]:!w-full',
  'max-md:[&_img.rich-inline-img]:!min-w-0',
  'max-md:[&_img.rich-inline-img]:!max-w-full',
  'max-md:[&_img.rich-inline-img]:!ml-0',
  'max-md:[&_img.rich-inline-img]:!mr-0',
  'max-md:[&_img.rich-inline-img]:mb-2',
].join(' ')

export const RICH_IMG_BASE_TW =
  '[&_img.rich-inline-img]:block [&_img.rich-inline-img]:h-auto [&_img.rich-inline-img]:max-h-none [&_img.rich-inline-img]:rounded-md [&_img.rich-inline-img]:my-1.5'

export const RICH_CONTENT_IMG_TW = `${RICH_IMG_BASE_TW} ${RICH_IMG_SIZE_TW} ${RICH_IMG_ALIGN_TW} ${RICH_IMG_MOBILE_TW}`

export const RICH_CONTENT_CLEARFIX_TW =
  'after:clear-both after:block after:h-0 after:content-[""]'

/** TipTap image: width % preset + optional left/right float (CSS classes). */
export const RichTextImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      imgWidthPct: {
        default: DEFAULT_RICH_IMG_WIDTH_PCT,
        parseHTML: (element) => {
          const data = element.getAttribute('data-img-width-pct')
          if (data) return clampRichImgWidthPct(parseInt(data, 10))
          return parseRichImgWidthPct(element.getAttribute('class') ?? '')
        },
      },
      imgAlign: {
        default: DEFAULT_RICH_IMG_ALIGN,
        parseHTML: (element) => {
          const data = element.getAttribute('data-img-align')
          if (data && RICH_IMG_ALIGN_VALUES.includes(data as RichImgAlign)) {
            return data as RichImgAlign
          }
          return parseRichImgAlign(element.getAttribute('class') ?? '')
        },
      },
    }
  },
  renderHTML({ node }) {
    const widthPct = clampRichImgWidthPct(Number(node.attrs.imgWidthPct) || DEFAULT_RICH_IMG_WIDTH_PCT)
    const align = RICH_IMG_ALIGN_VALUES.includes(node.attrs.imgAlign as RichImgAlign)
      ? (node.attrs.imgAlign as RichImgAlign)
      : DEFAULT_RICH_IMG_ALIGN
    return [
      'img',
      {
        src: node.attrs.src,
        alt: node.attrs.alt ?? '',
        class: richImgClassAttr(widthPct, align),
        'data-img-width-pct': String(widthPct),
        'data-img-align': align,
      },
    ]
  },
})

export type RichImageAttrs = {
  src: string
  alt: string
  imgWidthPct: RichImgWidthPct
  imgAlign: RichImgAlign
}

export function defaultRichImageAttrs(src: string): RichImageAttrs {
  return {
    src,
    alt: '',
    imgWidthPct: DEFAULT_RICH_IMG_WIDTH_PCT,
    imgAlign: DEFAULT_RICH_IMG_ALIGN,
  }
}

/** @deprecated Use parseRichImgWidthPct */
export const parseRichImgSize = parseRichImgWidthPct

/** @deprecated Use RichImgWidthPct */
export type RichImgSize = RichImgWidthPct

/** @deprecated Use DEFAULT_RICH_IMG_WIDTH_PCT */
export const DEFAULT_RICH_IMG_SIZE = DEFAULT_RICH_IMG_WIDTH_PCT

/** @deprecated Use RICH_IMG_WIDTH_PCTS */
export const RICH_IMG_SIZE_VALUES = RICH_IMG_WIDTH_PCTS

/** @deprecated Use RICH_IMG_WIDTH_PCT_LABELS */
export const RICH_IMG_SIZE_LABELS = RICH_IMG_WIDTH_PCT_LABELS
