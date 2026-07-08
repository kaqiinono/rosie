'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@rosie/core'
import { supabase } from '@rosie/core'
import QuizProblemSolution from '@rosie/math/components/shared/QuizProblemSolution'
import ScratchPadPrintBlock from '@rosie/math/components/shared/ScratchPad/ScratchPadPrintBlock'
import { isInteractiveProblem } from '@rosie/math/utils/check-problem-answer'
import { PROBLEMS as G1Lesson12PROBLEMS } from '@rosie/math/utils/g1/lesson12-data'
import { PROBLEMS as G1Lesson13PROBLEMS } from '@rosie/math/utils/g1/lesson13-data'
import { PROBLEMS as G1Lesson15PROBLEMS } from '@rosie/math/utils/g1/lesson15-data'
import { PROBLEMS as G1Lesson18PROBLEMS } from '@rosie/math/utils/g1/lesson18-data'
import { PROBLEMS as G1Lesson23PROBLEMS } from '@rosie/math/utils/g1/lesson23-data'
import { PROBLEMS as G1Lesson29PROBLEMS } from '@rosie/math/utils/g1/lesson29-data'
import { PROBLEMS as G1Lesson30PROBLEMS } from '@rosie/math/utils/g1/lesson30-data'
import { PROBLEMS as G1Lesson34PROBLEMS } from '@rosie/math/utils/g1/lesson34-data'
import { PROBLEMS as G1Lesson35PROBLEMS } from '@rosie/math/utils/g1/lesson35-data'
import { PROBLEMS as G1Lesson36PROBLEMS } from '@rosie/math/utils/g1/lesson36-data'
import { PROBLEMS as G1Lesson37PROBLEMS } from '@rosie/math/utils/g1/lesson37-data'
import { PROBLEMS as G1Lesson38PROBLEMS } from '@rosie/math/utils/g1/lesson38-data'
import { PROBLEMS as G1Lesson39PROBLEMS } from '@rosie/math/utils/g1/lesson39-data'
import { PROBLEMS as G1Lesson40PROBLEMS } from '@rosie/math/utils/g1/lesson40-data'
import { PROBLEMS as G1Lesson41PROBLEMS } from '@rosie/math/utils/g1/lesson41-data'
import { PROBLEMS as G1Lesson42PROBLEMS } from '@rosie/math/utils/g1/lesson42-data'
import { PROBLEMS as G1Lesson43PROBLEMS } from '@rosie/math/utils/g1/lesson43-data'
import { PROBLEMS as G1Lesson44PROBLEMS } from '@rosie/math/utils/g1/lesson44-data'
import { PROBLEMS as G1Lesson46PROBLEMS } from '@rosie/math/utils/g1/lesson46-data'
import { PROBLEMS as G1Lesson47PROBLEMS } from '@rosie/math/utils/g1/lesson47-data'
import { PROBLEMS as G2Lesson1PROBLEMS } from '@rosie/math/utils/g2/lesson1-data'
import { PROBLEMS as G2Lesson2PROBLEMS } from '@rosie/math/utils/g2/lesson2-data'
import { PROBLEMS as G2Lesson6PROBLEMS } from '@rosie/math/utils/g2/lesson6-data'
import { PROBLEMS as G2Lesson7PROBLEMS } from '@rosie/math/utils/g2/lesson7-data'
import { PROBLEMS as G2Lesson5PROBLEMS } from '@rosie/math/utils/g2/lesson5-data'
import { PROBLEMS as G2Lesson4PROBLEMS } from '@rosie/math/utils/g2/lesson4-data'
import { PROBLEMS as G2Lesson3PROBLEMS } from '@rosie/math/utils/g2/lesson3-data'
import type { Problem, ProblemSet } from '@rosie/core'
import {
  computeQuizPoints,
  type QuizAnswerRecord,
  type QuizPaper,
} from '@rosie/math/hooks/useMathQuiz'
import type { ScratchObject } from '@rosie/math/components/shared/ScratchPad/scratch-pad-types'
import { fetchQuizScratchObjectsMap } from '@rosie/math/utils/math-scratch-db'

type PrintMode = 'blank' | 'complete'

// ── Problem lookup ─────────────────────────────────────────────────────────────

