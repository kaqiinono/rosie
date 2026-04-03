'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Problem } from '@/utils/type'
import { TAG_STYLE } from '@/utils/lesson36-data'
import { useLesson36 } from './Lesson36Provider'
import { getMasteryLevel, MASTERY_ICON, MASTERY_BADGE_BG } from '@/utils/masteryUtils'
import Days from './WeekdayFlowChart/Days'
import Month from './WeekdayFlowChart/Month'
import Year from './WeekdayFlowChart/Year'
import MonthCalendarPuzzle from './WeekdayFlowChart/MonthCalendarPuzzle'
import MonthCalendarPuzzleSum from './WeekdayFlowChart/MonthCalendarPuzzleSum'
import QuestionLayout from '@/components/math/shared/QuestionLayout'

interface ProblemDetailProps {
  problem: Problem
  mode?: 'full' | 'inline'
  tip?: string
  leftDiagram?: React.ReactNode
  rightDiagram?: React.ReactNode
}

const VALID_TOTAL_DAYS = new Set([28, 29, 30, 31])

function buildFlowChart(
  problem: Problem,
  manualTotalDays: string,
  setManualTotalDays: (v: string) => void,
): React.ReactNode {
  const { tag, startDate, endDate, startWeekday, endWeekday } = problem

  if (tag === 'type5' || tag === 'type6') {
    const CalendarComp = tag === 'type6' ? MonthCalendarPuzzleSum : MonthCalendarPuzzle
    const fixed = problem.totalDays
    if (fixed) {
      return <CalendarComp totalDays={fixed} />
    }
    // totalDays must be derived by the student
    const parsed = parseInt(manualTotalDays, 10)
    const resolved = VALID_TOTAL_DAYS.has(parsed) ? (parsed as 28 | 29 | 30 | 31) : undefined
    return (
      <div className="flex flex-col gap-3">
        <div className="border-border-light flex items-center gap-2 rounded-lg border bg-[#f9fafb] px-3.5 py-2.5">
          <span className="text-text-secondary text-sm">这个月有几天？</span>
          <input
            type="number"
            min={28}
            max={31}
            className="border-border-light w-16 rounded-lg border px-2 py-1.5 text-center text-sm"
            placeholder="28~31"
            value={manualTotalDays}
            onChange={(e) => setManualTotalDays(e.target.value)}
          />
          <span className="text-text-secondary text-sm">天</span>
        </div>
        {resolved && <CalendarComp totalDays={resolved} />}
      </div>
    )
  }

  if (!startDate || !endDate || (!startWeekday && !endWeekday)) return null
  if (tag === 'type1') {
    return (
      <Days
        startDate={startDate}
        endDate={endDate}
        startWeekday={startWeekday}
        endWeekday={endWeekday}
      />
    )
  }
  if (tag === 'type2') {
    return (
      <Month
        startDate={startDate}
        endDate={endDate}
        startWeekday={startWeekday}
        endWeekday={endWeekday}
      />
    )
  }
  if (tag === 'type3' || tag === 'type4') {
    return (
      <Year
        startDate={startDate}
        endDate={endDate}
        startWeekday={startWeekday}
        endWeekday={endWeekday}
      />
    )
  }
  return null
}

export default function ProblemDetail({ problem, mode = 'full', tip }: ProblemDetailProps) {
  const router = useRouter()
  const { solveCount, handleSolve, addWrong } = useLesson36()
  const count = solveCount[problem.id] ?? 0
  const level = getMasteryLevel(count)

  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null)
  const [manualTotalDays, setManualTotalDays] = useState('')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnswer('')
    setFeedback(null)
    setManualTotalDays('')
  }, [problem.id])

  function checkAnswer() {
    if (!answer) return
    const v = Number(answer)
    if (v === problem.finalAns) {
      setFeedback({ text: '🎉 完全正确！你真棒！', ok: true })
      handleSolve(problem.id)
    } else {
      setFeedback({
        text: `❌ 不对哦，再想想？提示：答案是${problem.finalAns}以内的数。`,
        ok: false,
      })
      addWrong(problem.id)
    }
  }

  const autoLeftDiagram = buildFlowChart(problem, manualTotalDays, setManualTotalDays)

  const solution = (
    <div className="flex flex-col gap-4 min-[900px]:flex-row min-[900px]:items-start">
      <div>
        {/* Analysis box */}
        <div className="to-yellow-light mb-3.5 rounded-lg border border-[#fde68a] bg-gradient-to-br from-[#fffbeb] p-3.5">
          <div className="text-yellow-dark mb-1.5 flex items-center gap-1 text-xs font-bold">
            🔍 题型分析
          </div>
          <ul className="flex flex-col gap-1.5">
            {problem.analysis.map((a, i) => (
              <li
                key={i}
                className="flex items-start gap-1.5 text-xs leading-relaxed text-[#92400e]"
              >
                <span className="shrink-0">💡</span>
                {a}
              </li>
            ))}
          </ul>
        </div>

        {autoLeftDiagram}
      </div>
    </div>
  )

  const question = (
    <div className="flex flex-col gap-4 min-[900px]:flex-row min-[900px]:items-start">
      <div className="min-w-0 flex-1">
        <span
          className={`mb-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TAG_STYLE[problem.tag] || 'bg-gray-100 text-gray-600'}`}
        >
          {problem.tagLabel}
        </span>

        {/* Problem text */}
        <div
          className="border-app-blue text-text-secondary [&>strong]:text-text-primary mb-3.5 rounded-lg border-l-3 bg-[#f8faff] px-3.5 py-3 text-sm leading-relaxed [&>strong]:font-bold"
          dangerouslySetInnerHTML={{ __html: problem.text }}
        />
      </div>
    </div>
  )

  const answerDom = (
    <>
      {/* Answer section */}
      <div className="mb-3 flex items-center gap-2">
        <div className="bg-border-light h-px flex-1" />
        <div className="text-text-muted text-xs font-semibold whitespace-nowrap">✏️ 写出答案</div>
        <div className="bg-border-light h-px flex-1" />
      </div>
      {/* Tip */}
      {tip && (
        <div className="bg-app-green-light text-app-green-dark rounded-lg px-3 py-2.5 text-xs leading-relaxed">
          💡 <strong>口诀：</strong>
          {tip}
        </div>
      )}
      <div className="border-border-light mb-3 rounded-lg border border-dashed bg-[#f9fafb] p-3.5">
        <div className="text-text-secondary text-[13px]">{problem.finalQ}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <input
            type="number"
            className="border-border-light w-[72px] rounded-lg border px-2 py-1.5 text-center text-sm"
            placeholder="？"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && checkAnswer()}
          />
          <span>{problem.finalUnit}</span>
          <button
            onClick={checkAnswer}
            className="bg-app-blue cursor-pointer rounded-full px-4 py-2 text-[13px] font-semibold text-white shadow-[0_3px_10px_rgba(59,130,246,0.3)] transition-all active:translate-y-px"
          >
            检查答案
          </button>
        </div>
        {feedback && (
          <div
            className={`mt-2 text-[13px] ${feedback.ok ? 'text-app-green-dark' : 'text-app-red'}`}
          >
            {feedback.text}
          </div>
        )}
      </div>
    </>
  )

  return (
    <div>
      {mode === 'full' && (
        <div className="border-border-light mb-4 flex items-center gap-2.5 border-b pb-3.5">
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
