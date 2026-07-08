'use client'

import type { Problem } from '@rosie/core'
import { TAG_STYLE, TYPE_TIP } from '@rosie/math/utils/lesson56-data'
import { useLesson56 } from './Lesson56Provider'
import { getMasteryLevel } from '@rosie/core'
import { useProblemAnswer } from '@rosie/math/hooks/useProblemAnswer'
import NumericAnswerPanel from '@rosie/math/components/shared/NumericAnswerPanel'
import VerticalDigitPuzzlePanel from '@rosie/math/components/shared/VerticalDigitPuzzlePanel'
import QuestionLayout from '@rosie/math/components/shared/QuestionLayout'
import ProblemSolutionPanel from '@rosie/math/components/shared/ProblemSolutionPanel'
import ProblemFigureImage from '@rosie/math/components/shared/ProblemFigureImage'
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
  const tipText = tip ?? TYPE_TIP[problem.tag]
  const { solveCount, handleSolve, addWrong } = useLesson56()
  const count = solveCount[problem.id] ?? 0
  const level = getMasteryLevel(count)
  const verticalPuzzle = problem.verticalPuzzle

  const { answer, setAnswer, feedback, submit, check, clearFeedback } = useProblemAnswer(problem, {
    handleSolve,
    addWrong,
  }, {
    wrongHint: '❌ 不对哦，再想想？提示：从个位起看进位/退位，相同符号代表相同数字。',
  })

  const solution = (
    <ProblemSolutionPanel problem={problem} variant="yellow" />
  )

  const question = (
    <div className="flex flex-col gap-1.5">
      <div className="min-w-0 flex-1">
        <span className={`mb-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TAG_STYLE[problem.tag] ?? 'bg-gray-100 text-gray-600'}`}>
          {problem.tagLabel}
        </span>
        <div
          className="mb-3.5 rounded-lg border-l-3 border-sky-300 bg-sky-50 px-3.5 py-3 text-sm leading-relaxed text-text-secondary [&>strong]:font-bold [&>strong]:text-text-primary"
          dangerouslySetInnerHTML={{ __html: problem.text }}
        />
      </div>
      <ProblemFigureImage problem={problem} />
    </div>
  )

  const answerDom = verticalPuzzle ? (
    <>
      <VerticalDigitPuzzlePanel
        spec={verticalPuzzle}
        onSubmit={submit}
        onStateChange={clearFeedback}
        feedback={feedback}
      />
      {tipText && (
        <div className="mt-3 rounded-lg bg-sky-50 px-3 py-2.5 text-xs leading-relaxed text-sky-800">
          💡 <strong>解题口诀：</strong>
          {tipText}
        </div>
      )}
    </>
  ) : (
    <>
      <NumericAnswerPanel
        problem={problem}
        answer={answer}
        onAnswerChange={setAnswer}
        onCheck={check}
        feedback={feedback}
        buttonClassName="bg-sky-600 shadow-[0_3px_10px_rgba(14,165,233,0.3)]"
      />
      {tipText && (
        <div className="mb-3 rounded-lg bg-sky-50 px-3 py-2.5 text-xs leading-relaxed text-sky-800">
          💡 <strong>解题口诀：</strong>
          {tipText}
        </div>
      )}
    </>
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
      <QuestionLayout question={question} solution={solution} answer={answerDom} defaultSolutionOpen={defaultSolutionOpen} problemId={problem.id} problem={problem} />
      {mode === 'full' && positionLabel && (
        <LessonProblemNavBar prevHref={prevHref} nextHref={nextHref} positionLabel={positionLabel} />
      )}
    </div>
  )
}
