'use client'

import { useEffect, useState } from 'react'
import {
  groupNotesByProblem,
  loadLessonNotes,
  type MathProblemNote,
} from '@rosie/math-kit/hooks/useMathProblemNotes'

/** Load all notes for a lesson (e.g. lesson home / recap page). */
export function useLessonNotes(lessonId: string | undefined): {
  notes: MathProblemNote[]
  byProblem: { problemId: string; notes: MathProblemNote[] }[]
  isLoading: boolean
} {
  const [loaded, setLoaded] = useState<{ lesson: string; notes: MathProblemNote[] } | null>(null)
  useEffect(() => {
    if (!lessonId) return
    let cancelled = false
    void loadLessonNotes(lessonId).then((notes) => {
      if (!cancelled) setLoaded({ lesson: lessonId, notes })
    })
    return () => { cancelled = true }
  }, [lessonId])

  const notes = loaded?.lesson === lessonId ? (loaded?.notes ?? []) : []
  const isLoading = !!lessonId && loaded?.lesson !== lessonId
  return {
    notes,
    byProblem: groupNotesByProblem(notes),
    isLoading,
  }
}
