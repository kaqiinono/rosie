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
  const { problem, section, lessonId, helpProblems = [] } = item
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
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpIndex, setHelpIndex] = useState(0)
  const helpItem = helpProblems[helpIndex]
  const helpProblem = helpItem?.problem
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

  const help = helpProblem ? (
    <section className="mb-5 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 shadow-[0_8px_24px_rgba(245,158,11,0.18)] ring-2 ring-amber-100">
      <button
        type="button"
        onClick={() => setHelpOpen((open) => !open)}
        aria-expanded={helpOpen}
        className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[14px] bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-3 text-left text-white transition-all hover:brightness-105 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/90 text-xl shadow-sm" aria-hidden="true">💡</span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-black">不会做？先看同题型例题</span>
          <span className="block text-xs font-semibold text-amber-50">共 {helpProblems.length} 道带题解的学习卡片</span>
        </span>
        <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold" aria-hidden="true">{helpOpen ? '收起 ↑' : '打开 ↓'}</span>
      </button>
      {helpOpen && (
        <div className="relative border-t border-amber-300 py-4">
          <button
            type="button"
            onClick={() => setHelpIndex((index) => Math.max(0, index - 1))}
            disabled={helpIndex === 0}
            aria-label="查看上一道同题型例题"
            title="上一题"
            className="absolute top-1/2 -left-3 z-10 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-amber-300 bg-white/95 text-amber-800 shadow-[0_4px_14px_rgba(180,83,9,0.22)] backdrop-blur transition-all hover:scale-105 hover:bg-amber-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:cursor-not-allowed disabled:opacity-30 sm:-left-6"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setHelpIndex((index) => Math.min(helpProblems.length - 1, index + 1))}
            disabled={helpIndex >= helpProblems.length - 1}
            aria-label="查看下一道同题型例题"
            title="下一题"
            className="absolute top-1/2 -right-3 z-10 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-orange-300 bg-orange-500 text-white shadow-[0_4px_14px_rgba(234,88,12,0.3)] transition-all hover:scale-105 hover:bg-orange-600 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700 disabled:cursor-not-allowed disabled:opacity-30 sm:-right-6"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="px-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="min-w-0 flex-1 text-sm font-extrabold text-text-primary">{helpProblem.title}</div>
              <span className="shrink-0 rounded-full border border-orange-200 bg-white px-2.5 py-1 text-xs font-bold text-orange-700">
                {problemSetSectionLabel(helpItem.section, lessonId)}
              </span>
              <span className="shrink-0 rounded-full bg-amber-200 px-2.5 py-1 text-xs font-black text-amber-900" aria-live="polite">
                {helpIndex + 1} / {helpProblems.length}
              </span>
            </div>
            <div
              className="mb-4 rounded-xl border border-amber-200 border-l-4 border-l-orange-400 bg-white px-3.5 py-3 text-sm leading-relaxed text-text-secondary shadow-sm [&>strong]:font-bold [&>strong]:text-text-primary"
              dangerouslySetInnerHTML={{ __html: sanitizeProblemText(helpProblem.text) }}
            />
            {helpProblem.figureNode && <div className="mb-4">{helpProblem.figureNode}</div>}
            <ProblemSolutionPanel
              problem={helpProblem}
              heading="例题讲解"
              headingIcon="💡"
              variant="amber"
            />
            <p className="mt-3 text-center text-xs leading-relaxed text-amber-800">看懂例题后，收起帮助再完成自己的题目。</p>
          </div>
        </div>
      )}
    </section>
  ) : null

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
      {help}
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
