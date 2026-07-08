'use client'

import { useMemo } from 'react'
import type { Problem } from '@rosie/core'
import { isInteractiveProblem } from '@rosie/math/utils/check-problem-answer'
import { TAG_STYLE } from '@rosie/math/utils/g1/lesson47-data'
import { useG1Lesson47 } from './G1Lesson47Provider'
import { getMasteryLevel } from '@rosie/core'
import { useProblemAnswer } from '@rosie/math/hooks/useProblemAnswer'
import InteractiveAnswerFeedback from '@rosie/math/components/shared/InteractiveAnswerFeedback'
import NumericAnswerPanel from '@rosie/math/components/shared/NumericAnswerPanel'
import { injectFigureGridCallbacks } from '@rosie/math/components/shared/injectFigureSubmit'
import QuestionLayout from '@rosie/math/components/shared/QuestionLayout'
import ProblemSolutionPanel from '@rosie/math/components/shared/ProblemSolutionPanel'
import ProblemFigureImage from '@rosie/math/components/shared/ProblemFigureImage'
import DifficultyStars from '@rosie/math/components/shared/DifficultyStars'
import LessonProblemDetailHeader from '@rosie/math/components/shared/LessonProblemDetailHeader'
import LessonProblemNavBar from '@rosie/math/components/shared/LessonProblemNavBar'

interface ProblemDetailProps {
  problem: Problem
  mode?: 'full' | 'inline'
  defaultSolutionOpen?: boolean
  prevHref?: string | null
  nextHref?: string | null
  positionLabel?: string
}

export default function ProblemDetail({
  problem,
  mode = 'full',
  defaultSolutionOpen = false,
  prevHref = null,
  nextHref = null,
  positionLabel,
}: ProblemDetailProps) {
  const { solveCount, handleSolve, addWrong } = useG1Lesson47()
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
    <ProblemSolutionPanel problem={problem} variant="fuchsia" headingIcon="🧠" heading="玩法详解" />
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
          className="text-text-secondary [&_strong]:text-text-primary mb-3.5 rounded-lg border-l-3 border-fuchsia-300 bg-fuchsia-50 px-3.5 py-3 text-sm leading-relaxed [&_strong]:font-bold"
          dangerouslySetInnerHTML={{ __html: problem.text }}
        />
      </div>
      <div className="rounded-xl border border-fuchsia-100 bg-white p-3 sm:p-4">{figure}</div>
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
        <LessonProblemDetailHeader
          problemId={problem.id}
          title={problem.title}
          masteryLevel={level}
          practiceCount={count}
          problem={problem}
        />
      )}
      <QuestionLayout
        question={question}
        solution={solution}
        answer={answerDom}
        defaultSolutionOpen={defaultSolutionOpen}
        problemId={problem.id}
        problem={problem}
      />
      {mode === 'full' && positionLabel && (
        <LessonProblemNavBar
          prevHref={prevHref}
          nextHref={nextHref}
          positionLabel={positionLabel}
        />
      )}
    </div>
  )
}
