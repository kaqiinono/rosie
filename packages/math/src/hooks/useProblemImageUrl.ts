'use client'

import { useEffect, useState } from 'react'
import type { Problem } from '@rosie/core'
import type { MathImageKind } from '@rosie/math/constants'
import { lessonIdFromProblemId } from '@rosie/math/constants'
import {
  loadLessonImageMap,
  resolveStoredImageUrl,
} from '@rosie/math/hooks/useMathProblemImages'

/** Resolve DB-backed image URL for a problem; falls back to static `analysisImg` for analysis kind. */
export function useProblemImageUrl(problem: Problem, kind: MathImageKind): string | null {
  const lessonId = lessonIdFromProblemId(problem.id)
  const [url, setUrl] = useState<string | null>(() =>
    kind === 'analysis' ? (problem.analysisImg ?? null) : null,
  )

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const map = await loadLessonImageMap(lessonId)
      if (cancelled) return

      const stored = resolveStoredImageUrl(map, problem.id, kind)
      if (stored) {
        setUrl(stored)
        return
      }

      setUrl(kind === 'analysis' ? (problem.analysisImg ?? null) : null)
    })()

    return () => {
      cancelled = true
    }
  }, [problem.id, problem.analysisImg, kind, lessonId])

  return url
}
