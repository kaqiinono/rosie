'use client'

import { sanitizeProblemText } from '@rosie/math-kit/utils/sanitize-problem-text'

import { useCallback, useState } from 'react'
import type { AnswerCheckResult } from '@rosie/core'
import { useAuth } from '@rosie/core'
import { useMathWrong } from '@rosie/math-kit/hooks/useMathWrong'
import { SEA_LESSON_MAP } from '@rosie/math/utils/sea-data'
import { problemSetSectionLabel } from '@rosie/math-kit/utils/problem-set-helpers'
import QuestionLayout from '@rosie/math-kit/components/shared/QuestionLayout'
import ProblemSolutionPanel from '@rosie/math-kit/components/shared/ProblemSolutionPanel'
import { useProblemAnswer } from '@rosie/math-kit/hooks/useProblemAnswer'
import { getProblemAnswerMode } from '@rosie/math-kit/utils/problem-answer-mode'
import FavoriteHeart from '@rosie/math-kit/components/shared/FavoriteHeart'
import DifficultyStars from '@rosie/math-kit/components/shared/DifficultyStars'
import { submitPracticeAttempt } from '@rosie/math-kit/utils/submitPracticeAttempt'
import { findInProgressAttempt } from '@rosie/math-kit/utils/math-scratch-db'
import type { PracticeQueueItem } from '@rosie/math-kit/utils/practice-queue-types'
import ProblemAnswerSection from '@rosie/math-kit/components/shared/ProblemAnswerSection'

type Props = {
  item: PracticeQueueItem
  onAnswerCorrect: () => void
  onAnswerWrong: () => void
  onAdvance: () => void
  isLast?: boolean
}

type AttemptReveal = {
  problemId: string
  /** Auto-expand 题解 (e.g. after 不会). */
  openSolution: boolean
}

type DontKnowFeedback = {
  problemId: string
  result: AnswerCheckResult
}

