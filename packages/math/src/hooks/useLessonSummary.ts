'use client'

import { useEffect, useState } from 'react'
import { lessonSummaryProblemId } from '@rosie/math/constants'
import {
  loadLessonNotes,
  notesForProblem,
  type MathProblemNote,
} from '@rosie/math/hooks/useMathProblemNotes'

/** Per-lesson recap note stored under the summary sentinel problem id. */
export function useLessonSummary(lessonId: string | undefined): {
  summary: MathProblemNote | null
  isLoading: boolean
} {
  const [summary, setSummary] = useState<MathProblemNote | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!lessonId) {
      setSummary(null)
      return
    }

    let cancelled = false
    const problemId = lessonSummaryProblemId(lessonId)

    void (async () => {
      setIsLoading(true)
      try {
        const rows = await loadLessonNotes(lessonId)
        if (cancelled) return
        const notes = notesForProblem(rows, problemId)
        setSummary(notes[0] ?? null)
      } catch {
        if (!cancelled) setSummary(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [lessonId])

  return { summary, isLoading }
}
