/** Pages per lazy-load batch (on page 1 → load 1–3; on page 2 → load 4–6 only; on page 3 → 7–9 only). */
export const FLIPBOOK_PAGE_CHUNK = 3

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

/** Which trigger's batch contains `page` (e.g. page 5 → trigger 2 → pages 4–6). */
export function flipbookChunkTriggerContainingPage(page: number, totalPages: number): number {
  for (let t = 1; t <= totalPages; t++) {
    const { start, end } = flipbookChunkRange(t, totalPages)
    if (page >= start && page <= end) return t
  }
  return Math.max(1, page)
}
