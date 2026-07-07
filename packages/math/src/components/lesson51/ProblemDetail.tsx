'use client'

import { useState, useEffect } from 'react'
import type { Problem } from '@rosie/core'
import { TAG_STYLE, TYPE_TIP } from '@rosie/math/utils/lesson51-data'
import { useLesson51 } from './Lesson51Provider'
import { getMasteryLevel } from '@rosie/core'
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
  const { solveCount, handleSolve, addWrong } = useLesson51()
  const count = solveCount[problem.id] ?? 0
  const level = getMasteryLevel(count)

  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    setAnswer('')
    setFeedback(null)
  }, [problem.id])

  function checkAnswer() {
    if (!answer) return
    const v = Number(answer)
    if (v === problem.finalAns) {
      setFeedback({ text: '🎉 完全正确！你真棒！', ok: true })
      handleSolve(problem.id)
    } else {
      setFeedback({ text: '❌ 不对哦，再想想？提示：可以先统一量，或先求每份效率。', ok: false })
      addWrong(problem.id)
    }
  }

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
          className="mb-3.5 rounded-lg border-l-3 border-emerald-300 bg-emerald-50 px-3.5 py-3 text-sm leading-relaxed text-text-secondary [&>strong]:font-bold [&>strong]:text-text-primary"
          dangerouslySetInnerHTML={{ __html: problem.text }}
        />
      </div>
      <ProblemFigureImage problem={problem} />
    </div>
  )

  const answerDom = (
    <>
      <div className="mb-3 flex items-center gap-2">
        <div className="h-px flex-1 bg-border-light" />
        <div className="whitespace-nowrap text-xs font-semibold text-text-muted">✏️ 写出答案</div>
        <div className="h-px flex-1 bg-border-light" />
      </div>
      <div className="mb-3 rounded-lg border border-dashed border-border-light bg-[#f9fafb] p-3.5">
        <div className="text-[13px] text-text-secondary">{problem.finalQ}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <input type="number"
            className="w-[100px] rounded-lg border border-border-light px-2 py-1.5 text-center text-sm"
            placeholder="？" value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && checkAnswer()} />
          <span>{problem.finalUnit}</span>
          <button onClick={checkAnswer}
            className="cursor-pointer rounded-full bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_3px_10px_rgba(5,150,105,0.3)] transition-all active:translate-y-px">
            检查答案
          </button>
        </div>
        {feedback && (
          <div className={`mt-2 text-[13px] ${feedback.ok ? 'text-app-green-dark' : 'text-app-red'}`}>
            {feedback.text}
          </div>
        )}
      </div>
      {tipText && (
        <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs leading-relaxed text-emerald-800">
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