const LESSON_DATA: Record<string, ProblemSet> = {
  '1-12': G1Lesson12PROBLEMS,
  '1-13': G1Lesson13PROBLEMS,
  '1-15': G1Lesson15PROBLEMS,
  '1-18': G1Lesson18PROBLEMS,
  '1-23': G1Lesson23PROBLEMS,
  '1-29': G1Lesson29PROBLEMS,
  '1-30': G1Lesson30PROBLEMS,
  '1-34': G1Lesson34PROBLEMS,
  '1-35': G1Lesson35PROBLEMS,
  '1-36': G1Lesson36PROBLEMS,
  '1-37': G1Lesson37PROBLEMS,
  '1-38': G1Lesson38PROBLEMS,
  '1-39': G1Lesson39PROBLEMS,
  '1-40': G1Lesson40PROBLEMS,
  '1-41': G1Lesson41PROBLEMS,
  '1-42': G1Lesson42PROBLEMS,
  '1-43': G1Lesson43PROBLEMS,
  '1-44': G1Lesson44PROBLEMS,
  '1-46': G1Lesson46PROBLEMS,
  '1-47': G1Lesson47PROBLEMS,
  '2-1': G2Lesson1PROBLEMS,
  '2-2': G2Lesson2PROBLEMS,
  '2-6': G2Lesson6PROBLEMS,
  '2-7': G2Lesson7PROBLEMS,
  '2-5': G2Lesson5PROBLEMS,
  '2-4': G2Lesson4PROBLEMS,
  '2-3': G2Lesson3PROBLEMS,
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

function formatUserAnswer(problem: Problem, record: QuizAnswerRecord | undefined): string {
  if (!record) return '（未作答）'
  if (isInteractiveProblem(problem)) {
    return record.userAnswer != null || record.interactiveState != null
      ? '（已作答）'
      : '（未作答）'
  }
  if (record.userAnswer == null) return '（未作答）'
  return `${record.userAnswer}${problem.finalUnit ?? ''}`
}

function formatCorrectAnswer(problem: Problem): string | null {
  if (isInteractiveProblem(problem)) return null
  return `${problem.finalAns}${problem.finalUnit ?? ''}`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QuizPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useAuth()
  const searchParams = useSearchParams()

  const [paper, setPaper] = useState<QuizPaper | null>(null)
  const [scratchByProblem, setScratchByProblem] = useState<Map<string, ScratchObject[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [userPrintMode, setUserPrintMode] = useState<{ paperId: string; mode: PrintMode } | null>(
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

  const autoPrintMode = useMemo((): PrintMode => {
    if (!paper) return 'blank'
    if (searchParams.get('mode') === 'blank') return 'blank'
    if (paper.completedAt || searchParams.get('mode') === 'complete') return 'complete'
    return 'blank'
  }, [paper, searchParams])

  const printMode = userPrintMode?.paperId === paper?.id ? userPrintMode?.mode : autoPrintMode

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

  const pointsArr = computeQuizPoints(paper.problems.length)
  const totalScore = pointsArr.reduce((s, p) => s + p, 0)
  const submitted = Boolean(paper.completedAt)
  const isComplete = printMode === 'complete' && submitted

  return (
    <div className="print-root min-h-screen bg-slate-100">
      {/* ── Screen-only toolbar ─────────────────────────────────────────── */}
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
              onClick={() => paper && setUserPrintMode({ paperId: paper.id, mode: 'blank' })}
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
              onClick={() => paper && setUserPrintMode({ paperId: paper.id, mode: 'complete' })}
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

      {/* ── Print sheet ─────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-[800px] px-4 py-6 print:max-w-none print:p-0">
        <div className="print-sheet bg-white p-10 shadow-sm print:p-0 print:shadow-none">
          {/* Header */}
          <div className="mb-6 border-b-2 border-slate-800 pb-4">
            <h1 className="mb-3 text-center text-2xl font-black text-slate-900">{paper.title}</h1>
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>姓名：___________________</span>
              <span>班级：___________________</span>
              <span>日期：{formatDate(paper.createdAt)}</span>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              共 {paper.problems.length} 题 · 满分 {totalScore} 分
              {isComplete && paper.score != null && (
                <span className="ml-3 font-semibold text-emerald-700">
                  得分 {paper.score}/{paper.totalScore}
                </span>
              )}
            </p>
          </div>

          {/* Problems */}
          <ol className="m-0 list-none p-0">
            {paper.problems.map((item, i) => {
              const entry = PROBLEM_MAP.get(item.problemId)
              if (!entry) return null
              const { problem } = entry
              const pts = pointsArr[i] ?? 0
              const record = paper.answers?.[item.problemId]
              const scratchObjects = scratchByProblem.get(item.problemId) ?? []
              const userAnswer = formatUserAnswer(problem, record)
              const correctAnswer = formatCorrectAnswer(problem)
              const showWrong = isComplete && record?.correct === false && correctAnswer

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

                  {isComplete ? (
                    <>
                      <div className="answer-block mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="font-semibold text-slate-700">作答：</span>
                          <span
                            className={
                              record?.correct === true
                                ? 'font-bold text-emerald-700'
                                : record?.correct === false
                                  ? 'font-bold text-rose-600'
                                  : 'text-slate-800'
                            }
                          >
                            {userAnswer}
                            {record?.correct === true && ' ✓'}
                            {record?.correct === false && ' ✗'}
                          </span>
                          {showWrong && (
                            <span className="text-slate-500">正确答案：{correctAnswer}</span>
                          )}
                        </div>
                      </div>

                      {scratchObjects.length > 0 && (
                        <div className="scratch-print mt-3">
                          <p className="mb-1 text-[11px] font-semibold text-slate-500">作答草稿</p>
                          <ScratchPadPrintBlock objects={scratchObjects} />
                        </div>
                      )}

                      <QuizProblemSolution problem={problem} className="print-solution mt-3" />
                    </>
                  ) : (
                    <div className="solution-space" aria-hidden="true" />
                  )}
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
        .answer-block,
        .scratch-print,
        .print-solution {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .print-scratch-img {
          max-height: 320px;
          object-fit: contain;
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
          .print-scratch-img {
            max-height: none;
          }
        }
      `}</style>
    </div>
  )
}
