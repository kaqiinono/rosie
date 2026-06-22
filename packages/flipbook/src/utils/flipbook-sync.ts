import type { FlipbookPageSync, FlipbookSyncManifest } from './flipbook-types'

function parsePage(item: unknown): FlipbookPageSync | null {
  if (!item || typeof item !== 'object') return null
  const p = item as Record<string, unknown>
  const page = Number(p.page)
  if (!Number.isFinite(page) || page < 1) return null

  const result: FlipbookPageSync = { page: Math.floor(page) }
  if (typeof p.content === 'string') result.content = p.content
  if (Array.isArray(p.words)) {
    result.words = p.words.filter((w): w is string => typeof w === 'string')
  }
  return result
}

export function parseSyncManifest(raw: unknown): FlipbookSyncManifest | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.version !== 1) return null
  if (!Array.isArray(o.pages)) return null

  const pages: FlipbookPageSync[] = []
  for (const item of o.pages) {
    const page = parsePage(item)
    if (!page) return null
    pages.push(page)
  }
  if (pages.length === 0) return null

  const matchedWordKeys = Array.isArray(o.matchedWordKeys)
    ? o.matchedWordKeys.filter((k): k is string => typeof k === 'string')
    : undefined

  return {
    version: 1,
    pages: pages.sort((a, b) => a.page - b.page),
    matchedWordKeys,
  }
}

export function parseSyncFileText(text: string): FlipbookSyncManifest | null {
  try {
    return parseSyncManifest(JSON.parse(text) as unknown)
  } catch {
    return null
  }
}

export function validateManifestAgainstPageCount(
  manifest: FlipbookSyncManifest,
  pageCount: number,
): string | null {
  for (const page of manifest.pages) {
    if (page.page > pageCount) {
      return `sync.json 第 ${page.page} 页超出总页数（${pageCount}）`
    }
  }
  return null
}

export function serializeSyncManifest(manifest: FlipbookSyncManifest): FlipbookSyncManifest {
  return {
    version: 1,
    pages: manifest.pages.map((p) => ({
      page: p.page,
      ...(p.content != null ? { content: p.content } : {}),
      ...(p.words?.length ? { words: p.words } : {}),
    })),
    ...(manifest.matchedWordKeys?.length ? { matchedWordKeys: manifest.matchedWordKeys } : {}),
  }
}
