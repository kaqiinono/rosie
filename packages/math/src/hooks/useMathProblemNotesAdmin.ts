'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  createMathProblemNote,
  deleteMathProblemNote,
  loadLessonNotes,
  notesForProblem,
  noteCountByProblem,
  updateMathProblemNote,
  type MathProblemNote,
} from '@rosie/math/hooks/useMathProblemNotes'

export function useMathProblemNotesAdmin(user: User | null, lessonId: string | null) {
  const [notes, setNotes] = useState<MathProblemNote[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const reload = useCallback(async () => {
    if (!lessonId) {
      setNotes([])
      return
    }
    setIsLoading(true)
    const rows = await loadLessonNotes(lessonId)
    setNotes(rows)
    setIsLoading(false)
  }, [lessonId])

  useEffect(() => {
    void reload()
  }, [reload])

  const counts = noteCountByProblem(notes)

  const getNotes = useCallback(
    (problemId: string) => notesForProblem(notes, problemId),
    [notes],
  )

  const addNote = useCallback(
    async (
      problemId: string,
      input: { title?: string | null; bodyHtml: string },
    ): Promise<{ error: string | null }> => {
      if (!user || !lessonId) return { error: '请先登录并选择讲次' }
      setIsSaving(true)
      const existing = notesForProblem(notes, problemId)
      const sortOrder = existing.length > 0 ? Math.max(...existing.map((n) => n.sortOrder)) + 1 : 0
      const { error, note } = await createMathProblemNote(user.id, lessonId, problemId, {
        ...input,
        sortOrder,
      })
      setIsSaving(false)
      if (error || !note) return { error: error ?? '保存失败' }
      setNotes((prev) => [...prev, note])
      return { error: null }
    },
    [user, lessonId, notes],
  )

  const saveNote = useCallback(
    async (
      note: MathProblemNote,
      patch: { title?: string | null; bodyHtml?: string },
    ): Promise<{ error: string | null }> => {
      setIsSaving(true)
      const { error, note: updated } = await updateMathProblemNote(note, patch)
      setIsSaving(false)
      if (error || !updated) return { error: error ?? '更新失败' }
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
      return { error: null }
    },
    [],
  )

  const removeNote = useCallback(async (note: MathProblemNote): Promise<{ error: string | null }> => {
    setIsSaving(true)
    const { error } = await deleteMathProblemNote(note)
    setIsSaving(false)
    if (error) return { error }
    setNotes((prev) => prev.filter((n) => n.id !== note.id))
    return { error: null }
  }, [])

  const moveNote = useCallback(
    async (note: MathProblemNote, direction: 'up' | 'down'): Promise<{ error: string | null }> => {
      const siblings = notesForProblem(notes, note.problemId)
      const idx = siblings.findIndex((n) => n.id === note.id)
      if (idx < 0) return { error: null }
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= siblings.length) return { error: null }

      const other = siblings[swapIdx]
      setIsSaving(true)
      const [r1, r2] = await Promise.all([
        updateMathProblemNote(note, { sortOrder: other.sortOrder }),
        updateMathProblemNote(other, { sortOrder: note.sortOrder }),
      ])
      setIsSaving(false)
      if (r1.error || r2.error) return { error: r1.error ?? r2.error ?? '排序失败' }
      if (r1.note && r2.note) {
        setNotes((prev) =>
          prev.map((n) => {
            if (n.id === r1.note!.id) return r1.note!
            if (n.id === r2.note!.id) return r2.note!
            return n
          }),
        )
      }
      return { error: null }
    },
    [notes],
  )

  return {
    notes,
    counts,
    isLoading,
    isSaving,
    reload,
    getNotes,
    addNote,
    saveNote,
    removeNote,
    moveNote,
  }
}
