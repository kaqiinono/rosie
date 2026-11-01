'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { isChineseBookSlug, type ChineseBookSlug } from '../utils/chinese-books'
import { parseBookSlugFromPath } from '../utils/chinese-routes'

const STORAGE_KEY = 'chinese_active_book'
const DEFAULT_BOOK: ChineseBookSlug = 'g1b'

type BookListener = () => void
let lastBook: ChineseBookSlug | null = null
const bookListeners = new Set<BookListener>()

function readStoredBook(): ChineseBookSlug | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored && isChineseBookSlug(stored)) return stored
  } catch {
    /* ignore */
  }
  return null
}

/** Persist active book for legacy practice routes without a book slug in the path. */
export function setActiveChineseBook(bookSlug: ChineseBookSlug): void {
  lastBook = bookSlug
  try {
    sessionStorage.setItem(STORAGE_KEY, bookSlug)
  } catch {
    /* ignore */
  }
  bookListeners.forEach((listener) => listener())
}

function subscribeBook(listener: BookListener) {
  bookListeners.add(listener)
  return () => { bookListeners.delete(listener) }
}

function storedBookSnapshot() {
  return readStoredBook() ?? lastBook ?? DEFAULT_BOOK
}

export function useActiveChineseBook(): ChineseBookSlug {
  const fromPath = parseBookSlugFromPath(usePathname())
  const stored = useSyncExternalStore(subscribeBook, storedBookSnapshot, () => DEFAULT_BOOK)
  useEffect(() => {
    if (fromPath) setActiveChineseBook(fromPath)
  }, [fromPath])
  return fromPath ?? stored
}
