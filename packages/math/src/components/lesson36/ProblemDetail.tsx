'use client'

import { useState, useEffect } from 'react'
import type { Problem } from '@rosie/core'
import { TAG_STYLE } from '@rosie/math/utils/lesson36-data'
import { useLesson36 } from './Lesson36Provider'
import { getMasteryLevel } from '@rosie/core'
import Days from './WeekdayFlowChart/Days'
import Month from './WeekdayFlowChart/Month'
import Year from './WeekdayFlowChart/Year'
import MonthCalendarPuzzle from './WeekdayFlowChart/MonthCalendarPuzzle'
import MonthCalendarPuzzleSum from './WeekdayFlowChart/MonthCalendarPuzzleSum'
import { useProblemAnswer } from '@rosie/math/hooks/useProblemAnswer'
import NumericAnswerPanel from '@rosie/math/components/shared/NumericAnswerPanel'
import QuestionLayout from '@rosie/math/components/shared/QuestionLayout'
import ProblemAnalysisImage from '@rosie/math/components/shared/ProblemAnalysisImage'
import ProblemFigureImage from '@rosie/math/components/shared/ProblemFigureImage'
import DifficultyStars from '@rosie/math/components/shared/DifficultyStars'
import LessonProblemDetailHeader from '@rosie/math/components/shared/LessonProblemDetailHeader'
import LessonProblemNavBar from '@rosie/math/components/shared/LessonProblemNavBar'

interface ProblemDetailProps {
  problem: Problem
  mode?: 'full' | 'inline'
  tip?: string
  leftDiagram?: React.ReactNode
  rightDiagram?: React.ReactNode
  defaultSolutionOpen?: boolean
  prevHref?: string | null
  nextHref?: string | null
  positionLabel?: string
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

export default function ProblemDetail({ problem, mode = 'full', tip, defaultSolutionOpen = false, prevHref = null, nextHref = null, positionLabel }: ProblemDetailProps) {
  const { solveCount, handleSolve, addWrong } = useLesson36()
  const count = solveCount[problem.id] ?? 0
  const level = getMasteryLevel(count)

  const [manualTotalDays, setManualTotalDays] = useState('')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setManualTotalDays('')
  }, [problem.id])

  const { answer, setAnswer, feedback, check } = useProblemAnswer(problem, {
    handleSolve,
    addWrong,
  })

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
      <ProblemAnalysisImage problem={problem} />
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
        <DifficultyStars level={problem.difficulty} size="md" />

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
      {tip && (
        <div className="bg-app-green-light text-app-green-dark mb-3 rounded-lg px-3 py-2.5 text-xs leading-relaxed">
          💡 <strong>口诀：</strong>
          {tip}
        </div>
      )}
      <NumericAnswerPanel
        problem={problem}
        answer={answer}
        onAnswerChange={setAnswer}
        onCheck={check}
        feedback={feedback}
        buttonClassName="bg-app-blue shadow-[0_3px_10px_rgba(59,130,246,0.3)]"
      />
    </>
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
