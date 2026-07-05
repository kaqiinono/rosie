'use client'

import type { Problem } from '@rosie/core'
import { TAG_STYLE } from '@rosie/math/utils/lesson34-data'
import { useLesson34 } from './Lesson34Provider'
import { getMasteryLevel } from '@rosie/core'
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

export default function ProblemDetail({ problem, mode = 'full', tip, defaultSolutionOpen = false, prevHref = null, nextHref = null, positionLabel }: ProblemDetailProps) {
  const { solveCount, handleSolve, addWrong } = useLesson34()
  const count = solveCount[problem.id] ?? 0
  const level = getMasteryLevel(count)

  const { answer, setAnswer, feedback, check } = useProblemAnswer(problem, {
    handleSolve,
    addWrong,
  })

  const question = (
    <div className="flex flex-col gap-4 min-[900px]:flex-row min-[900px]:items-start">
      <div className="min-w-0 flex-1">
        <span
          className={`mb-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TAG_STYLE[problem.tag] || 'bg-gray-100 text-gray-600'}`}
        >
          {problem.tagLabel}
        </span>
        <DifficultyStars level={problem.difficulty} size="md" />

        <div
          className="text-text-secondary [&>strong]:text-text-primary mb-3.5 rounded-lg border-l-3 border-amber-400 bg-amber-50 px-3.5 py-3 text-sm leading-relaxed [&>strong]:font-bold"
          dangerouslySetInnerHTML={{ __html: problem.text }}
        />
      </div>
    </div>
  )

  const answerDom = (
    <div className="min-w-0 flex-1">
      <NumericAnswerPanel
        problem={problem}
        answer={answer}
        onAnswerChange={setAnswer}
        onCheck={check}
        feedback={feedback}
        buttonClassName="bg-amber-500 shadow-[0_3px_10px_rgba(245,158,11,0.3)]"
      />

      {tip && (
        <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
          💡 <strong>口诀：</strong>
          {tip}
        </div>
      )}
    </div>
  )

  const solution = (
    <ProblemSolutionPanel problem={problem} variant="yellow" />
  )

  return (
    <div>
      {mode === 'full' && (
        <LessonProblemDetailHeader problemId={problem.id} title={problem.title} masteryLevel={level} practiceCount={count} />
      )}

      <QuestionLayout question={question} solution={solution} answer={answerDom} defaultSolutionOpen={defaultSolutionOpen} />
      {mode === 'full' && positionLabel && (
        <LessonProblemNavBar prevHref={prevHref} nextHref={nextHref} positionLabel={positionLabel} />
      )}
    </div>
  )
}
