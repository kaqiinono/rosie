/** Shared chrome for lesson top bar — one height, one radius, neutral borders. */

export const LESSON_HEADER_ICON_BTN =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200/90 bg-white text-text-muted transition-colors hover:border-gray-300 hover:bg-gray-50 sm:h-9 sm:w-9'

export const LESSON_HEADER_TEXT_BTN =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200/90 bg-white px-2.5 text-[11px] font-semibold text-text-secondary no-underline transition-colors hover:border-gray-300 hover:bg-gray-50 sm:h-9 sm:px-3 sm:text-[12px]'

export const LESSON_HEADER_NAV_IDLE =
  'inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-transparent px-2 text-[11px] font-medium whitespace-nowrap text-text-muted no-underline transition-colors hover:border-gray-200/90 hover:bg-white hover:text-text-secondary sm:h-9 sm:gap-1.5 sm:px-2.5 sm:text-[12px]'

export function lessonHeaderNavActive(activeColor: string): string {
  return `inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-gray-200/90 bg-white px-2 text-[11px] font-semibold whitespace-nowrap no-underline shadow-sm transition-colors sm:h-9 sm:gap-1.5 sm:px-2.5 sm:text-[12px] ${activeColor}`
}

export const LESSON_HEADER_MORE_BTN =
  'inline-flex h-8 shrink-0 items-center gap-0.5 rounded-lg border border-gray-200/90 bg-white px-2 text-[11px] font-semibold whitespace-nowrap text-text-secondary transition-colors hover:border-gray-300 hover:bg-gray-50 sm:h-9 sm:gap-1 sm:px-2.5 sm:text-[12px]'
