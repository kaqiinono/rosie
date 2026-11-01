'use client'

import { useAuth } from '@rosie/core'
import type { ChineseLessonRow, LessonCharGroup } from '../types/chineseCharData'
import type { ChineseBookSlug } from '../utils/chinese-books'
import { useBookCatalog } from './useChineseRoadmapProgress'

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
  const { catalog, isLoading, error } = useBookCatalog(user, bookSlug)
  return {
    ready: !!user && !!bookSlug && !!catalog && !error,
    error,
    lessons: catalog?.lessons ?? [],
    lessonGroups: catalog?.lessonGroups ?? [],
    isLoading,
  }
}
