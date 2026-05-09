'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { PROBLEMS as P34 } from '@/utils/lesson34-data'
import { PROBLEMS as P35 } from '@/utils/lesson35-data'
import { PROBLEMS as P36 } from '@/utils/lesson36-data'
import { PROBLEMS as P37 } from '@/utils/lesson37-data'
import { PROBLEMS as P38 } from '@/utils/lesson38-data'
import { PROBLEMS as P39 } from '@/utils/lesson39-data'
import { PROBLEMS as P40 } from '@/utils/lesson40-data'
import { PROBLEMS as P41 } from '@/utils/lesson41-data'
import type { Problem, ProblemSet } from '@/utils/type'
import { computeQuizPoints, type QuizPaper } from '@/hooks/useMathQuiz'

// ── Problem lookup ─────────────────────────────────────────────────────────────

const LESSON_DATA: Record<string, ProblemSet> = {
  '34': P34, '35': P35, '36': P36, '37': P37, '38': P38, '39': P39, '40': P40, '41': P41,
}

type SectionKey = 'pretest' | 'lesson' | 'homework' | 'workbook' | 'supplement'
const ALL_SECTIONS: SectionKey[] = ['lesson', 'homework', 'workbook', 'supplement', 'pretest']

const PROBLEM_MAP = (() => {
  const map = new Map<string, { problem: Problem; lessonId: string; section: SectionKey }>()
  for (const [lessonId, data] of Object.entries(LESSON_DATA)) {
    for (const section of ALL_SECTIONS) {
      const problems = data[section]
      if (!problems) continue
      for (const p of problems) map.set(p.id, { problem: p, lessonId, section })
    }
  }
  return map
})()

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QuizPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useAuth()

  const [paper, setPaper] = useState<QuizPaper | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    void supabase
      .from('math_quiz_papers')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setPaper({
            id: data.id as string,
            title: data.title as string,
            problems: data.problems as QuizPaper['problems'],
            score: data.score as number | null,
            totalScore: data.total_score as number,
            answers: data.answers as QuizPaper['answers'],
            completedAt: data.completed_at as string | null,
            createdAt: data.created_at as string,
          })
        }
        setLoading(false)
      })
  }, [user, id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-3 border-indigo-200 border-t-indigo-500 animate-spin" />
          <span className="text-sm text-slate-400">加载中…</span>
        </div>
      </div>
    )
  }

  if (!paper) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-slate-500">找不到该试卷</p>
        <Link href="/math/ny/quiz" className="text-indigo-500 text-sm no-underline hover:underline">← 返回组卷</Link>
      </div>
    )
  }

  const pointsArr = computeQuizPoints(paper.problems.length)
  const totalScore = pointsArr.reduce((s, p) => s + p, 0)

  return (
    <div className="print-root min-h-screen bg-slate-100">
      {/* ── Screen-only toolbar ─────────────────────────────────────────── */}
      <div className="no-print sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-slate-100">
        <div className="mx-auto max-w-[800px] px-4 h-14 flex items-center justify-between gap-3">
          <Link
            href={`/math/ny/quiz/${id}`}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors no-underline"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            返回
          </Link>
          <h1 className="text-sm font-bold text-slate-800 flex-1 min-w-0 truncate text-center">
            打印预览 · {paper.title}
          </h1>
          <button
            onClick={() => window.print()}
            className="rounded-full bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 transition-colors"
          >
            🖨 打印
          </button>
        </div>
      </div>

      {/* ── Print sheet ─────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-[800px] py-6 px-4 print:p-0 print:max-w-none">
        <div className="print-sheet bg-white p-10 print:p-0 shadow-sm print:shadow-none">
          {/* Header */}
          <div className="mb-6 pb-4 border-b-2 border-slate-800">
            <h1 className="text-2xl font-black text-slate-900 text-center mb-3">
              {paper.title}
            </h1>
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>姓名：___________________</span>
              <span>班级：___________________</span>
              <span>日期：{formatDate(paper.createdAt)}</span>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              共 {paper.problems.length} 题 · 满分 {totalScore} 分
            </p>
          </div>

          {/* Problems */}
          <ol className="list-none p-0 m-0">
            {paper.problems.map((item, i) => {
              const entry = PROBLEM_MAP.get(item.problemId)
              if (!entry) return null
              const { problem } = entry
              const pts = pointsArr[i] ?? 0
              return (
                <li key={item.problemId} className="problem-item">
                  <div
                    className="problem-text text-[15px] text-slate-900"
                    dangerouslySetInnerHTML={{
                      __html: `<span class="q-num">${i + 1}.</span><span class="q-pts">（${pts}分）</span> ${problem.text}`,
                    }}
                  />
                  {problem.figureNode && (
                    <div className="problem-figure mt-2">{problem.figureNode}</div>
                  )}
                  <div className="solution-space" aria-hidden="true" />
                </li>
              )
            })}
          </ol>
        </div>
      </div>

      <style>{`
        .print-sheet { color: #0f172a; }
        .problem-item {
          page-break-inside: avoid;
          break-inside: avoid;
          margin-bottom: 1rem;
        }
        .problem-text {
          line-height: 1.8;
        }
        .problem-text .q-num {
          font-weight: 700;
          margin-right: 0.15rem;
        }
        .problem-text .q-pts {
          font-size: 0.8em;
          color: #64748b;
          margin-right: 0.25rem;
        }
        .problem-text p {
          display: inline;
          margin: 0;
        }
        .problem-figure {
          display: flex;
          justify-content: center;
        }
        .solution-space {
          height: 9em;
        }

        @media print {
          @page {
            size: A4;
            margin: 14mm 12mm;
          }
          html, body {
            background: #ffffff !important;
          }
          .no-print { display: none !important; }
          .print-root {
            background: #ffffff !important;
            min-height: 0 !important;
          }
          .print-sheet {
            box-shadow: none !important;
            padding: 0 !important;
          }
          .solution-space {
            height: 8em;
          }
        }
      `}</style>
    </div>
  )
}
