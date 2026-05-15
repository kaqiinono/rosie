'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Problem } from '@/utils/type'
import { TAG_STYLE } from '@/utils/lesson42-data'
import { useLesson42 } from './Lesson42Provider'
import { getMasteryLevel, MASTERY_ICON, MASTERY_BADGE_BG } from '@/utils/masteryUtils'
import QuestionLayout from '@/components/math/shared/QuestionLayout'
import AnalysisImage from '@/components/math/shared/AnalysisImage'

interface ProblemDetailProps {
  problem: Problem
  mode?: 'full' | 'inline'
}

export default function ProblemDetail({ problem, mode = 'full' }: ProblemDetailProps) {
  const router = useRouter()
  const { solveCount, handleSolve, addWrong } = useLesson42()
  const count = solveCount[problem.id] ?? 0
  const level = getMasteryLevel(count)

  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      setFeedback({
        text: `❌ 不对哦，再想想？提示：答案是 ${problem.finalAns} 以内的数。`,
        ok: false,
      })
      addWrong(problem.id)
    }
  }

  const solution = (
    <div className="mb-3.5 rounded-lg border border-rose-200 bg-gradient-to-br from-rose-50 to-[#fee2e2] p-3.5">
      <div className="mb-1.5 flex items-center gap-1 text-xs font-bold text-rose-700">
        🔍 题型分析
      </div>
      <ul className="flex flex-col gap-1.5">
        {problem.analysis.map((a, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs leading-relaxed text-rose-900">
            <span className="shrink-0">💡</span>
            {a}
          </li>
        ))}
      </ul>
      {problem.analysisImg && <AnalysisImage src={problem.analysisImg} alt={problem.title} />}
    </div>
  )

  const question = (
    <div className="flex flex-col gap-1.5">
      <div className="min-w-0 flex-1">
        <span
          className={`mb-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TAG_STYLE[problem.tag] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {problem.tagLabel}
        </span>
        <div
          className="mb-3.5 rounded-lg border-l-3 border-rose-300 bg-rose-50 px-3.5 py-3 text-sm leading-relaxed text-text-secondary [&>strong]:font-bold [&>strong]:text-text-primary"
          dangerouslySetInnerHTML={{ __html: problem.text }}
        />
      </div>
      <div>{problem.figureNode}</div>
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
          <input
            type="number"
            className="w-[72px] rounded-lg border border-border-light px-2 py-1.5 text-center text-sm"
            placeholder="？"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && checkAnswer()}
          />
          <span>{problem.finalUnit}</span>
          <button
            onClick={checkAnswer}
            className="cursor-pointer rounded-full bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_3px_10px_rgba(190,18,60,0.3)] transition-all active:translate-y-px"
          >
            检查答案
          </button>
        </div>
        {feedback && (
          <div className={`mt-2 text-[13px] ${feedback.ok ? 'text-app-green-dark' : 'text-app-red'}`}>
            {feedback.text}
          </div>
        )}
      </div>
    </>
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
      <QuestionLayout question={question} solution={solution} answer={answerDom} />
    </div>
  )
}
