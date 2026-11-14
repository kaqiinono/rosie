'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@rosie/core'
import { getMathImagePublicUrl } from '@rosie/math-kit/hooks/useMathProblemImages'
import { migrateProblemIdForAudit } from '../admin/legacy-migration-map'
import { QUIZ_ALL_ENTRIES_MAP } from '../utils/quiz-lesson-meta'
import type { QuizPaper } from './useMathQuiz'

type Papers = QuizPaper | QuizPaper[]
type Snapshot = { papers: Papers; urls: Map<string, string>; failed: boolean }

export function useQuizAnswerImages(papers: Papers | null, enabled: boolean) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled || !papers || (Array.isArray(papers) && !papers.length)) return
    const controller = new AbortController()
    async function load(selected: Papers) {
      const urls = new Map<string, string>()
      const ids = new Set<string>()
      for (const paper of Array.isArray(selected) ? selected : [selected]) {
        for (const { problemId } of paper.problems) {
          const entry = QUIZ_ALL_ENTRIES_MAP.get(problemId)
            ?? QUIZ_ALL_ENTRIES_MAP.get(migrateProblemIdForAudit(problemId) ?? '')
          if (!entry) continue
          ids.add(entry.problem.id)
          if (entry.problem.analysisImg) urls.set(entry.problem.id, entry.problem.analysisImg)
        }
      }
      const uniqueIds = [...ids]
      try {
        for (let start = 0; start < uniqueIds.length; start += 80) {
          const { data, error } = await supabase.from('math_problem_images')
            .select('problem_id, storage_path').eq('image_kind', 'analysis')
            .in('problem_id', uniqueIds.slice(start, start + 80)).abortSignal(controller.signal)
          if (error) throw error
          for (const row of data ?? []) urls.set(row.problem_id, getMathImagePublicUrl(row.storage_path))
        }
        await Promise.all([...new Set(urls.values())].map(async (src) => {
          const image = new Image()
          image.src = src
          await image.decode()
        }))
        if (!controller.signal.aborted) setSnapshot({ papers: selected, urls, failed: false })
      } catch {
        if (!controller.signal.aborted) setSnapshot({ papers: selected, urls, failed: true })
      }
    }
    void load(papers)
    return () => controller.abort()
  }, [papers, enabled, attempt])

  const current = enabled && snapshot?.papers === papers ? snapshot : null
  return {
    urls: current?.urls,
    pending: enabled && !current,
    failed: current?.failed ?? false,
    retry: () => { setSnapshot(null); setAttempt((value) => value + 1) },
  }
}
