'use client'

import { useMemo } from 'react'
import { useDraftQuery } from '@rosie/math-kit/hooks/useDraftQuery'
import Link from 'next/link'
import type { Problem, ProblemSet } from '@rosie/core'
import { useAuth } from '@rosie/core'
import { SOURCE_LABELS } from '@rosie/core'
import { getMasteryLevel, MASTERY_BORDER, MASTERY_BADGE_BG, MASTERY_ICON } from '@rosie/core'
import { MistakeDraftButton } from '@rosie/math-kit/components/shared/ScratchPad/ScratchPadTrigger'
import { useLessonScratchActions } from '@rosie/math-kit/components/shared/ScratchPad/LessonScratchActionsContext'
import { fetchWrongDraftProblemIds } from '@rosie/math-kit/utils/math-scratch-db'
import { useStartPracticeQueue } from '@rosie/math-kit/components/shared/practice-queue/useStartPracticeQueue'
import { lessonKeyFromHref } from '@rosie/math-kit/utils/lesson-grade'
import type { PracticeQueueItem } from '@rosie/math-kit/utils/practice-queue-types'
import { problemDisplayId } from '@rosie/math-kit/utils/problem-display-id'
import { Button } from '@rosie/ui/themes'

type TagStyleMap = Record<string, string>

type Props = {
  basePath: string
  problems: ProblemSet
  tagStyle: TagStyleMap
  wrongIds: Set<string>
  practiceCount: Record<string, number>
  correctCount: Record<string, number>
  accentClass?: string
}

function buildProblemMap(
  problems: ProblemSet,
): Map<string, { p: Problem; setName: string; idx: number }> {
  const map = new Map<string, { p: Problem; setName: string; idx: number }>()
  for (const [setName, list] of Object.entries(problems) as [string, Problem[]][]) {
    list.forEach((p, i) => map.set(p.id, { p, setName, idx: i }))
  }
  return map
}