export default function PracticeProblemBody({
  item,
  onAnswerCorrect,
  onAnswerWrong,
  onAdvance,
  isLast = false,
}: Props) {
  const { problem, section, lessonId } = item
  const lesson = SEA_LESSON_MAP[lessonId]
  const tagStyle = lesson?.tagStyle?.[problem.tag] ?? 'bg-gray-100 text-gray-600'
  const answerMode = getProblemAnswerMode(problem)
  const isCustomWidget = answerMode === 'custom-widget'
  const { user } = useAuth()
  const { addWrong } = useMathWrong(user)

  const persistAttempt = useCallback(
    async (correct: boolean, snapshot: unknown) => {
      if (!user) return
      try {
        const inProgress = await findInProgressAttempt(user.id, problem.id, null)
        await submitPracticeAttempt({
          userId: user.id,
          problem,
          section,
          correct,
          objects: inProgress?.objects ?? [],
          answerSnapshot: snapshot,
          paperId: null,
          attemptId: inProgress?.id ?? null,
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
        void persistAttempt(false, isCustomWidget ? undefined : answer)
        onAnswerWrong()
      },
    },
    {
      onCorrect: () => {
        void persistAttempt(true, isCustomWidget ? undefined : answer)
        void onAnswerCorrect()
      },
    },
  )

  // Stick after first real submit so editing the answer does not hide 查看题解 again.
  const [reveal, setReveal] = useState<AttemptReveal | null>(null)
  const [dontKnowFeedback, setDontKnowFeedback] = useState<DontKnowFeedback | null>(null)
  const hasAttempted = reveal?.problemId === problem.id
  const autoOpenSolution = reveal?.problemId === problem.id && reveal.openSolution
  const panelFeedback =
    feedback ?? (dontKnowFeedback?.problemId === problem.id ? dontKnowFeedback.result : null)

  const markAttempted = useCallback(
    (openSolution = false) => {
      setReveal({ problemId: problem.id, openSolution })
    },
    [problem.id],
  )

  const submitAndReveal = useCallback(
    (input: unknown) => {
      const result = submit(input)
      if (result.ok || result.message) {
        setDontKnowFeedback(null)
        markAttempted(false)
      }
      return result
    },
    [submit, markAttempted],
  )

  const checkAndReveal = useCallback(() => {
    const result = check()
    if (result.ok || result.message) {
      setDontKnowFeedback(null)
      markAttempted(false)
    }
    return result
  }, [check, markAttempted])

  const handleDontKnow = useCallback(() => {
    if (hasAttempted) return
    addWrong(problem.id)
    void persistAttempt(false, { reason: 'dont_know' })
    onAnswerWrong()
    setDontKnowFeedback({
      problemId: problem.id,
      result: { ok: false, message: '已加入错题集，看看题解吧' },
    })
    markAttempted(true)
  }, [hasAttempted, addWrong, problem.id, persistAttempt, onAnswerWrong, markAttempted])

  const handleAnswerChange = useCallback(
    (value: string) => {
      setAnswer(value)
      setDontKnowFeedback(null)
      clearFeedback()
    },
    [setAnswer, clearFeedback],
  )

  const handleStateChange = useCallback(() => {
    clearFeedback()
    setDontKnowFeedback(null)
  }, [clearFeedback])

  const figure = !isCustomWidget && problem.figureNode ? problem.figureNode : null

  const displayFeedback = panelFeedback
    ? {
        ok: panelFeedback.ok,
        text: panelFeedback.ok ? '🎉 完全正确！' : panelFeedback.message,
      }
    : null

  const usedDontKnow = hasAttempted && autoOpenSolution

  const trailingAction = !hasAttempted ? (
    <button
      type="button"
      onClick={handleDontKnow}
      className="cursor-pointer rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-[13px] font-semibold text-rose-600 transition-all hover:bg-rose-100 active:scale-[0.96]"
    >
      不会
    </button>
  ) : usedDontKnow ? (
    <button
      type="button"
      onClick={onAdvance}
      className="cursor-pointer rounded-full bg-app-blue px-4 py-2 text-[13px] font-semibold text-white shadow-[0_3px_10px_rgba(59,130,246,0.3)] transition-all hover:brightness-105 active:scale-[0.96]"
    >
      {isLast ? '完成' : '下一题'}
    </button>
  ) : null

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
        dangerouslySetInnerHTML={{ __html: sanitizeProblemText(problem.text) }}
      />
      {figure && <div>{figure}</div>}
      {isCustomWidget && displayFeedback?.text && (
        <div className={`text-[13px] font-medium ${displayFeedback.ok ? 'text-emerald-600' : 'text-rose-500'}`}>
          {displayFeedback.text}
        </div>
      )}
    </div>
  )

  const solution = <ProblemSolutionPanel problem={problem} variant="amber" />

  const answerDom = (
    <ProblemAnswerSection
      problem={problem}
      answer={answer}
      onAnswerChange={handleAnswerChange}
      feedback={panelFeedback}
      onSubmit={submitAndReveal}
      onCheck={checkAndReveal}
      onStateChange={handleStateChange}
      buttonClassName="bg-app-blue shadow-[0_3px_10px_rgba(59,130,246,0.3)]"
      puzzleWrapperClassName="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3.5"
      trailingActions={trailingAction}
    />
  )

  return (
    <div className="practice-overlay-enter">
      <div className="mb-3 flex items-center gap-2">
        <div className="min-w-0 flex-1 text-[15px] font-bold text-text-primary">{problem.title}</div>
        <FavoriteHeart problemId={problem.id} size="sm" />
      </div>
      <QuestionLayout
        question={question}
        solution={solution}
        answer={answerDom}
        solutionAvailable={hasAttempted}
        showSolutionToggle={!usedDontKnow}
        defaultSolutionOpen={autoOpenSolution}
        problemId={problem.id}
        problem={problem}
      />
    </div>
  )
}
