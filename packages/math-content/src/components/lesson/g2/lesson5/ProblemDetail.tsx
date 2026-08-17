'use client'

import { sanitizeProblemText } from '@rosie/math-kit/utils/sanitize-problem-text'

import type { Problem } from '@rosie/core'
import { TAG_STYLE, TYPE_TIP } from '@rosie/math-content/utils/g2/lesson5-data'
import { useG2Lesson5 } from './G2Lesson5Provider'
import { getMasteryLevel } from '@rosie/core'
import { useProblemAnswer } from '@rosie/math-kit/hooks/useProblemAnswer'
import ProblemAnswerSection from '@rosie/math-kit/components/shared/ProblemAnswerSection'
import ProblemWorkspace from '@rosie/math-kit/components/shared/ProblemWorkspace'
import ProblemSolutionPanel from '@rosie/math-kit/components/shared/ProblemSolutionPanel'
import ProblemFigureImage from '@rosie/math-kit/components/shared/ProblemFigureImage'
import LessonProblemDetailHeader from '@rosie/math-kit/components/shared/LessonProblemDetailHeader'
import LessonProblemNavBar from '@rosie/math-kit/components/shared/LessonProblemNavBar'

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
  const { solveCount, handleSolve, addWrong } = useG2Lesson5()
  const count = solveCount[problem.id] ?? 0
  const level = getMasteryLevel(count)

  const { answer, setAnswer, feedback, submit, check, clearFeedback, hasAttempted } = useProblemAnswer(
    problem,
    { handleSolve, addWrong },
    {
      wrongHint: '❌ 不对哦，再想想？提示：先看相邻项的差、比或和。',
    },
  )

  const solution = <ProblemSolutionPanel problem={problem} variant="yellow" />

  const question = (
    <div className="flex flex-col gap-1.5">
      <div className="min-w-0 flex-1">
        <span
          className={`mb-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TAG_STYLE[problem.tag] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {problem.tagLabel}
        </span>
        <div
          className="text-text-secondary [&>strong]:text-text-primary mb-3.5 rounded-lg border-l-3 border-amber-300 bg-amber-50 px-3.5 py-3 text-sm leading-relaxed [&>strong]:font-bold"
          dangerouslySetInnerHTML={{ __html: sanitizeProblemText(problem.text) }}
        />
      </div>
      <ProblemFigureImage problem={problem} />
    </div>
  )

  const tipBlock = tipText ? (
    <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
      💡 <strong>解题口诀：</strong>
      {tipText}
    </div>
  ) : null

  const answerDom = (
    <ProblemAnswerSection
      problem={problem}
      answer={answer}
      onAnswerChange={setAnswer}
      feedback={feedback}
      onSubmit={submit}
      onCheck={check}
      onStateChange={clearFeedback}
      buttonClassName="bg-amber-600 shadow-[0_3px_10px_rgba(245,158,11,0.3)]"
      tip={tipBlock}
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
      <ProblemWorkspace
        question={question}
        solution={solution}
        answer={answerDom}
        hasAttempted={hasAttempted}
        defaultSolutionOpen={defaultSolutionOpen}
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
