'use client'

import { useEffect, useState } from 'react'
import { loadLessonImageMap } from '@rosie/math/hooks/useMathProblemImages'
import { analysisProblemIdsFromImageMap } from '@rosie/math/utils/problem-analysis-image'

/** Problem ids in a lesson that have a cloud-uploaded analysis image. */
export function useLessonAnalysisImageIds(lessonId: string): Set<string> {
  const [ids, setIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let cancelled = false
    void loadLessonImageMap(lessonId).then((map) => {
      if (cancelled) return
      setIds(analysisProblemIdsFromImageMap(map))
    })
    return () => {
      cancelled = true
    }
  }, [lessonId])

  return ids
}
