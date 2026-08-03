'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { isChineseBookSlug, type ChineseBookSlug } from '../utils/chinese-books'
import { parseBookSlugFromPath } from '../utils/chinese-routes'

const STORAGE_KEY = 'chinese_active_book'
const DEFAULT_BOOK: ChineseBookSlug = 'g1b'

type BookListener = (slug: ChineseBookSlug) => void
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
  try {
    sessionStorage.setItem(STORAGE_KEY, bookSlug)
  } catch {
    /* ignore */
  }
  bookListeners.forEach((listener) => listener(bookSlug))
}

export function useActiveChineseBook(): ChineseBookSlug {
  const pathname = usePathname()
  const [bookSlug, setBookSlug] = useState<ChineseBookSlug>(() => {
    const fromPath =
      typeof window !== 'undefined'
        ? parseBookSlugFromPath(window.location.pathname)
        : parseBookSlugFromPath(pathname)
    return fromPath ?? readStoredBook() ?? DEFAULT_BOOK
  })

  useEffect(() => {
    bookListeners.add(setBookSlug)
    return () => {
      bookListeners.delete(setBookSlug)
    }
  }, [])

  useEffect(() => {
    const fromPath = parseBookSlugFromPath(pathname)
    if (fromPath) {
      setBookSlug(fromPath)
      try {
        sessionStorage.setItem(STORAGE_KEY, fromPath)
      } catch {
        /* ignore */
      }
      return
    }
    const stored = readStoredBook()
    if (stored) setBookSlug(stored)
  }, [pathname])

  return bookSlug
}
