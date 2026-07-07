'use client'

import {use, useEffect, useMemo, useState} from 'react'
import Link from 'next/link'
import {useSearchParams} from 'next/navigation'
import {useAuth} from '@rosie/core'
import {supabase} from '@rosie/core'
import QuizProblemSolution from '@rosie/math/components/shared/QuizProblemSolution'
import ScratchPadPrintBlock from '@rosie/math/components/shared/ScratchPad/ScratchPadPrintBlock'
import {isInteractiveProblem} from '@rosie/math/utils/check-problem-answer'
import {PROBLEMS as P12} from '@rosie/math/utils/lesson12-data'
import {PROBLEMS as P13} from '@rosie/math/utils/lesson13-data'
import {PROBLEMS as P15} from '@rosie/math/utils/lesson15-data'
import {PROBLEMS as P18} from '@rosie/math/utils/lesson18-data'
import {PROBLEMS as P23} from '@rosie/math/utils/lesson23-data'
import {PROBLEMS as P29} from '@rosie/math/utils/lesson29-data'
import {PROBLEMS as P30} from '@rosie/math/utils/lesson30-data'
import {PROBLEMS as P34} from '@rosie/math/utils/lesson34-data'
import {PROBLEMS as P35} from '@rosie/math/utils/lesson35-data'
import {PROBLEMS as P36} from '@rosie/math/utils/lesson36-data'
import {PROBLEMS as P37} from '@rosie/math/utils/lesson37-data'
import {PROBLEMS as P38} from '@rosie/math/utils/lesson38-data'
import {PROBLEMS as P39} from '@rosie/math/utils/lesson39-data'
import {PROBLEMS as P40} from '@rosie/math/utils/lesson40-data'
import {PROBLEMS as P41} from '@rosie/math/utils/lesson41-data'
import {PROBLEMS as P42} from '@rosie/math/utils/lesson42-data'
import {PROBLEMS as P43} from '@rosie/math/utils/lesson43-data'
import {PROBLEMS as P44} from '@rosie/math/utils/lesson44-data'
import {PROBLEMS as P46} from '@rosie/math/utils/lesson46-data'
import {PROBLEMS as P47} from '@rosie/math/utils/lesson47-data'
import {PROBLEMS as P49} from '@rosie/math/utils/lesson49-data'
import {PROBLEMS as P50} from '@rosie/math/utils/lesson50-data'
import {PROBLEMS as P55} from '@rosie/math/utils/lesson55-data'
import {PROBLEMS as P53} from '@rosie/math/utils/lesson53-data'
import {PROBLEMS as P52} from '@rosie/math/utils/lesson52-data'
import {PROBLEMS as P51} from '@rosie/math/utils/lesson51-data'
import type {Problem, ProblemSet} from '@rosie/core'
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
    '12': P12,
    '13': P13,
    '15': P15,
    '18': P18,
    '23': P23,
    '29': P29,
    '30': P30,
    '34': P34,
    '35': P35,
    '36': P36,
    '37': P37,
    '38': P38,
    '39': P39,
    '40': P40,
    '41': P41,
    '42': P42,
    '43': P43,
    '44': P44,
    '46': P46,
    '47': P47,
    '49': P49,
    '50': P50,
    '55': P55,
    '53': P53,
    '52': P52,
    '51': P51,
}

type SectionKey = 'pretest' | 'lesson' | 'homework' | 'workbook' | 'supplement'
const ALL_SECTIONS: SectionKey[] = ['lesson', 'homework', 'workbook', 'supplement', 'pretest']

