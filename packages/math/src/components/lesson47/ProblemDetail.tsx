'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Problem } from '@rosie/core'
import { isInteractiveProblem } from '@rosie/math/utils/check-problem-answer'
import { TAG_STYLE } from '@rosie/math/utils/lesson47-data'
import { useLesson47 } from './Lesson47Provider'
import { getMasteryLevel, MASTERY_ICON, MASTERY_BADGE_BG } from '@rosie/core'
import { useProblemAnswer } from '@rosie/math/hooks/useProblemAnswer'
import InteractiveAnswerFeedback from '@rosie/math/components/shared/InteractiveAnswerFeedback'
import NumericAnswerPanel from '@rosie/math/components/shared/NumericAnswerPanel'
import { injectFigureGridCallbacks } from '@rosie/math/components/shared/injectFigureSubmit'
import QuestionLayout from '@rosie/math/components/shared/QuestionLayout'
import DifficultyStars from '@rosie/math/components/shared/DifficultyStars'

interface ProblemDetailProps {
  problem: Problem
  mode?: 'full' | 'inline'
  defaultSolutionOpen?: boolean
}

export default function ProblemDetail({ problem, mode = 'full', defaultSolutionOpen = false }: ProblemDetailProps) {
  const router = useRouter()
  const { solveCount, handleSolve, addWrong } = useLesson47()
  const count = solveCount[problem.id] ?? 0
  const level = getMasteryLevel(count)
  const interactive = isInteractiveProblem(problem)

  const { answer, setAnswer, feedback, submit, check, clearFeedback } = useProblemAnswer(problem, {
    handleSolve,
    addWrong,
  })

  const figure = useMemo(
    () =>
      interactive
        ? injectFigureGridCallbacks(problem.figureNode, {
            onSubmit: submit,
            onStateChange: clearFeedback,
          })
        : problem.figureNode,
    [interactive, problem.figureNode, submit, clearFeedback],
  )

  const solution = (
    <div className="mb-3.5 rounded-lg border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-[#fae8ff] p-3.5">
      <div className="mb-1.5 flex items-center gap-1 text-xs font-bold text-fuchsia-700">
        🧠 玩法详解
      </div>
      <ul className="flex flex-col gap-1.5">
        {problem.analysis.map((a, i) => (
          <li
            key={i}
            className="flex items-start gap-1.5 text-xs leading-relaxed text-fuchsia-900 [&_strong]:font-bold"
          >
            <span className="shrink-0">💡</span>
            <span dangerouslySetInnerHTML={{ __html: a }} />
          </li>
        ))}
      </ul>
    </div>
  )

  const question = (
    <div className="flex flex-col gap-2">
      <div className="min-w-0 flex-1">
        <span
          className={`mb-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TAG_STYLE[problem.tag] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {problem.tagLabel}
        </span>
        <DifficultyStars level={problem.difficulty} size="md" />
        <div
          className="mb-3.5 rounded-lg border-l-3 border-fuchsia-300 bg-fuchsia-50 px-3.5 py-3 text-sm leading-relaxed text-text-secondary [&_strong]:font-bold [&_strong]:text-text-primary"
          dangerouslySetInnerHTML={{ __html: problem.text }}
        />
      </div>
      <div className="rounded-xl border border-fuchsia-100 bg-white p-3 sm:p-4">
        {figure}
      </div>
    </div>
  )

  const answerDom = interactive ? (
    <InteractiveAnswerFeedback feedback={feedback} />
  ) : (
    <NumericAnswerPanel
      problem={problem}
      answer={answer}
      onAnswerChange={setAnswer}
      onCheck={check}
      feedback={feedback}
      buttonClassName="bg-fuchsia-600 shadow-[0_3px_10px_rgba(192,38,211,0.3)]"
    />
  )

  return (
    <div>
      {mode === 'full' && (
        <div className="mb-4 flex items-center gap-2.5 border-b border-border-light pb-3.5">
          <button
            onClick={() => router.back()}
            className="flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-gray-100 text-lg transition-colors hover:bg-gray-200"
          >
            ‹
          </button>
          <div className="flex-1 text-[17px] font-bold">{problem.title}</div>
          <div
            className={`flex h-[30px] min-w-[30px] items-center justify-center rounded-full px-1.5 text-sm font-bold ${MASTERY_BADGE_BG[level]}`}
          >
            {MASTERY_ICON[level]}
          </div>
        </div>
      )}
      <QuestionLayout
        question={question}
        solution={solution}
        answer={answerDom}
        defaultSolutionOpen={defaultSolutionOpen}
      />
    </div>
  )
}
