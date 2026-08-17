'use client'

import { useState } from 'react'
import type { PracticeHelpProblem } from '@rosie/math-kit/utils/practice-queue-types'
import { sanitizeProblemText } from '@rosie/math-kit/utils/sanitize-problem-text'
import { problemSetSectionLabel } from '@rosie/math-kit/utils/problem-set-helpers'
import ProblemSolutionPanel from '@rosie/math-kit/components/shared/ProblemSolutionPanel'

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
    <section className="mb-5 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 shadow-[0_8px_24px_rgba(245,158,11,0.18)] ring-2 ring-amber-100">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[14px] bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-3 text-left text-white transition-all hover:brightness-105 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/90 text-xl shadow-sm" aria-hidden="true">💡</span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-black">不会做？先看同题型例题</span>
          <span className="block text-xs font-semibold text-amber-50">共 {helpProblems.length} 道带题解的学习卡片</span>
        </span>
        <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold" aria-hidden="true">{open ? '收起 ↑' : '打开 ↓'}</span>
      </button>
      {open && (
        <div className="relative border-t border-amber-300 py-4">
          <button
            type="button"
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
            disabled={index === 0}
            aria-label="查看上一道同题型例题"
            title="上一题"
            className="absolute top-1/2 -left-3 z-10 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-amber-300 bg-white/95 text-amber-800 shadow-[0_4px_14px_rgba(180,83,9,0.22)] backdrop-blur transition-all hover:scale-105 hover:bg-amber-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 sm:-left-6"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setIndex((value) => Math.min(helpProblems.length - 1, value + 1))}
            disabled={index >= helpProblems.length - 1}
            aria-label="查看下一道同题型例题"
            title="下一题"
            className="absolute top-1/2 -right-3 z-10 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-orange-300 bg-orange-500 text-white shadow-[0_4px_14px_rgba(234,88,12,0.3)] transition-all hover:scale-105 hover:bg-orange-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 sm:-right-6"
          >
            ›
          </button>
          <div className="px-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="min-w-0 flex-1 text-sm font-extrabold text-text-primary">{problem.title}</div>
              <span className="shrink-0 rounded-full border border-orange-200 bg-white px-2.5 py-1 text-xs font-bold text-orange-700">
                {problemSetSectionLabel(item.section, lessonId)}
              </span>
              <span className="shrink-0 rounded-full bg-amber-200 px-2.5 py-1 text-xs font-black text-amber-900" aria-live="polite">
                {index + 1} / {helpProblems.length}
              </span>
            </div>
            <div
              className="mb-4 rounded-xl border border-amber-200 border-l-4 border-l-orange-400 bg-white px-3.5 py-3 text-sm leading-relaxed text-text-secondary shadow-sm [&>strong]:font-bold [&>strong]:text-text-primary"
              dangerouslySetInnerHTML={{ __html: sanitizeProblemText(problem.text) }}
            />
            {problem.figureNode && <div className="mb-4">{problem.figureNode}</div>}
            <ProblemSolutionPanel problem={problem} heading="例题讲解" headingIcon="💡" variant="amber" />
            <p className="mt-3 text-center text-xs leading-relaxed text-amber-800">看懂例题后，收起帮助再完成自己的题目。</p>
          </div>
        </div>
      )}
    </section>
  )
}
