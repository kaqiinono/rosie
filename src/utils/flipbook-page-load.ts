/** Pages per lazy-load batch (on page 1 → load 1–6; on page 7 → load 7–12). */
export const FLIPBOOK_PAGE_CHUNK = 6

/** Page range fetched when user reaches `triggerPage` (1-based). */
export function flipbookChunkRange(
  triggerPage: number,
  totalPages: number,
): { start: number; end: number } {
  const start = triggerPage * FLIPBOOK_PAGE_CHUNK - (FLIPBOOK_PAGE_CHUNK - 1)
  const end = Math.min(triggerPage * FLIPBOOK_PAGE_CHUNK, totalPages)
  return { start, end }
}

/** Pages in the batch for this flip position only (not cumulative). */
export function flipbookPagesInChunk(triggerPage: number, totalPages: number): number[] {
  if (totalPages <= 0 || triggerPage < 1) return []
  const { start, end } = flipbookChunkRange(triggerPage, totalPages)
  const pages: number[] = []
  for (let p = start; p <= end; p++) pages.push(p)
  return pages
}

/** Which trigger's batch contains `page` (e.g. page 7 → trigger 2 → pages 7–12 when chunk=6). */
export function flipbookChunkTriggerContainingPage(page: number, totalPages: number): number {
  for (let t = 1; t <= totalPages; t++) {
    const { start, end } = flipbookChunkRange(t, totalPages)
    if (page >= start && page <= end) return t
  }
  return Math.max(1, page)
}

/** Warm browser image cache before the page enters the flipbook DOM. */
export function preloadFlipbookPageImages(pageNums: number[], urls: string[]): void {
  for (const p of pageNums) {
    const url = urls[p - 1]
    if (!url) continue
    const img = new Image()
    img.decoding = 'async'
    img.src = url
  }
}
