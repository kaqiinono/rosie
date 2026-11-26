'use client'

import Link from 'next/link'
import type { Problem } from '@rosie/core'
import { getMasteryLevel } from '@rosie/core'
import { useProblemAnswer } from '@rosie/math-kit/hooks/useProblemAnswer'
import LessonProblemDetailHeader from '@rosie/math-kit/components/shared/LessonProblemDetailHeader'
import LessonProblemNavBar from '@rosie/math-kit/components/shared/LessonProblemNavBar'
import ProblemAnswerSection from '@rosie/math-kit/components/shared/ProblemAnswerSection'
import ProblemFigureImage from '@rosie/math-kit/components/shared/ProblemFigureImage'
import ProblemSolutionPanel from '@rosie/math-kit/components/shared/ProblemSolutionPanel'
import ProblemWorkspace from '@rosie/math-kit/components/shared/ProblemWorkspace'
import { sanitizeProblemText } from '@rosie/math-kit/utils/sanitize-problem-text'
import { Badge, Button } from '@rosie/ui/themes'
import { LESSON_TIP } from '../../../../utils/g2/lesson14-data'
import { useG2Lesson14 } from './G2Lesson14Provider'

type Props = {
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
}: Props) {
  const { practiceCount, correctCount, handleSolve, addWrong } = useG2Lesson14()
  const { answer, setAnswer, feedback, submit, check, clearFeedback, hasAttempted } =
    useProblemAnswer(
      problem,
      { handleSolve, addWrong },
      { wrongHint: '❌ 按同一个顺序再数一遍，看看有没有重复或漏掉的情况。' },
    )
  const question = (
    <div>
      <Badge variant="soft" radius="full" color="teal" className="mb-2.5">
        {problem.tagLabel}
      </Badge>
      <div
        className="text-text-secondary [&>strong]:text-text-primary rounded-lg border-l-3 border-teal-300 bg-teal-50 px-3.5 py-3 text-sm leading-relaxed [&>strong]:font-bold"
        dangerouslySetInnerHTML={{ __html: sanitizeProblemText(problem.text) }}
      />
      {problem.figureNode && (
        <div className="mt-3">
          <ProblemFigureImage problem={problem} />
        </div>
      )}
    </div>
  )
  const answerDom = (
    <ProblemAnswerSection
      problem={problem}
      answer={answer}
      onAnswerChange={setAnswer}
      feedback={feedback}
      onSubmit={submit}
      onCheck={check}
      onStateChange={clearFeedback}
      buttonClassName="bg-teal-600 shadow-sticker-sm"
      tip={
        <div className="mt-3 rounded-lg bg-teal-50 px-3 py-2.5 text-xs leading-relaxed text-teal-800">
          💡 <strong>解题提示：</strong>
          {tip ?? LESSON_TIP}
        </div>
      }
    />
  )
  return (
    <div>
      {mode === 'full' && (
        <LessonProblemDetailHeader
          problemId={problem.id}
          title={problem.title}
          masteryLevel={getMasteryLevel(correctCount[problem.id] ?? 0)}
          practiceCount={practiceCount[problem.id] ?? 0}
          problem={problem}
        />
      )}
      <ProblemWorkspace
        question={question}
        solution={<ProblemSolutionPanel problem={problem} variant="yellow" />}
        answer={answerDom}
        hasAttempted={hasAttempted}
        defaultSolutionOpen={defaultSolutionOpen}
        problem={problem}
      />
      {mode === 'full' && problem.id === '2-14-L14' && (
        <div className="my-3">
          <Button asChild variant="soft">
            <Link href="/math/ny/2/14/homework/2-14-H11">
              例题14练一练 · 方格中的最短路线
            </Link>
          </Button>
        </div>
      )}
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
