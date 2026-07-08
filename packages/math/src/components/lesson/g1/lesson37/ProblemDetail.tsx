'use client'

import type { Problem } from '@rosie/core'
import { TAG_STYLE } from '@rosie/math/utils/g1/lesson37-data'
import { useG1Lesson37 } from './G1Lesson37Provider'
import { getMasteryLevel } from '@rosie/core'
import AssumptionDiagram from './AssumptionDiagram'
import EquationDiagram from './EquationDiagram'
import { useProblemAnswer } from '@rosie/math/hooks/useProblemAnswer'
import NumericAnswerPanel from '@rosie/math/components/shared/NumericAnswerPanel'
import QuestionLayout from '@rosie/math/components/shared/QuestionLayout'
import ProblemSolutionPanel from '@rosie/math/components/shared/ProblemSolutionPanel'
import ProblemFigureImage from '@rosie/math/components/shared/ProblemFigureImage'
import DifficultyStars from '@rosie/math/components/shared/DifficultyStars'
import LessonProblemDetailHeader from '@rosie/math/components/shared/LessonProblemDetailHeader'
import LessonProblemNavBar from '@rosie/math/components/shared/LessonProblemNavBar'

interface ProblemDetailProps {
  problem: Problem
  mode?: 'full' | 'inline'
  tip?: string
  defaultSolutionOpen?: boolean
  prevHref?: string | null
  nextHref?: string | null
  positionLabel?: string
}

export default function ProblemDetail({
  problem,
  mode = 'full',
  tip,
  defaultSolutionOpen = false,
  prevHref = null,
  nextHref = null,
  positionLabel,
}: ProblemDetailProps) {
  const { solveCount, handleSolve, addWrong } = useG1Lesson37()
  const count = solveCount[problem.id] ?? 0
  const level = getMasteryLevel(count)

  const autoDiagram =
    problem.tag === 'type5' ? (
      <EquationDiagram problem={problem} />
    ) : (
      <AssumptionDiagram problem={problem} />
    )

  const { answer, setAnswer, feedback, check } = useProblemAnswer(problem, {
    handleSolve,
    addWrong,
  })

  const question = (
    <div className="flex flex-col gap-4 min-[900px]:flex-row min-[900px]:items-start">
      {/* Left column */}
      <div className="min-w-0 flex-1">
        <span
          className={`mb-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TAG_STYLE[problem.tag] || 'bg-gray-100 text-gray-600'}`}
        >
          {problem.tagLabel}
        </span>
        <DifficultyStars level={problem.difficulty} size="md" />

        {/* Problem text */}
        <div
          className="border-app-blue text-text-secondary [&>strong]:text-text-primary mb-3.5 rounded-lg border-l-3 bg-[#f8faff] px-3.5 py-3 text-sm leading-relaxed [&>strong]:font-bold"
          dangerouslySetInnerHTML={{ __html: problem.text }}
        />
      </div>
    </div>
  )

  const solution = (
    <ProblemSolutionPanel
      problem={problem}
      variant="yellow"
      heading="解题分析"
      footer={
        <div className="mb-3 rounded-lg border border-[#e0e4ff] bg-[#f8f9ff] p-3.5">
          {autoDiagram}
        </div>
      }
    />
  )

  const answerDom = (
    <div className="min-w-0 flex-1">
      <NumericAnswerPanel
        problem={problem}
        answer={answer}
        onAnswerChange={setAnswer}
        onCheck={check}
        feedback={feedback}
        buttonClassName="bg-app-blue shadow-[0_3px_10px_rgba(59,130,246,0.3)]"
      />

      {tip && (
        <div className="bg-app-green-light text-app-green-dark rounded-lg px-3 py-2.5 text-xs leading-relaxed">
          💡 <strong>口诀：</strong>
          {tip}
        </div>
      )}
    </div>
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
