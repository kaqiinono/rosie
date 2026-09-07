'use client'

import type { Problem } from '@rosie/core'
import { getMasteryLevel } from '@rosie/core'
import LessonProblemDetailHeader from '@rosie/math-kit/components/shared/LessonProblemDetailHeader'
import LessonProblemNavBar from '@rosie/math-kit/components/shared/LessonProblemNavBar'
import ProblemAnswerSection from '@rosie/math-kit/components/shared/ProblemAnswerSection'
import ProblemSolutionPanel from '@rosie/math-kit/components/shared/ProblemSolutionPanel'
import ProblemWorkspace from '@rosie/math-kit/components/shared/ProblemWorkspace'
import { useProblemAnswer } from '@rosie/math-kit/hooks/useProblemAnswer'
import { sanitizeProblemText } from '@rosie/math-kit/utils/sanitize-problem-text'
import { TAG_STYLE, TYPE_TIP } from '@rosie/math-content/utils/g2/lesson9-data'
import { useG2Lesson9 } from './G2Lesson9Provider'

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
  const { practiceCount, correctCount, handleSolve, addWrong } = useG2Lesson9()
  const { answer, setAnswer, feedback, submit, check, clearFeedback, hasAttempted } = useProblemAnswer(
    problem,
    { handleSolve, addWrong },
    { wrongHint: '❌ 再观察一下：能否先凑整、抵消，或提取公因数？' },
  )
  const tipText = tip ?? TYPE_TIP[problem.tag]
  const question = (
    <div>
      <span className={`mb-2.5 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${TAG_STYLE[problem.tag] ?? 'bg-gray-100 text-gray-600'}`}>{problem.tagLabel}</span>
      <div className="text-text-secondary [&>strong]:text-text-primary rounded-lg border-l-3 border-amber-300 bg-amber-50 px-3.5 py-3 text-sm leading-relaxed [&>strong]:font-bold" dangerouslySetInnerHTML={{ __html: sanitizeProblemText(problem.text) }} />
    </div>
  )
  const answerDom = (
    <ProblemAnswerSection problem={problem} answer={answer} onAnswerChange={setAnswer} feedback={feedback} onSubmit={submit} onCheck={check} onStateChange={clearFeedback} buttonClassName="bg-amber-600 shadow-[0_3px_10px_rgba(217,119,6,0.3)]" tip={tipText ? <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">💡 <strong>解题口诀：</strong>{tipText}</div> : null} />
  )
  return (
    <div>
      {mode === 'full' && <LessonProblemDetailHeader problemId={problem.id} title={problem.title} masteryLevel={getMasteryLevel(correctCount[problem.id] ?? 0)} practiceCount={practiceCount[problem.id] ?? 0} problem={problem} />}
      <ProblemWorkspace question={question} solution={<ProblemSolutionPanel problem={problem} variant="yellow" />} answer={answerDom} hasAttempted={hasAttempted} defaultSolutionOpen={defaultSolutionOpen} problem={problem} />
      {mode === 'full' && positionLabel && <LessonProblemNavBar prevHref={prevHref} nextHref={nextHref} positionLabel={positionLabel} />}
    </div>
  )
}
