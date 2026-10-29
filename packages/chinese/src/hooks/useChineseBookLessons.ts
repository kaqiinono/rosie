'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@rosie/core'
import type { ChineseLessonRow, LessonCharGroup } from '../types/chineseCharData'
import type { ChineseBookSlug } from '../utils/chinese-books'
import {
  chineseRoadmapCatalogStore,
  ensureBookCatalog,
} from './useChineseRoadmapProgress'

/**
 * Book-scoped lessons + lessonGroups for admin plan editor.
 * Reuses `chineseRoadmapCatalogStore` — does not touch the child's active book.
 */
export function useChineseBookLessons(bookSlug: ChineseBookSlug | null): {
  lessons: ChineseLessonRow[]
  lessonGroups: LessonCharGroup[]
  isLoading: boolean
  ready: boolean
  error: unknown | null
} {
  const { user } = useAuth()
  const { data: catalogCache, isLoading: cacheSlotLoading, error: cacheError } =
    chineseRoadmapCatalogStore.useSessionData(user)
  const [fetchError, setFetchError] = useState<unknown | null>(null)

  const catalog = bookSlug ? catalogCache[bookSlug] : undefined
  const bookLoading = !!user && !!bookSlug && !catalog && !fetchError

  useEffect(() => {
    if (!user || !bookSlug) {
      setFetchError(null)
      return
    }
    if (catalogCache[bookSlug]) {
      setFetchError(null)
      return
    }
    let cancelled = false
    setFetchError(null)
    void ensureBookCatalog(user.id, bookSlug).catch((error: unknown) => {
      if (!cancelled) setFetchError(error)
    })
    return () => {
      cancelled = true
    }
  }, [user, bookSlug, catalogCache])

  return {
    ready: !!user && !!bookSlug && !!catalog && !cacheError && !fetchError,
    error: cacheError ?? fetchError,
    lessons: catalog?.lessons ?? [],
    lessonGroups: catalog?.lessonGroups ?? [],
    isLoading: !!bookSlug && (cacheSlotLoading || bookLoading),
  }
}
