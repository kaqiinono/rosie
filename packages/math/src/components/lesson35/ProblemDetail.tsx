'use client'

import type { Problem } from '@rosie/core'
import { TAG_STYLE } from '@rosie/math/utils/lesson35-data'
import { useLesson35 } from './Lesson35Provider'
import { getMasteryLevel } from '@rosie/core'
import { useProblemAnswer } from '@rosie/math/hooks/useProblemAnswer'
import NumericAnswerPanel from '@rosie/math/components/shared/NumericAnswerPanel'
import RatioDiagram from './RatioDiagram'
import BlockDiagram from './BlockDiagram'
import DualBlockDiagram from './DualBlockDiagram'
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
  defaultSolutionOpen?: boolean
  prevHref?: string | null
  nextHref?: string | null
  positionLabel?: string
}

export default function ProblemDetail({ problem, mode = 'full', tip, defaultSolutionOpen = false, prevHref = null, nextHref = null, positionLabel }: ProblemDetailProps) {
  const { solveCount, handleSolve, addWrong } = useLesson35()
  const count = solveCount[problem.id] ?? 0
  const level = getMasteryLevel(count)

  const { answer, setAnswer, feedback, check } = useProblemAnswer(problem, {
    handleSolve,
    addWrong,
  })

  const question = (
    <div className="flex flex-col gap-4 min-[900px]:flex-row min-[900px]:items-start">
      {/* Left column: text + analysis + blocks */}
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

  const solution = (
    <div>
      <div className="flex flex-col gap-4 min-[900px]:flex-row min-[900px]:items-start">
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
        {problem.type !== 'none' && (
          <>
            <div className="mb-3 flex items-center gap-2">
              <div className="bg-border-light h-px flex-1" />
              <div className="text-text-muted text-xs font-semibold whitespace-nowrap">
                🧱 拆解图（直观理解）
              </div>
              <div className="bg-border-light h-px flex-1" />
            </div>

            {problem.type === 'ratio3b' ? (
              problem.dualSc ? (
                <DualBlockDiagram config={problem.dualSc} probId={problem.id} />
              ) : (
                <div className="text-text-muted mb-3 rounded-lg border border-[#e0e4ff] bg-[#f8f9ff] p-3.5 text-xs">
                  拆解图暂不支持此题型
                </div>
              )
            ) : problem.blockScene ? (
              <BlockDiagram scene={problem.blockScene} probId={problem.id} />
            ) : (
              <div className="text-text-muted mb-3 rounded-lg border border-[#e0e4ff] bg-[#f8f9ff] p-3.5 text-xs">
                拆解图暂不支持此题型
              </div>
            )}
          </>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {/* Right-column diagram — custom prop takes priority; falls back to built-in 倍比图 */}
        {problem.type !== 'none' && (
          <>
            <div className="mb-3 flex items-center gap-2">
              <div className="bg-border-light h-px flex-1" />
              <div className="text-text-muted text-xs font-semibold whitespace-nowrap">
                📊 倍比图
              </div>
              <div className="bg-border-light h-px flex-1" />
            </div>
            <RatioDiagram problem={problem} />
          </>
        )}
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
        buttonClassName="bg-app-blue shadow-[0_3px_10px_rgba(59,130,246,0.3)]"
      />

      {tip && (
        <div className="bg-app-green-light text-app-green-dark rounded-lg px-3 py-2.5 text-xs leading-relaxed">
          💡 <strong>口诀：</strong>
          {tip}
        </div>
      )}
    </div>
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
