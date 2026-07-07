'use client'

import { useEffect, useState } from 'react'
import {
  groupNotesByProblem,
  loadLessonNotes,
  type MathProblemNote,
} from '@rosie/math/hooks/useMathProblemNotes'

/** Load all notes for a lesson (e.g. lesson home / recap page). */
export function useLessonNotes(lessonId: string | undefined): {
  notes: MathProblemNote[]
  byProblem: { problemId: string; notes: MathProblemNote[] }[]
  isLoading: boolean
} {
  const [notes, setNotes] = useState<MathProblemNote[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!lessonId) {
      setNotes([])
      return
    }

    let cancelled = false
    void (async () => {
      setIsLoading(true)
      const rows = await loadLessonNotes(lessonId)
      if (!cancelled) {
        setNotes(rows)
        setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [lessonId])

  return {
    notes,
    byProblem: groupNotesByProblem(notes),
    isLoading,
  }
}
