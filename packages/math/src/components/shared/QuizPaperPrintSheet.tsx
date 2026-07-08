'use client'

import QuizProblemSolution from '@rosie/math/components/shared/QuizProblemSolution'
import QuizProblemPrintWidget from '@rosie/math/components/shared/QuizProblemPrintWidget'
import ScratchPadPrintBlock from '@rosie/math/components/shared/ScratchPad/ScratchPadPrintBlock'
import { isInteractiveProblem } from '@rosie/math/utils/check-problem-answer'
import { getProblemAnswerMode } from '@rosie/math/utils/problem-answer-mode'
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

export type QuizPrintMode = 'blank' | 'complete'

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
    return record.interactiveState != null ? '' : '（未作答）'
  }
  if (record.userAnswer == null) return '（未作答）'
  return `${record.userAnswer}${problem.finalUnit ?? ''}`
}

function formatCorrectAnswer(problem: Problem): string | null {
  const mode = getProblemAnswerMode(problem)
  if (mode === 'custom-widget') return null
  return `${problem.finalAns}${problem.finalUnit ?? ''}`
}

function hasCustomPrintWidget(problem: Problem): boolean {
  const mode = getProblemAnswerMode(problem)
  return mode === 'custom-widget' || mode === 'readonly-puzzle-numeric'
}

export function QuizPaperPrintSheet({
  paper,
  printMode,
  scratchByProblem,
  pageBreakAfter,
}: {
  paper: QuizPaper
  printMode: QuizPrintMode
  scratchByProblem?: Map<string, ScratchObject[]>
  pageBreakAfter?: boolean
}) {
  const pointsArr = computeQuizPoints(paper.problems.length)
  const totalScore = pointsArr.reduce((s, p) => s + p, 0)
  const submitted = Boolean(paper.completedAt)
  const isComplete = printMode === 'complete' && submitted

  return (
    <div
      className={`print-sheet bg-white p-10 shadow-sm print:p-0 print:shadow-none ${
        pageBreakAfter ? 'print-volume-break' : ''
      }`}
    >
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

      <ol className="m-0 list-none p-0">
        {paper.problems.map((item, i) => {
          const entry = PROBLEM_MAP.get(item.problemId)
          if (!entry) return null
          const { problem } = entry
          const answerMode = getProblemAnswerMode(problem)
          const pts = pointsArr[i] ?? 0
          const record = paper.answers?.[item.problemId]
          const scratchObjects = scratchByProblem?.get(item.problemId) ?? []
          const userAnswer = formatUserAnswer(problem, record)
          const correctAnswer = formatCorrectAnswer(problem)
          const showWrong = isComplete && record?.correct === false && correctAnswer
          const customWidget = hasCustomPrintWidget(problem)
          const interactiveState = record?.interactiveState

          return (
            <li key={`${paper.id}-${item.problemId}-${i}`} className="problem-item">
              <div
                className="problem-text text-[15px] text-slate-900"
                dangerouslySetInnerHTML={{
                  __html: `<span class="q-num">${i + 1}.</span><span class="q-pts">（${pts}分）</span> ${problem.text}`,
                }}
              />
              <QuizProblemPrintWidget
                problem={problem}
                interactiveState={isComplete ? interactiveState : undefined}
              />

              {isComplete ? (
                <>
                  {(userAnswer || record?.correct != null) && (
                    <div className="answer-block mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        {userAnswer && (
                          <>
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
                            </span>
                          </>
                        )}
                        {record?.correct === true && (
                          <span className="font-bold text-emerald-700">✓</span>
                        )}
                        {record?.correct === false && (
                          <span className="font-bold text-rose-600">✗</span>
                        )}
                        {showWrong && (
                          <span className="text-slate-500">正确答案：{correctAnswer}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {scratchObjects.length > 0 && (
                    <div className="scratch-print mt-3">
                      <p className="mb-1 text-[11px] font-semibold text-slate-500">作答草稿</p>
                      <ScratchPadPrintBlock objects={scratchObjects} />
                    </div>
                  )}

                  <QuizProblemSolution problem={problem} className="print-solution mt-3" />
                </>
              ) : (
                <>
                  {answerMode === 'readonly-puzzle-numeric' && problem.finalQ && (
                    <p className="mt-3 text-sm text-slate-700">
                      {problem.finalQ}：________________
                      {problem.finalUnit ? ` ${problem.finalUnit}` : ''}
                    </p>
                  )}
                  {!customWidget && <div className="solution-space" aria-hidden="true" />}
                </>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export const QUIZ_PRINT_STYLE = `
  .print-sheet { color: #0f172a; }
  .print-volume-break {
    page-break-after: always;
    break-after: page;
  }
  .problem-item {
    page-break-inside: avoid;
    break-inside: avoid;
    margin-bottom: 1rem;
  }
  .problem-text { line-height: 1.8; }
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
  .quiz-print-raster {
    max-height: 420px;
    object-fit: contain;
  }
  .solution-space { height: 9em; }
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
    .solution-space { height: 8em; }
    .print-scratch-img { max-height: none; }
    .quiz-print-raster { max-height: none; }
  }
`
