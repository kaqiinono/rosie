import type { FlipbookPageSync, FlipbookSyncManifest } from './flipbook-types'
import type { WordEntry } from '@rosie/core'
import { buildWordMatchRegex, resolveMatchedWord } from '@rosie/english'

export function flipbookWordKey(entry: WordEntry): string {
  return `${entry.stage ?? ''}::${entry.unit}::${entry.lesson}::${entry.word}`
}

export function entriesFromFlipbookWordKeys(
  keys: string[],
  vocab: WordEntry[],
): WordEntry[] {
  const map = new Map(vocab.map((e) => [flipbookWordKey(e), e]))
  const out: WordEntry[] = []
  for (const key of keys) {
    const entry = map.get(key)
    if (entry) out.push(entry)
  }
  return out
}

export type FlipbookWordMatchResult = {
  matchedWordKeys: string[]
  pageWordKeys: Map<number, string[]>
}

export function matchWordsInPages(
  pages: FlipbookPageSync[],
  vocab: WordEntry[],
): FlipbookWordMatchResult {
  const vocabWords = vocab.map((v) => v.word)
  const regex = buildWordMatchRegex(vocabWords)
  const pageWordKeys = new Map<number, string[]>()
  const allKeys = new Set<string>()

  for (const page of pages) {
    const keysOnPage = new Set<string>()

    if (page.content && regex) {
      const re = new RegExp(regex.source, regex.flags)
      let match: RegExpExecArray | null
      while ((match = re.exec(page.content)) !== null) {
        const entry = resolveMatchedWord(match[0], vocab)
        if (entry) {
          const key = flipbookWordKey(entry)
          keysOnPage.add(key)
          allKeys.add(key)
        }
      }
    }

    for (const token of page.words ?? []) {
      if (token.length < 2) continue
      const entry = resolveMatchedWord(token, vocab)
      if (entry) {
        const key = flipbookWordKey(entry)
        keysOnPage.add(key)
        allKeys.add(key)
      }
    }

    if (keysOnPage.size > 0) {
      pageWordKeys.set(page.page, [...keysOnPage])
    }
  }

  return {
    matchedWordKeys: [...allKeys].sort(),
    pageWordKeys,
  }
}

export function enrichManifestWithWordMatches(
  manifest: FlipbookSyncManifest,
  vocab: WordEntry[],
): FlipbookSyncManifest {
  const { matchedWordKeys } = matchWordsInPages(manifest.pages, vocab)
  return serializeManifestWithKeys(manifest, matchedWordKeys)
}

function serializeManifestWithKeys(
  manifest: FlipbookSyncManifest,
  matchedWordKeys: string[],
): FlipbookSyncManifest {
  return {
    version: 1,
    pages: manifest.pages,
    ...(matchedWordKeys.length > 0 ? { matchedWordKeys } : {}),
  }
}

export function getBookMatchedWordKeys(
  manifest: FlipbookSyncManifest | null | undefined,
  vocab: WordEntry[],
): string[] {
  if (!manifest) return []
  if (manifest.matchedWordKeys?.length) return manifest.matchedWordKeys
  return matchWordsInPages(manifest.pages, vocab).matchedWordKeys
}

export function getBookWordEntries(
  manifest: FlipbookSyncManifest | null | undefined,
  vocab: WordEntry[],
): WordEntry[] {
  const keys = getBookMatchedWordKeys(manifest, vocab)
  return entriesFromFlipbookWordKeys(keys, vocab)
}

export function getPageWordEntries(
  manifest: FlipbookSyncManifest | null | undefined,
  page: number,
  vocab: WordEntry[],
): WordEntry[] {
  if (!manifest) return []
  const { pageWordKeys } = matchWordsInPages(
    manifest.pages.filter((p) => p.page === page),
    vocab,
  )
  const keys = pageWordKeys.get(page) ?? []
  return entriesFromFlipbookWordKeys(keys, vocab)
}

export function bookHasVocabularyData(manifest: FlipbookSyncManifest | null | undefined): boolean {
  if (!manifest) return false
  if (manifest.matchedWordKeys?.length) return true
  return manifest.pages.some((p) => Boolean(p.content?.trim()) || (p.words?.length ?? 0) > 0)
}

export function briefChineseDef(entry: WordEntry): string {
  if (entry.chineseDef?.trim()) return entry.chineseDef.trim()
  return entry.explanation.replace(/<[^>]+>/g, '').trim()
}
