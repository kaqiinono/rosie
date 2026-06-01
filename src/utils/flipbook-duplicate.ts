import { parseCloudPageImageFilename } from '@/utils/flipbook-page-images'

export type FlipbookDuplicateKind = 'existing_book' | 'duplicate_page'

export type FlipbookDuplicatePrompt = {
  kind: FlipbookDuplicateKind
  title: string
  slug: string
  detail: string
}

export type FlipbookDuplicateAction = 'overwrite' | 'skip' | 'abort'

export type FlipbookCreateOutcome = 'created' | 'skipped' | 'aborted'

export function duplicatePageNumbers(files: File[]): number[] {
  const counts = new Map<number, number>()
  for (const file of files) {
    const page = parseCloudPageImageFilename(file.name)
    if (page == null) continue
    counts.set(page, (counts.get(page) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, n]) => n > 1)
    .map(([page]) => page)
    .sort((a, b) => a - b)
}

/** 重复页码：overwrite 保留最后一个，skip 保留第一个 */
export function dedupePageImageFilesByPage(
  files: File[],
  keep: 'first' | 'last',
): File[] {
  const byPage = new Map<number, File>()
  const order = keep === 'first' ? files : [...files].reverse()
  for (const file of order) {
    const page = parseCloudPageImageFilename(file.name)
    if (page == null) continue
    byPage.set(page, file)
  }
  return [...byPage.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, file]) => file)
}

export function formatDuplicatePageList(pages: number[]): string {
  return pages.map((p) => String(p).padStart(4, '0')).join('、')
}
