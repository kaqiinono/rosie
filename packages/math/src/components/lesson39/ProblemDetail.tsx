'use client'

import { useState, useEffect } from 'react'
import { useProblemAnswer } from '@rosie/math/hooks/useProblemAnswer'
import NumericAnswerPanel from '@rosie/math/components/shared/NumericAnswerPanel'
import type { Problem } from '@rosie/core'
import { TAG_STYLE } from '@rosie/math/utils/lesson39-data'
import { useLesson39 } from './Lesson39Provider'
import { getMasteryLevel } from '@rosie/core'
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

export default function ProblemDetail({ problem, mode = 'full', defaultSolutionOpen = false, prevHref = null, nextHref = null, positionLabel }: ProblemDetailProps) {
  const { solveCount, handleSolve, addWrong } = useLesson39()
  const count = solveCount[problem.id] ?? 0
  const level = getMasteryLevel(count)

  const { answer, setAnswer, feedback, check } = useProblemAnswer(problem, {
    handleSolve,
    addWrong,
  })

  const solution = (
    <ProblemSolutionPanel problem={problem} variant="yellow" />
  )

  const question = (
    <div className="flex flex-col gap-1.5">
      <div className="min-w-0 flex-1">
        <span
          className={`mb-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TAG_STYLE[problem.tag] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {problem.tagLabel}
        </span>
        <DifficultyStars level={problem.difficulty} size="md" />
        <div
          className="mb-3.5 rounded-lg border-l-3 border-amber-300 bg-[#fffbeb] px-3.5 py-3 text-sm leading-relaxed text-text-secondary [&>strong]:font-bold [&>strong]:text-text-primary"
          dangerouslySetInnerHTML={{ __html: problem.text }}
        />
      </div>
      <ProblemFigureImage problem={problem} />
    </div>
  )

  const answerDom = (
    <NumericAnswerPanel
      problem={problem}
      answer={answer}
      onAnswerChange={setAnswer}
      onCheck={check}
      feedback={feedback}
      buttonClassName="bg-amber-600 shadow-[0_3px_10px_rgba(180,83,9,0.3)]"
    />
  )

  return (
    <div>
      {mode === 'full' && (
        <LessonProblemDetailHeader problemId={problem.id} title={problem.title} masteryLevel={level} practiceCount={count} problem={problem} />
      )}
      <QuestionLayout question={question} solution={solution} answer={answerDom} defaultSolutionOpen={defaultSolutionOpen} problemId={problem.id} problem={problem} />
      {mode === 'full' && positionLabel && (
        <LessonProblemNavBar prevHref={prevHref} nextHref={nextHref} positionLabel={positionLabel} />
      )}
    </div>
  )
}
