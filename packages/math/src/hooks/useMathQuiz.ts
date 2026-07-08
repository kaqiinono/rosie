'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import type { QuizBatchConfig } from '@rosie/math/utils/quiz-allocate'
import { quizBatchVolumeTitle } from '@rosie/math/utils/quiz-allocate'

export type QuizProblemItem = {
  lessonId: string
  section: string
  problemId: string
  sections: string[]
  types: string[]
}

export type QuizAnswerRecord = {
  userAnswer: number | null
  correct: boolean | null
  /** Draft-only: serialized interactive grid state */
  interactiveState?: unknown
}

export type QuizPaper = {
  id: string
  title: string
  problems: QuizProblemItem[]
  score: number | null
  totalScore: number
  answers: Record<string, QuizAnswerRecord> | null
  completedAt: string | null
  createdAt: string
  batchId: string | null
  batchIndex: number | null
}

export type QuizBatch = {
  id: string
  titleBase: string
  config: QuizBatchConfig
  volumeCount: number
  createdAt: string
}

export type QuizVolumeInsert = {
  batchIndex: number
  title: string
  problems: QuizProblemItem[]
}

export type QuizPaperAppendUpdate = {
  paperId: string
  problems: QuizProblemItem[]
}

/**
 * Distribute 100 points across `n` problems. Base points = floor(100/n);
 * the remainder is added to the last `extra` problems so the total is
 * always exactly 100.
 */
export function computeQuizPoints(n: number): number[] {
  if (n <= 0) return []
  const base = Math.floor(100 / n)
  const extra = 100 - base * n
  return Array.from({ length: n }, (_, i) => (i >= n - extra ? base + 1 : base))
}

function rowToPaper(row: Record<string, unknown>): QuizPaper {
  return {
    id: row.id as string,
    title: row.title as string,
    problems: row.problems as QuizProblemItem[],
    score: row.score as number | null,
    totalScore: row.total_score as number,
    answers: row.answers as Record<string, QuizAnswerRecord> | null,
    completedAt: row.completed_at as string | null,
    createdAt: row.created_at as string,
    batchId: (row.batch_id as string | null) ?? null,
    batchIndex: (row.batch_index as number | null) ?? null,
  }
}

function rowToBatch(row: Record<string, unknown>): QuizBatch {
  return {
    id: row.id as string,
    titleBase: row.title_base as string,
    config: row.config as QuizBatchConfig,
    volumeCount: row.volume_count as number,
    createdAt: row.created_at as string,
  }
}

