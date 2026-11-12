'use client'

import QuizProblemSolution from '@rosie/math-kit/components/shared/QuizProblemSolution'
import QuizProblemPrintWidget from '@rosie/math-kit/components/shared/QuizProblemPrintWidget'
import ScratchPadPrintBlock from '@rosie/math-kit/components/shared/ScratchPad/ScratchPadPrintBlock'
import { isInteractiveProblem } from '@rosie/math-kit/utils/check-problem-answer'
import { getProblemAnswerMode } from '@rosie/math-kit/utils/problem-answer-mode'
import { GRADE_LABEL, gradeOf, lessonDisplayLabel } from '@rosie/math-kit/utils/lesson-grade'
import { sanitizeProblemText } from '@rosie/math-kit/utils/sanitize-problem-text'
import type { Problem } from '@rosie/core'
import { QUIZ_ALL_ENTRIES_MAP } from '../../utils/quiz-lesson-meta'
import { migrateProblemIdForAudit } from '../../admin/legacy-migration-map'
import ProblemVideoReplay from '@rosie/math-kit/components/shared/ProblemVideoReplay'
import { useProblemImageUrl } from '@rosie/math-kit/hooks/useProblemImageUrl'
import ProblemFigureImage from '@rosie/math-kit/components/shared/ProblemFigureImage'
import {
  computeQuizPoints,
  type QuizAnswerRecord,
  type QuizPaper,
} from '@rosie/math/hooks/useMathQuiz'
import type { ScratchObject } from '@rosie/math-kit/components/shared/ScratchPad/scratch-pad-types'

export type QuizPrintMode = 'blank' | 'complete' | 'answers'

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
  const values = String(record.userAnswer).split('|')
  return [problem, ...(problem.additionalQuestions ?? [])]
    .map((q, i) => (values[i] ? values[i] + q.finalUnit : '（未作答）'))
    .join('、')
}

function formatCorrectAnswer(problem: Problem): string | null {
  const mode = getProblemAnswerMode(problem)
  if (mode === 'custom-widget') return null
  return [problem, ...(problem.additionalQuestions ?? [])]
    .map((q) => q.finalAns + q.finalUnit)
    .join('、')
}

function hasCustomPrintWidget(problem: Problem): boolean {
  const mode = getProblemAnswerMode(problem)
  return mode === 'custom-widget' || mode === 'readonly-puzzle-numeric'
}

function GridReferenceAnswer({ problem, savedAnswer }: {
  problem: Problem
  savedAnswer?: QuizAnswerRecord
}) {
  const analysisImage = useProblemImageUrl(problem, 'analysis')
  if (analysisImage) return <p>见下方题解图。</p>

  const state = savedAnswer?.interactiveState
  if (savedAnswer?.correct && state != null && problem.checkAnswer?.(state).ok) {
    return <QuizProblemPrintWidget problem={problem} interactiveState={state} />
  }
  return <p>本题暂无参考填法。</p>
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
  const isAnswerKey = printMode === 'answers'
  const isComplete = printMode === 'complete' && submitted

  return (
    <div
      className={`print-sheet shadow-sticker-sm bg-white p-10 print:p-0 print:shadow-none ${
        pageBreakAfter ? 'print-volume-break' : ''
      }`}
    >
      <div className="mb-6 border-b-2 border-slate-800 pb-4">
        <h1 className="mb-3 text-center text-2xl font-black text-slate-900">
          {paper.title}{isAnswerKey && ' · 参考答案'}
        </h1>
        <div className="flex items-center justify-between text-sm text-slate-600">
          {!isAnswerKey && (
            <>
              <span>姓名：___________________</span>
              <span>班级：___________________</span>
            </>
          )}
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
          const entry = QUIZ_ALL_ENTRIES_MAP.get(item.problemId)
            ?? QUIZ_ALL_ENTRIES_MAP.get(migrateProblemIdForAudit(item.problemId) ?? '')
          if (!entry) {
            return (
              <li key={i} className="problem-item">
                {i + 1}. 题库中找不到原题（{item.problemId}）
              </li>
            )
          }
          const { problem, lessonId } = entry
          const grade = gradeOf(lessonId)
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
              {isAnswerKey && grade != null && (
                <p className="mb-1 text-xs font-semibold text-slate-600">
                  {GRADE_LABEL[grade] ?? `${grade} 年级`} · {lessonDisplayLabel(lessonId)}
                </p>
              )}
              <div
                className="problem-text text-[15px] text-slate-900"
                dangerouslySetInnerHTML={{
                  __html: `<span class="q-num">${i + 1}.</span><span class="q-title">${problem.title}</span><span class="q-pts">（${pts}分）</span> ${sanitizeProblemText(problem.text)}`,
                }}
              />
              {isAnswerKey && (
                <ProblemFigureImage problem={customWidget ? { ...problem, figureNode: undefined } : problem} />
              )}
              {(!isAnswerKey || customWidget) && (
                <QuizProblemPrintWidget
                  problem={problem}
                  interactiveState={isComplete ? interactiveState : undefined}
                />
              )}

              {isAnswerKey ? (
                <>
                  <div className="answer-block mt-3 text-sm text-slate-800">
                    <p className="font-bold">参考答案</p>
                    {problem.finalQ || answerMode !== 'custom-widget' ? (
                      [problem, ...(problem.additionalQuestions ?? [])].map((q, index) => (
                        <p key={index}>{q.finalQ} {q.finalAns}{q.finalUnit}</p>
                      ))
                    ) : (
                      <GridReferenceAnswer problem={problem} savedAnswer={record} />
                    )}
                  </div>
                  {problem.verticalPuzzle?.solutionFills && !problem.verticalPuzzle.readonly && (
                    <QuizProblemPrintWidget
                      problem={problem}
                      interactiveState={problem.verticalPuzzle.solutionFills}
                    />
                  )}
                  <QuizProblemSolution problem={problem} className="print-solution mt-3" />
                  <div className="no-print mt-2">
                    <ProblemVideoReplay problem={problem} />
                  </div>
                </>
              ) : isComplete ? (
                <>
                  {(userAnswer || record?.correct != null) && (
                    <div className="answer-block border-kid-line mt-3 rounded-lg border-2 bg-slate-50 px-3 py-2 text-sm">
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
                  {problem.additionalQuestions?.length &&
                    [problem, ...problem.additionalQuestions].map((q) => (
                      <p key={q.finalQ} className="mt-3 text-sm">
                        {q.finalQ} ________________ {q.finalUnit}
                      </p>
                    ))}
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
  .problem-text .q-title {
    font-size: 0.9em;
    font-weight: 700;
    color: #334155;
    margin-right: 0.35rem;
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
    max-width: 200px;
    max-height: 200px;
    width: auto;
    height: auto;
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
    .quiz-print-raster {
      max-width: 200px;
      max-height: 200px;
    }
  }
`
