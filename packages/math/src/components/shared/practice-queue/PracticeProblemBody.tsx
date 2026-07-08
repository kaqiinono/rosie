'use client'

import { useCallback, useMemo } from 'react'
import { useAuth } from '@rosie/core'
import { useMathWrong } from '@rosie/math/hooks/useMathWrong'
import { SEA_LESSON_MAP } from '@rosie/math/utils/sea-data'
import { problemSetSectionLabel } from '@rosie/math/utils/problem-set-helpers'
import QuestionLayout from '@rosie/math/components/shared/QuestionLayout'
import ProblemSolutionPanel from '@rosie/math/components/shared/ProblemSolutionPanel'
import { injectFigureGridCallbacks } from '@rosie/math/components/shared/injectFigureSubmit'
import { useProblemAnswer } from '@rosie/math/hooks/useProblemAnswer'
import { isInteractiveProblem } from '@rosie/math/utils/check-problem-answer'
import FavoriteHeart from '@rosie/math/components/shared/FavoriteHeart'
import DifficultyStars from '@rosie/math/components/shared/DifficultyStars'
import { submitPracticeAttempt } from '@rosie/math/utils/submitPracticeAttempt'
import type { PracticeQueueItem } from '@rosie/math/utils/practice-queue-types'

type Props = {
  item: PracticeQueueItem
  onAnswerCorrect: () => void
  onAnswerWrong: () => void
}

export default function PracticeProblemBody({
  item,
  onAnswerCorrect,
  onAnswerWrong,
}: Props) {
  const { problem, section, lessonId } = item
  const lesson = SEA_LESSON_MAP[lessonId]
  const tagStyle = lesson?.tagStyle?.[problem.tag] ?? 'bg-gray-100 text-gray-600'
  const interactive = isInteractiveProblem(problem)
  const { user } = useAuth()
  const { addWrong } = useMathWrong(user)

  const persistAttempt = useCallback(
    async (correct: boolean, snapshot: unknown) => {
      if (!user) return
      try {
        await submitPracticeAttempt({
          userId: user.id,
          problem,
          section,
          correct,
          objects: [],
          answerSnapshot: snapshot,
          paperId: null,
        })
      } catch {
        // Draft/attempt persistence must not block advancing the practice queue.
      }
    },
    [user, problem, section],
  )

  const { answer, setAnswer, feedback, submit, check, clearFeedback } = useProblemAnswer(
    problem,
    {
      // Mastery + queue advance are handled by PracticeQueueContext.onAnswerCorrect.
      handleSolve: () => {},
      addWrong: (id) => {
        addWrong(id)
        void persistAttempt(false, interactive ? undefined : answer)
        onAnswerWrong()
      },
    },
    {
      onCorrect: () => {
        void persistAttempt(true, interactive ? undefined : answer)
        void onAnswerCorrect()
      },
    },
  )

  const figure = useMemo(
    () =>
      interactive
        ? injectFigureGridCallbacks(problem.figureNode, {
            onSubmit: submit,
            onStateChange: clearFeedback,
          })
        : problem.figureNode,
    [interactive, problem.figureNode, submit, clearFeedback],
  )

  const displayFeedback = feedback
    ? {
        ok: feedback.ok,
        text: feedback.ok ? '🎉 完全正确！' : feedback.message,
      }
    : null

  const question = (
    <div className="flex flex-col gap-1.5">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tagStyle}`}>
          {problem.tagLabel}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${lesson?.badgeClass ?? 'bg-gray-100 text-gray-600'}`}
        >
          {lesson?.icon} {lesson?.shortTitle}
        </span>
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">
          {problemSetSectionLabel(section, lessonId)}
        </span>
        <DifficultyStars level={problem.difficulty} size="sm" />
      </div>
      <div
        className="mb-3.5 rounded-lg border-l-4 border-app-blue bg-app-blue-light/40 px-3.5 py-3 text-sm leading-relaxed text-text-secondary [&>strong]:font-bold [&>strong]:text-text-primary"
        dangerouslySetInnerHTML={{ __html: problem.text }}
      />
      {figure && <div>{figure}</div>}
      {interactive && displayFeedback?.text && (
        <div className={`text-[13px] font-medium ${displayFeedback.ok ? 'text-emerald-600' : 'text-rose-500'}`}>
          {displayFeedback.text}
        </div>
      )}
    </div>
  )

  const solution = <ProblemSolutionPanel problem={problem} variant="amber" />

  const answerDom = interactive ? (
    <div className="flex items-center justify-end">
      <FavoriteHeart problemId={problem.id} size="sm" />
    </div>
  ) : (
    <>
      <div className="mb-3 flex items-center gap-2">
        <div className="h-px flex-1 bg-gray-200" />
        <div className="whitespace-nowrap text-xs font-semibold text-gray-400">✏️ 写出答案</div>
        <div className="h-px flex-1 bg-gray-200" />
      </div>
      <div className="mb-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3.5">
        <div className="text-[13px] text-gray-600">{problem.finalQ}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <input
            type="number"
            className="w-[72px] rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-center text-sm text-gray-800 focus:border-app-blue focus:outline-none focus:ring-2 focus:ring-app-blue-light"
            placeholder="？"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && check()}
          />
          <span className="text-gray-600">{problem.finalUnit}</span>
          <button
            type="button"
            onClick={() => check()}
            className="cursor-pointer rounded-full bg-app-blue px-4 py-1.5 text-[13px] font-semibold text-white shadow-[0_3px_10px_rgba(59,130,246,0.3)] transition-all active:scale-95"
          >
            检查答案
          </button>
        </div>
        {displayFeedback && (
          <div className={`mt-2 text-[13px] font-medium ${displayFeedback.ok ? 'text-emerald-600' : 'text-rose-500'}`}>
            {displayFeedback.text}
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <FavoriteHeart problemId={problem.id} size="sm" />
      </div>
    </>
  )

  return (
    <div className="practice-overlay-enter">
      <div className="mb-3 text-[15px] font-bold text-text-primary">{problem.title}</div>
      <QuestionLayout
        question={question}
        solution={solution}
        answer={answerDom}
        problemId={problem.id}
        problem={problem}
      />
    </div>
  )
}