export function useMathQuiz(user: User | null) {
  const [papers, setPapers] = useState<QuizPaper[]>([])
  const [batches, setBatches] = useState<QuizBatch[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    void (async () => {
      setLoading(true)
      const [papersRes, batchesRes] = await Promise.all([
        supabase
          .from('math_quiz_papers')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('math_quiz_batches')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ])
      if (papersRes.data) {
        setPapers(papersRes.data.map((r) => rowToPaper(r as Record<string, unknown>)))
      }
      if (batchesRes.data) {
        setBatches(batchesRes.data.map((r) => rowToBatch(r as Record<string, unknown>)))
      }
      setLoading(false)
    })()
  }, [user])

  const savePaper = useCallback(async (
    problems: QuizProblemItem[],
    title: string,
  ): Promise<string | null> => {
    if (!user) return null
    const totalScore = problems.length > 0 ? 100 : 0
    const { data, error } = await supabase
      .from('math_quiz_papers')
      .insert({
        user_id: user.id,
        title,
        problems,
        total_score: totalScore,
      })
      .select('*')
      .single()
    if (error || !data) return null
    const paper = rowToPaper(data as Record<string, unknown>)
    setPapers(prev => [paper, ...prev])
    return paper.id
  }, [user])

  const createBatch = useCallback(async (
    titleBase: string,
    volumes: QuizVolumeInsert[],
    config: QuizBatchConfig,
  ): Promise<string | null> => {
    if (!user || volumes.length === 0) return null

    const { data: batchRow, error: batchError } = await supabase
      .from('math_quiz_batches')
      .insert({
        user_id: user.id,
        title_base: titleBase,
        config,
        volume_count: Math.max(...volumes.map((v) => v.batchIndex), 0),
      })
      .select('*')
      .single()

    if (batchError || !batchRow) return null
    const batch = rowToBatch(batchRow as Record<string, unknown>)

    const paperRows = volumes.map((vol) => ({
      user_id: user.id,
      title: vol.title,
      problems: vol.problems,
      total_score: vol.problems.length > 0 ? 100 : 0,
      batch_id: batch.id,
      batch_index: vol.batchIndex,
    }))

    const { data: insertedPapers, error: papersError } = await supabase
      .from('math_quiz_papers')
      .insert(paperRows)
      .select('*')

    if (papersError || !insertedPapers) {
      await supabase.from('math_quiz_batches').delete().eq('id', batch.id)
      return null
    }

    const newPapers = insertedPapers.map((r) => rowToPaper(r as Record<string, unknown>))
    setBatches((prev) => [batch, ...prev])
    setPapers((prev) => [...newPapers, ...prev])
    return batch.id
  }, [user])

  const appendToBatch = useCallback(async (
    batchId: string,
    titleBase: string,
    updates: QuizPaperAppendUpdate[],
    newVolumes: QuizVolumeInsert[],
    config: QuizBatchConfig,
  ): Promise<boolean> => {
    if (!user) return false

    for (const update of updates) {
      const { error } = await supabase
        .from('math_quiz_papers')
        .update({
          problems: update.problems,
          total_score: update.problems.length > 0 ? 100 : 0,
        })
        .eq('id', update.paperId)
        .eq('user_id', user.id)
        .is('completed_at', null)
      if (error) return false
    }

    if (newVolumes.length > 0) {
      const paperRows = newVolumes.map((vol) => ({
        user_id: user.id,
        title: vol.title,
        problems: vol.problems,
        total_score: vol.problems.length > 0 ? 100 : 0,
        batch_id: batchId,
        batch_index: vol.batchIndex,
      }))
      const { error } = await supabase.from('math_quiz_papers').insert(paperRows)
      if (error) return false
    }

    const { data: refreshedPapers, error: refreshError } = await supabase
      .from('math_quiz_papers')
      .select('*')
      .eq('batch_id', batchId)
      .eq('user_id', user.id)
      .order('batch_index', { ascending: true })

    if (refreshError || !refreshedPapers) return false

    const maxIndex = Math.max(...refreshedPapers.map((r) => r.batch_index ?? 0), 0)

    const { data: batchRow, error: batchError } = await supabase
      .from('math_quiz_batches')
      .update({
        config,
        volume_count: maxIndex,
        title_base: titleBase,
      })
      .eq('id', batchId)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (batchError || !batchRow) return false

    const batch = rowToBatch(batchRow as Record<string, unknown>)
    setBatches((prev) => prev.map((b) => (b.id === batchId ? batch : b)))
    const batchPaperIds = new Set(refreshedPapers.map((r) => r.id))
    const refreshed = refreshedPapers.map((r) => rowToPaper(r as Record<string, unknown>))
    setPapers((prev) => {
      const rest = prev.filter((p) => !batchPaperIds.has(p.id))
      return [...refreshed, ...rest]
    })
    return true
  }, [user])

  const savePaperProgress = useCallback(async (
    id: string,
    answers: Record<string, QuizAnswerRecord>,
  ): Promise<boolean> => {
    if (!user) return false
    const { error } = await supabase
      .from('math_quiz_papers')
      .update({ answers })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return false
    setPapers(prev =>
      prev.map(p => p.id === id ? { ...p, answers } : p),
    )
    return true
  }, [user])

  const saveDraftPaper = useCallback(async (
    id: string,
    answers: Record<string, QuizAnswerRecord>,
  ): Promise<boolean> => {
    if (!user) return false
    const { error } = await supabase
      .from('math_quiz_papers')
      .update({ answers })
      .eq('id', id)
      .eq('user_id', user.id)
      .is('completed_at', null)
    if (error) return false
    setPapers(prev =>
      prev.map(p => p.id === id ? { ...p, answers } : p),
    )
    return true
  }, [user])

  const completePaper = useCallback(async (
    id: string,
    score: number,
    answers: Record<string, QuizAnswerRecord>,
  ) => {
    if (!user) return
    const completedAt = new Date().toISOString()
    await supabase
      .from('math_quiz_papers')
      .update({ score, answers, completed_at: completedAt })
      .eq('id', id)
      .eq('user_id', user.id)
    setPapers(prev =>
      prev.map(p => p.id === id ? { ...p, score, answers, completedAt } : p),
    )
  }, [user])

  const renamePaper = useCallback(async (id: string, title: string) => {
    if (!user) return
    const trimmed = title.trim()
    if (!trimmed) return
    await supabase
      .from('math_quiz_papers')
      .update({ title: trimmed })
      .eq('id', id)
      .eq('user_id', user.id)
    setPapers(prev => prev.map(p => p.id === id ? { ...p, title: trimmed } : p))
  }, [user])

  const deletePaper = useCallback(async (id: string) => {
    if (!user) return
    const paper = papers.find((p) => p.id === id)
    await supabase
      .from('math_quiz_papers')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    setPapers(prev => prev.filter(p => p.id !== id))

    if (paper?.batchId) {
      const remaining = papers.filter((p) => p.batchId === paper.batchId && p.id !== id)
      if (remaining.length === 0) {
        await supabase.from('math_quiz_batches').delete().eq('id', paper.batchId)
        setBatches((prev) => prev.filter((b) => b.id !== paper.batchId))
      } else {
        const maxIndex = remaining.reduce((max, p) => Math.max(max, p.batchIndex ?? 0), 0)
        await supabase
          .from('math_quiz_batches')
          .update({ volume_count: maxIndex })
          .eq('id', paper.batchId)
        setBatches((prev) =>
          prev.map((b) => (b.id === paper.batchId ? { ...b, volumeCount: maxIndex } : b)),
        )
      }
    }
  }, [user, papers])

  const renameBatch = useCallback(async (batchId: string, titleBase: string) => {
    if (!user) return false
    const trimmed = titleBase.trim()
    if (!trimmed) return false

    const batchPapers = papers
      .filter((p) => p.batchId === batchId)
      .sort((a, b) => (a.batchIndex ?? 0) - (b.batchIndex ?? 0))
    const total = Math.max(
      ...batchPapers.map((p) => p.batchIndex ?? 0),
      batches.find((b) => b.id === batchId)?.volumeCount ?? 0,
      1,
    )

    const { error: batchError } = await supabase
      .from('math_quiz_batches')
      .update({ title_base: trimmed })
      .eq('id', batchId)
      .eq('user_id', user.id)
    if (batchError) return false

    for (const paper of batchPapers) {
      const index = paper.batchIndex ?? 1
      const title = quizBatchVolumeTitle(trimmed, index, total)
      const { error } = await supabase
        .from('math_quiz_papers')
        .update({ title })
        .eq('id', paper.id)
        .eq('user_id', user.id)
      if (error) return false
    }

    setBatches((prev) =>
      prev.map((b) => (b.id === batchId ? { ...b, titleBase: trimmed } : b)),
    )
    setPapers((prev) =>
      prev.map((p) => {
        if (p.batchId !== batchId) return p
        const index = p.batchIndex ?? 1
        return {
          ...p,
          title: quizBatchVolumeTitle(trimmed, index, total),
        }
      }),
    )
    return true
  }, [user, papers, batches])

  const deleteBatch = useCallback(async (batchId: string) => {
    if (!user) return false
    const { error: papersError } = await supabase
      .from('math_quiz_papers')
      .delete()
      .eq('batch_id', batchId)
      .eq('user_id', user.id)
    if (papersError) return false

    const { error: batchError } = await supabase
      .from('math_quiz_batches')
      .delete()
      .eq('id', batchId)
      .eq('user_id', user.id)
    if (batchError) return false

    setPapers((prev) => prev.filter((p) => p.batchId !== batchId))
    setBatches((prev) => prev.filter((b) => b.id !== batchId))
    return true
  }, [user])

  return {
    papers,
    batches,
    loading,
    savePaper,
    createBatch,
    appendToBatch,
    saveDraftPaper,
    savePaperProgress,
    completePaper,
    deletePaper,
    renamePaper,
    renameBatch,
    deleteBatch,
  }
}
