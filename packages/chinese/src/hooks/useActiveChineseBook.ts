'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { isChineseBookSlug, type ChineseBookSlug } from '../utils/chinese-books'
import { parseBookSlugFromPath } from '../utils/chinese-routes'

const STORAGE_KEY = 'chinese_active_book'
const DEFAULT_BOOK: ChineseBookSlug = 'g1b'

export function useActiveChineseBook(): ChineseBookSlug {
  const pathname = usePathname()
  const [bookSlug, setBookSlug] = useState<ChineseBookSlug>(DEFAULT_BOOK)

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
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored && isChineseBookSlug(stored)) setBookSlug(stored)
    } catch {
      /* ignore */
    }
  }, [pathname])

  return bookSlug
}
