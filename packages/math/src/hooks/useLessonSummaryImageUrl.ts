'use client'

import { useEffect, useState } from 'react'
import { lessonSummaryProblemId } from '@rosie/math/constants'
import {
  loadLessonImageMap,
  resolveStoredImageUrl,
} from '@rosie/math/hooks/useMathProblemImages'

/** Cloud-uploaded lesson summary image for a讲次 homepage. */
export function useLessonSummaryImageUrl(lessonId: string): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const map = await loadLessonImageMap(lessonId)
      if (cancelled) return
      setUrl(resolveStoredImageUrl(map, lessonSummaryProblemId(lessonId), 'summary'))
    })()

    return () => {
      cancelled = true
    }
  }, [lessonId])

  return url
}