const PROBLEM_MAP = (() => {
    const map = new Map<string, { problem: Problem; lessonId: string; section: SectionKey }>()
    for (const [lessonId, data] of Object.entries(LESSON_DATA)) {
        for (const section of ALL_SECTIONS) {
            const problems = data[section]
            if (!problems) continue
            for (const p of problems) map.set(p.id, {problem: p, lessonId, section})
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
        return record.userAnswer != null || record.interactiveState != null ? '（已作答）' : '（未作答）'
    }
    if (record.userAnswer == null) return '（未作答）'
    return `${record.userAnswer}${problem.finalUnit ?? ''}`
}

function formatCorrectAnswer(problem: Problem): string | null {
    if (isInteractiveProblem(problem)) return null
    return `${problem.finalAns}${problem.finalUnit ?? ''}`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QuizPrintPage({params}: { params: Promise<{ id: string }> }) {
    const {id} = use(params)
    const {user} = useAuth()
    const searchParams = useSearchParams()

    const [paper, setPaper] = useState<QuizPaper | null>(null)
    const [scratchByProblem, setScratchByProblem] = useState<Map<string, ScratchObject[]>>(new Map())
    const [loading, setLoading] = useState(true)
    const [userPrintMode, setUserPrintMode] = useState<{ paperId: string; mode: PrintMode } | null>(null)

    useEffect(() => {
        if (!user) return
        void supabase
            .from('math_quiz_papers')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()
            .then(async ({data}) => {
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

    const printMode =
        userPrintMode?.paperId === paper?.id ? userPrintMode?.mode : autoPrintMode

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-3 border-indigo-200 border-t-indigo-500 animate-spin"/>
                    <span className="text-sm text-slate-400">加载中…</span>
                </div>
            </div>
        )
    }

    if (!paper) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-3">
                <p className="text-slate-500">找不到该试卷</p>
                <Link href="/math/ny/quiz" className="text-indigo-500 text-sm no-underline hover:underline">←
                    返回组卷</Link>
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
            <div className="no-print sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-slate-100">
                <div className="mx-auto max-w-[800px] px-3 sm:px-4 h-14 flex items-center gap-2 sm:gap-3">
                    <Link
                        href={`/math/ny/quiz/${id}`}
                        className="flex items-center gap-1 sm:gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors no-underline shrink-0"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                                  strokeLinejoin="round"/>
                        </svg>
                        <span className="hidden sm:inline">返回</span>
                    </Link>
                    <h1 className="hidden sm:block text-sm font-bold text-slate-800 flex-1 min-w-0 truncate text-center">
                        打印预览 · {paper.title}
                    </h1>
                    <div className="flex-1 sm:hidden"/>
                    <div className="flex items-center gap-1 rounded-full bg-slate-100 p-0.5">
                        <button
                            type="button"
                            onClick={() => paper && setUserPrintMode({paperId: paper.id, mode: 'blank'})}
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
                            onClick={() => paper && setUserPrintMode({paperId: paper.id, mode: 'complete'})}
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
                        className="shrink-0 rounded-full bg-indigo-500 px-3 sm:px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 transition-colors"
                    >
                        🖨 <span className="hidden sm:inline">打印</span>
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
                            {isComplete && paper.score != null && (
                                <span className="ml-3 font-semibold text-emerald-700">
                                    得分 {paper.score}/{paper.totalScore}
                                </span>
                            )}
                        </p>
                    </div>

                    {/* Problems */}
                    <ol className="list-none p-0 m-0">
                        {paper.problems.map((item, i) => {
                            const entry = PROBLEM_MAP.get(item.problemId)
                            if (!entry) return null
                            const {problem} = entry
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
                                                        <span className="text-slate-500">
                                                            正确答案：{correctAnswer}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {scratchObjects.length > 0 && (
                                                <div className="scratch-print mt-3">
                                                    <p className="mb-1 text-[11px] font-semibold text-slate-500">
                                                        作答草稿
                                                    </p>
                                                    <ScratchPadPrintBlock objects={scratchObjects}/>
                                                </div>
                                            )}

                                            <QuizProblemSolution
                                                problem={problem}
                                                className="print-solution mt-3"
                                            />
                                        </>
                                    ) : (
                                        <div className="solution-space" aria-hidden="true"/>
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
