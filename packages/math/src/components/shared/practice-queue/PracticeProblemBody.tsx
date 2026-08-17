'use client'

import { useMemo, useState } from 'react'
import type { AnswerCheckResult } from '@rosie/core'
import FavoriteHeart from '@rosie/math-kit/components/shared/FavoriteHeart'
import DifficultyStars from '@rosie/math-kit/components/shared/DifficultyStars'
import ProblemDraftActions from '@rosie/math-kit/components/shared/ProblemDraftActions'
import { ProblemScratchProvider } from '@rosie/math-kit/components/shared/ScratchPad/ProblemScratchContext'
import { ProblemWorkspaceRuntimeProvider } from '@rosie/math-kit/components/shared/ProblemWorkspaceRuntime'
import type { PracticeQueueItem } from '@rosie/math-kit/utils/practice-queue-types'
import { problemSetSectionLabel } from '@rosie/math-kit/utils/problem-set-helpers'
import { lessonModuleByKey } from '@rosie/math/utils/lesson-module-registry'
import { SEA_LESSON_MAP } from '@rosie/math/utils/sea-data'
import PracticeHelpPanel from './PracticeHelpPanel'

type Props = {
  item: PracticeQueueItem
  onAnswerCorrect: () => void | Promise<void>
  onAnswerWrong: () => void
  onAdvance: () => void
  onOpenScratch?: () => void
  isLast?: boolean
}

export default function PracticeProblemBody({
  item,
  onAnswerCorrect,
  onAnswerWrong,
  onAdvance,
  onOpenScratch,
  isLast = false,
}: Props) {
  const { problem, section, lessonId, helpProblems = [] } = item
  const lessonModule = lessonModuleByKey(lessonId)
  const lesson = SEA_LESSON_MAP[lessonId]
  const [dontKnowUsed, setDontKnowUsed] = useState(false)
  const [correctUsed, setCorrectUsed] = useState(false)

  const followup = useMemo(
    () => (
      <button
        type="button"
        onClick={() => {
          if (correctUsed) void Promise.resolve(onAnswerCorrect())
          else onAdvance()
        }}
        className="cursor-pointer rounded-full bg-app-blue px-4 py-2 text-[13px] font-semibold text-white shadow-[0_3px_10px_rgba(59,130,246,0.3)] transition-all hover:brightness-105 active:scale-[0.96]"
      >
        {isLast ? '完成' : '下一题'}
      </button>
    ),
    [correctUsed, onAnswerCorrect, onAdvance, isLast],
  )

  const runtime = useMemo(
    () => ({
      onCorrect: (_answerSnapshot: unknown, _result: AnswerCheckResult) => {
        setCorrectUsed(true)
      },
      onWrong: async (_answerSnapshot: unknown, _result: AnswerCheckResult) => {
        onAnswerWrong()
      },
      onDontKnow: async () => {
        onAnswerWrong()
        setDontKnowUsed(true)
      },
      dontKnowUsed,
      dontKnowFollowup: followup,
      correctFollowup: correctUsed ? followup : undefined,
      defaultSolutionOpen: dontKnowUsed,
      showSolutionToggle: !dontKnowUsed,
      onPaperArchived: (correct: boolean) => {
        if (correct) setCorrectUsed(true)
        else onAnswerWrong()
      },
      onOpenScratch,
    }),
    [onAnswerWrong, dontKnowUsed, correctUsed, followup, onOpenScratch],
  )

  const scratchContext = useMemo(
    () => ({
      sectionProblems: [problem],
      section,
      problemIndex: 0,
      basePath: item.detailHref,
    }),
    [problem, section, item.detailHref],
  )

  if (!lessonModule) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
        当前题目的讲次组件不可用，请退出后重试。
      </div>
    )
  }

  const Detail = lessonModule.ProblemDetail
  const Provider = lessonModule.Provider

  return (
    <ProblemScratchProvider value={scratchContext}>
      <ProblemWorkspaceRuntimeProvider value={runtime}>
        <Provider>
          <div className="practice-overlay-enter">
            <div className="mb-3 flex items-center gap-2">
              <div className="min-w-0 flex-1 text-[15px] font-bold text-text-primary">
                {problem.title}
              </div>
              <FavoriteHeart problemId={problem.id} size="sm" />
              <ProblemDraftActions problem={problem} />
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${lesson?.tagStyle?.[problem.tag] ?? 'bg-gray-100 text-gray-600'}`}>
                {problem.tagLabel}
              </span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${lesson?.badgeClass ?? 'bg-gray-100 text-gray-600'}`}>
                {lesson?.icon} {lesson?.shortTitle}
              </span>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">
                {problemSetSectionLabel(section, lessonId)}
              </span>
              <DifficultyStars level={problem.difficulty} size="sm" />
            </div>
            <PracticeHelpPanel helpProblems={helpProblems} lessonId={lessonId} />
            <Detail problem={problem} mode="inline" />
          </div>
        </Provider>
      </ProblemWorkspaceRuntimeProvider>
    </ProblemScratchProvider>
  )
}
