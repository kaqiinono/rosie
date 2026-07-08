'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth, supabase } from '@rosie/core'
import {
  QuizPaperPrintSheet,
  QUIZ_PRINT_STYLE,
  type QuizPrintMode,
} from '@rosie/math/components/shared/QuizPaperPrintSheet'
import type { QuizPaper } from '@rosie/math/hooks/useMathQuiz'
import type { ScratchObject } from '@rosie/math/components/shared/ScratchPad/scratch-pad-types'
import { fetchQuizScratchObjectsMap } from '@rosie/math/utils/math-scratch-db'

function rowToPaper(row: Record<string, unknown>): QuizPaper {
  return {
    id: row.id as string,
    title: row.title as string,
    problems: row.problems as QuizPaper['problems'],
    score: row.score as number | null,
    totalScore: row.total_score as number,
    answers: row.answers as QuizPaper['answers'],
    completedAt: row.completed_at as string | null,
    createdAt: row.created_at as string,
    batchId: (row.batch_id as string | null) ?? null,
    batchIndex: (row.batch_index as number | null) ?? null,
  }
}

export default function QuizBatchPrintPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = use(params)
  const { user } = useAuth()
  const searchParams = useSearchParams()

  const [titleBase, setTitleBase] = useState('')
  const [papers, setPapers] = useState<QuizPaper[]>([])
  const [scratchByPaper, setScratchByPaper] = useState<Map<string, Map<string, ScratchObject[]>>>(
    new Map(),
  )
  const [loading, setLoading] = useState(true)
  const [userPrintMode, setUserPrintMode] = useState<QuizPrintMode | null>(null)

  useEffect(() => {
    if (!user) return
    void (async () => {
      const [batchRes, papersRes] = await Promise.all([
        supabase
          .from('math_quiz_batches')
          .select('*')
          .eq('id', batchId)
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('math_quiz_papers')
          .select('*')
          .eq('batch_id', batchId)
          .eq('user_id', user.id)
          .order('batch_index', { ascending: true }),
      ])

      if (batchRes.data) {
        setTitleBase((batchRes.data as { title_base: string }).title_base)
      }

      const loaded = (papersRes.data ?? []).map((r) => rowToPaper(r as Record<string, unknown>))
      setPapers(loaded)

      const scratchMap = new Map<string, Map<string, ScratchObject[]>>()
      await Promise.all(
        loaded
          .filter((p) => p.completedAt)
          .map(async (p) => {
            const m = await fetchQuizScratchObjectsMap(p.id)
            scratchMap.set(p.id, m)
          }),
      )
      setScratchByPaper(scratchMap)
      setLoading(false)
    })()
  }, [user, batchId])

  const anyCompleted = papers.some((p) => p.completedAt)

  const autoPrintMode = useMemo((): QuizPrintMode => {
    if (searchParams.get('mode') === 'blank') return 'blank'
    if (searchParams.get('mode') === 'complete') return 'complete'
    return 'blank'
  }, [searchParams])

  const printMode = userPrintMode ?? autoPrintMode

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-200 border-t-indigo-500" />
          <span className="text-sm text-slate-400">加载批次中…</span>
        </div>
      </div>
    )
  }

  if (papers.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-slate-500">找不到该批次或其中没有试卷</p>
        <Link href="/math/ny/quiz" className="text-sm text-indigo-500 no-underline hover:underline">
          ← 返回组卷
        </Link>
      </div>
    )
  }

  return (
    <div className="print-root min-h-screen bg-slate-100">
      <div className="no-print sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[800px] items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <Link
            href="/math/ny/quiz"
            className="flex shrink-0 items-center gap-1 text-sm text-slate-400 no-underline transition-colors hover:text-slate-600 sm:gap-1.5"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 12L6 8l4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden sm:inline">返回</span>
          </Link>
          <h1 className="hidden min-w-0 flex-1 truncate text-center text-sm font-bold text-slate-800 sm:block">
            批次打印 · {titleBase || papers[0]?.title} · {papers.length} 卷
          </h1>
          <div className="flex-1 sm:hidden" />
          <div className="flex items-center gap-1 rounded-full bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setUserPrintMode('blank')}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                printMode === 'blank'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              空白卷
            </button>
            <button
              type="button"
              onClick={() => setUserPrintMode('complete')}
              disabled={!anyCompleted}
              title={
                anyCompleted
                  ? '已交卷的卷会附作答与题解；未交卷仍按空白卷'
                  : '本批次尚无已交试卷'
              }
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                printMode === 'complete'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              完整答卷
            </button>
          </div>
          <button
            onClick={() => window.print()}
            className="shrink-0 rounded-full bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-600 sm:px-4"
          >
            🖨 <span className="hidden sm:inline">打印全部</span>
          </button>
        </div>
      </div>

      <div className="mx-auto flex max-w-[800px] flex-col gap-6 px-4 py-6 print:max-w-none print:gap-0 print:p-0">
        {papers.map((paper, i) => (
          <QuizPaperPrintSheet
            key={paper.id}
            paper={paper}
            printMode={printMode}
            scratchByProblem={scratchByPaper.get(paper.id)}
            pageBreakAfter={i < papers.length - 1}
          />
        ))}
      </div>

      <style>{QUIZ_PRINT_STYLE}</style>
    </div>
  )
}
