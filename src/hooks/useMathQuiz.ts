'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

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
  }
}

export function useMathQuiz(user: User | null) {
  const [papers, setPapers] = useState<QuizPaper[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    void (async () => {
      setLoading(true)
      const { data } = await supabase
        .from('math_quiz_papers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (data) setPapers(data.map(r => rowToPaper(r as Record<string, unknown>)))
      setLoading(false)
    })()
  }, [user])

  const savePaper = useCallback(async (
    problems: QuizProblemItem[],
    title: string,
  ): Promise<string | null> => {
    if (!user) return null
    const totalScore = problems.length * Math.floor(100 / problems.length)
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

  const deletePaper = useCallback(async (id: string) => {
    if (!user) return
    await supabase
      .from('math_quiz_papers')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    setPapers(prev => prev.filter(p => p.id !== id))
  }, [user])

  return { papers, loading, savePaper, completePaper, deletePaper }
}
