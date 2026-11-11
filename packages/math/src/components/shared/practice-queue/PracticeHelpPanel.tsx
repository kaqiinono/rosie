'use client'

import { useState } from 'react'
import type { PracticeHelpProblem } from '@rosie/math-kit/utils/practice-queue-types'
import { sanitizeProblemText } from '@rosie/math-kit/utils/sanitize-problem-text'
import { problemSetSectionLabel } from '@rosie/math-kit/utils/problem-set-helpers'
import { problemDisplayId } from '@rosie/math-kit/utils/problem-display-id'
import ProblemSolutionPanel from '@rosie/math-kit/components/shared/ProblemSolutionPanel'
import { IconButton } from '@rosie/ui/themes'

export default function PracticeHelpPanel({
  helpProblems,
  lessonId,
}: {
  helpProblems: PracticeHelpProblem[]
  lessonId: string
}) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const item = helpProblems[index]
  const problem = item?.problem

  if (!problem) return null

  return (
    <section className="shadow-sticker mb-5 rounded-2xl border-2 border-amber-300 bg-amber-50 ring-2 ring-amber-100">
      <button // native-ok: 整块可点击容器（内含多行内容），Radix Button 是 inline-flex 居中，不适用
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[14px] bg-orange-600 px-4 py-3 text-left text-white transition-all hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 active:scale-[0.99]"
      >
        <span
          className="shadow-sticker-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xl"
          aria-hidden="true"
        >
          💡
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-black">不会做？先看同题型例题</span>
          <span className="block text-xs font-semibold text-amber-50">
            共 {helpProblems.length} 道带题解的学习卡片
          </span>
        </span>
        <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold" aria-hidden="true">
          {open ? '收起 ↑' : '打开 ↓'}
        </span>
      </button>
      {open && (
        <div className="relative border-t border-amber-300 py-4">
          <IconButton
            type="button"
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
            disabled={index === 0}
            aria-label="查看上一道同题型例题"
            title="上一题"
            variant="outline"
            color="amber"
            size="3"
            className="absolute top-1/2 z-10 w-11 sm:-left-6"
          >
            ‹
          </IconButton>
          <IconButton
            type="button"
            onClick={() => setIndex((value) => Math.min(helpProblems.length - 1, value + 1))}
            disabled={index >= helpProblems.length - 1}
            aria-label="查看下一道同题型例题"
            title="下一题"
            variant="solid"
            color="orange"
            size="3"
            className="absolute top-1/2 z-10 w-11 sm:-right-6"
          >
            ›
          </IconButton>
          <div className="px-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold whitespace-nowrap text-amber-900">
                {problemDisplayId(problem)}
              </span>
              <div className="text-text-primary min-w-0 flex-1 text-sm font-extrabold">
                {problem.title}
              </div>
              <span className="shrink-0 rounded-full border border-orange-200 bg-white px-2.5 py-1 text-xs font-bold text-orange-700">
                {problemSetSectionLabel(item.section, lessonId)}
              </span>
              <span
                className="shrink-0 rounded-full bg-amber-200 px-2.5 py-1 text-xs font-black text-amber-900"
                aria-live="polite"
              >
                {index + 1} / {helpProblems.length}
              </span>
            </div>
            <div
              className="text-text-secondary shadow-sticker-sm [&>strong]:text-text-primary mb-4 rounded-xl border border-l-4 border-amber-200 border-l-orange-400 bg-white px-3.5 py-3 text-sm leading-relaxed [&>strong]:font-bold"
              dangerouslySetInnerHTML={{ __html: sanitizeProblemText(problem.text) }}
            />
            {problem.figureNode && <div className="mb-4">{problem.figureNode}</div>}
            <ProblemSolutionPanel
              problem={problem}
              heading="例题讲解"
              headingIcon="💡"
              variant="amber"
            />
            <p className="mt-3 text-center text-xs leading-relaxed text-amber-800">
              看懂例题后，收起帮助再完成自己的题目。
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
