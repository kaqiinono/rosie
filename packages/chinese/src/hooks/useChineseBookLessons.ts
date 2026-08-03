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
} {
  const { user } = useAuth()
  const { data: catalogCache, isLoading: cacheSlotLoading } =
    chineseRoadmapCatalogStore.useSessionData(user)
  const [fetchError, setFetchError] = useState(false)

  const catalog = bookSlug ? catalogCache[bookSlug] : undefined
  const bookLoading = !!user && !!bookSlug && !catalog && !fetchError

  useEffect(() => {
    if (!user || !bookSlug) {
      setFetchError(false)
      return
    }
    if (catalogCache[bookSlug]) {
      setFetchError(false)
      return
    }
    let cancelled = false
    setFetchError(false)
    void ensureBookCatalog(user.id, bookSlug).catch(() => {
      if (!cancelled) setFetchError(true)
    })
    return () => {
      cancelled = true
    }
  }, [user, bookSlug, catalogCache])

  return {
    lessons: catalog?.lessons ?? [],
    lessonGroups: catalog?.lessonGroups ?? [],
    isLoading: !!bookSlug && (cacheSlotLoading || bookLoading),
  }
}
