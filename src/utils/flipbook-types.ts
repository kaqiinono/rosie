export const FLIPBOOK_BUCKET = 'flipbook'

export const FLIPBOOK_MAX_PAGES = 120

export type FlipbookStatus = 'uploading' | 'processing' | 'ready' | 'error'

/** Per-page vocabulary index from sync.json (no audio timing). */
export type FlipbookPageSync = {
  page: number
  content?: string
  words?: string[]
}

export type FlipbookSyncManifest = {
  version: 1
  pages: FlipbookPageSync[]
  /** Populated at upload after matching word_entries. */
  matchedWordKeys?: string[]
}

export type FlipbookBook = {
  id: string
  userId: string
  slug: string
  title: string
  description: string | null
  pageCount: number | null
  /** Storage prefix for page images (`books/{slug}/pages`), stored in `pdf_path` column. */
  pagesPath: string
  audioPath: string | null
  syncManifest: FlipbookSyncManifest | null
  status: FlipbookStatus
  createdAt: string
  updatedAt: string
}

export type FlipbookProgress = {
  bookId: string
  lastPage: number
  audioPositionSec: number
  updatedAt: string
}

export function normalizeFlipbookSlug(raw: string): string {
  const s = raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5-_]/g, '')
    .replace(/-+/g, '-')
  return s || `book-${Date.now()}`
}

export function flipbookStoragePrefix(slug: string): string {
  return `books/${normalizeFlipbookSlug(slug)}`
}

export function flipbookAudioPath(slug: string): string {
  return `${flipbookStoragePrefix(slug)}/narration.mp3`
}

export function flipbookPagesPrefix(slug: string): string {
  return `${flipbookStoragePrefix(slug)}/pages`
}

export function flipbookPageImagePath(slug: string, page: number): string {
  return `${flipbookPagesPrefix(slug)}/${String(page).padStart(4, '0')}.webp`
}
