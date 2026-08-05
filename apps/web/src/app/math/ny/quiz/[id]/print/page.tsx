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
import type { ScratchObject } from '@rosie/math-kit/components/shared/ScratchPad/scratch-pad-types'
import { fetchQuizScratchObjectsMap } from '@rosie/math-kit/utils/math-scratch-db'

export default function QuizPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useAuth()
  const searchParams = useSearchParams()

  const [paper, setPaper] = useState<QuizPaper | null>(null)
  const [scratchByProblem, setScratchByProblem] = useState<Map<string, ScratchObject[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [userPrintMode, setUserPrintMode] = useState<{ paperId: string; mode: QuizPrintMode } | null>(
    null,
  )

  useEffect(() => {
    if (!user) return
    void supabase
      .from('math_quiz_papers')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
      .then(async ({ data }) => {
        if (data) {
          const p: QuizPaper = {
            id: data.id as string,
            title: data.title as string,
            problems: data.problems as QuizPaper['problems'],
            score: data.score as number | null,
            totalScore: data.total_score as number,
            answers: data.answers as QuizPaper['answers'],
            completedAt: data.completed_at as string | null,
            createdAt: data.created_at as string,
            batchId: (data.batch_id as string | null) ?? null,
            batchIndex: (data.batch_index as number | null) ?? null,
          }
          setPaper(p)
          if (p.completedAt) {
            const scratchMap = await fetchQuizScratchObjectsMap(p.id)
            setScratchByProblem(scratchMap)
          }
        }
        setLoading(false)
      })
  }, [user, id])

  const autoPrintMode = useMemo((): QuizPrintMode => {
    if (!paper) return 'blank'
    if (searchParams.get('mode') === 'blank') return 'blank'
    if (paper.completedAt || searchParams.get('mode') === 'complete') return 'complete'
    return 'blank'
  }, [paper, searchParams])

  const printMode =
    userPrintMode && userPrintMode.paperId === paper?.id ? userPrintMode.mode : autoPrintMode

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-200 border-t-indigo-500" />
          <span className="text-sm text-slate-400">加载中…</span>
        </div>
      </div>
    )
  }

  if (!paper) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-slate-500">找不到该试卷</p>
        <Link href="/math/ny/quiz" className="text-sm text-indigo-500 no-underline hover:underline">
          ← 返回组卷
        </Link>
      </div>
    )
  }

  const submitted = Boolean(paper.completedAt)

  return (
    <div className="print-root min-h-screen bg-slate-100">
      <div className="no-print sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[800px] items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <Link
            href={`/math/ny/quiz/${id}`}
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
            打印预览 · {paper.title}
          </h1>
          <div className="flex-1 sm:hidden" />
          <div className="flex items-center gap-1 rounded-full bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setUserPrintMode({ paperId: paper.id, mode: 'blank' })}
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
              onClick={() => setUserPrintMode({ paperId: paper.id, mode: 'complete' })}
              disabled={!submitted}
              title={submitted ? '含作答、草稿与题解' : '交卷后可打印完整答卷'}
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
            🖨 <span className="hidden sm:inline">打印</span>
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[800px] px-4 py-6 print:max-w-none print:p-0">
        <QuizPaperPrintSheet
          paper={paper}
          printMode={printMode}
          scratchByProblem={scratchByProblem}
        />
      </div>

      <style>{QUIZ_PRINT_STYLE}</style>
    </div>
  )
}
