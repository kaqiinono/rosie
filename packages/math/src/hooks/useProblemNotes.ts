'use client'

import { useEffect, useState } from 'react'
import { lessonIdFromProblemId } from '@rosie/math/constants'
import {
  loadLessonNotes,
  notesForProblem,
  type MathProblemNote,
} from '@rosie/math/hooks/useMathProblemNotes'

/** Load notes for a single problem (student-facing). Uses per-lesson cache. */
export function useProblemNotes(problemId: string | undefined): {
  notes: MathProblemNote[]
  isLoading: boolean
} {
  const [notes, setNotes] = useState<MathProblemNote[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!problemId) return

    let cancelled = false
    const lessonId = lessonIdFromProblemId(problemId)

    void (async () => {
      setIsLoading(true)
      try {
        const rows = await loadLessonNotes(lessonId)
        if (!cancelled) {
          setNotes(notesForProblem(rows, problemId))
          setIsLoading(false)
        }
      } catch {
        if (!cancelled) {
          setNotes([])
          setIsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [problemId])

  if (!problemId) {
    return { notes: [], isLoading: false }
  }

  return { notes, isLoading }
}