function MistakeRow({
  item,
  index,
  wrongProblems,
  practiceCount,
  correctCount,
  tagStyle,
  hasDraft,
  onPractice,
}: {
  item: { p: Problem; setName: string; idx: number }
  index: number
  wrongProblems: Problem[]
  practiceCount: Record<string, number>
  correctCount: Record<string, number>
  tagStyle: TagStyleMap
  hasDraft: boolean
  onPractice: () => void
}) {
  const scratchActions = useLessonScratchActions()
  const { p } = item
  const count = practiceCount[p.id] ?? 0
  const correct = correctCount[p.id] ?? 0
  const level = getMasteryLevel(correct)
  const isMastered = correct >= 3
  const srcLabel = SOURCE_LABELS[item.setName] || item.setName

  return (
    // native-ok: 整行错题卡片（图标 + 标题 + 多枚标签），按掌握度着色，Radix Button 会居中挤压
    <button
      type="button"
      onClick={onPractice}
      className={`shadow-sticker-sm hover:shadow-sticker-sm flex w-full cursor-pointer items-center gap-3 rounded-[12px] border-[1.5px] bg-white p-3 text-left transition-all active:scale-[0.99] ${
        isMastered ? 'border-app-green opacity-70' : `border-[#fca5a5] ${MASTERY_BORDER[level]}`
      }`}
    >
      <div
        className={`flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full text-sm ${MASTERY_BADGE_BG[level]}`}
      >
        {MASTERY_ICON[level]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-text-primary text-[13px] font-semibold">
          {problemDisplayId(p)} · {p.title}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-1">
          <span
            className={`rounded-full px-2 py-px text-[10px] font-semibold ${tagStyle[p.tag] || 'bg-gray-100 text-gray-600'}`}
          >
            {p.tagLabel}
          </span>
          <span className="rounded-full bg-orange-100 px-2 py-px text-[10px] font-semibold text-orange-700">
            {srcLabel}
          </span>
          {hasDraft && (
            <span className="rounded-full bg-indigo-100 px-2 py-px text-[10px] font-bold text-indigo-700">
              有草稿
            </span>
          )}
          {count > 0 && (
            <span className="text-text-muted rounded-full bg-gray-100 px-2 py-px text-[10px]">
              已练 {count} 次
            </span>
          )}
        </div>
      </div>
      <div
        className="flex shrink-0 items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <MistakeDraftButton
          problem={p}
          draftLookupIds={[p.id]}
          problems={wrongProblems}
          problemIndex={index}
          onSolve={scratchActions?.onSolve}
          onWrong={scratchActions?.onWrong}
          onResolved={scratchActions?.onResolved}
        />
      </div>
    </button>
  )
}

export default function LessonMistakesPage({
  basePath,
  problems,
  tagStyle,
  wrongIds,
  practiceCount,
  correctCount,
}: Props) {
  const { user } = useAuth()
  const startPractice = useStartPracticeQueue()
  const lessonId = lessonKeyFromHref(basePath) ?? ''

  const problemMap = buildProblemMap(problems)
  const wrongList = [...wrongIds].map((id) => problemMap.get(id)).filter(Boolean) as {
    p: Problem
    setName: string
    idx: number
  }[]
  const wrongProblems = wrongList.map((x) => x.p)
  const masteredCount = wrongList.filter(({ p }) => (correctCount[p.id] ?? 0) >= 3).length

  const mistakePool = useMemo(
    (): PracticeQueueItem[] =>
      wrongList.map(({ p, setName, idx }) => ({
        problem: p,
        section: setName,
        lessonId,
        detailHref: `${basePath}/${setName}/${idx + 1}`,
      })),
    [wrongList, lessonId, basePath],
  )

  const beginPractice = (initialProblemId?: string) => {
    if (mistakePool.length === 0) return
    startPractice({
      pool: mistakePool,
      source: 'mistakes',
      title: '错题练习',
      initialProblemId,
      returnHref: `${basePath}/mistakes`,
    })
  }

  const wrongIdsKey = useMemo(() => [...wrongIds].sort().join('\0'), [wrongIds])

  const userId = user?.id
  const loadDrafts = useMemo(
    () =>
      userId && wrongIdsKey
        ? () => fetchWrongDraftProblemIds(userId, wrongIdsKey.split('\0'))
        : null,
    [userId, wrongIdsKey],
  )
  const draftProblemIds = useDraftQuery(loadDrafts)

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-[#fecaca] bg-[#ffedd5] p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-extrabold text-[#991b1b]">
          📕 错题本
          {wrongList.length > 0 && (
            <span className="rounded-full bg-[#fca5a5] px-2 py-0.5 text-[11px] font-bold text-[#7f1d1d]">
              {wrongList.length} 题
            </span>
          )}
        </div>
        <div className="mb-2 text-xs text-[#b91c1c]">答错的题目会自动收录 · 答对后自动移除</div>
        {wrongList.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative h-[5px] flex-1 overflow-hidden rounded-full bg-[#fecaca]">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[#f87171] transition-[width] duration-500"
                style={{ width: `${Math.round((masteredCount / wrongList.length) * 100)}%` }}
              />
            </div>
            <div className="shrink-0 text-[11px] font-bold text-[#991b1b]">
              已改正 {masteredCount}/{wrongList.length}
            </div>
          </div>
        )}
        {wrongList.length > 0 && (
          <Button
            type="button"
            onClick={() => beginPractice()}
            variant="solid"
            color="orange"
            size="1"
            className="mt-2"
          >
            一键练习（{wrongList.length} 题）
          </Button>
        )}
      </div>

      {wrongList.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="text-5xl">🎉</div>
          <div className="text-text-primary text-[15px] font-bold">错题本是空的！</div>
          <div className="text-text-muted text-[13px]">答错的题目会自动出现在这里</div>
          <Link
            href={basePath}
            className="shadow-sticker-sm mt-2 rounded-full bg-orange-500 px-5 py-2 text-[13px] font-semibold text-white no-underline"
          >
            去做题 →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {wrongList.map((item, index) => (
            <MistakeRow
              key={item.p.id}
              item={item}
              index={index}
              wrongProblems={wrongProblems}
              practiceCount={practiceCount}
              correctCount={correctCount}
              tagStyle={tagStyle}
              hasDraft={draftProblemIds?.has(item.p.id) ?? false}
              onPractice={() => beginPractice(item.p.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
