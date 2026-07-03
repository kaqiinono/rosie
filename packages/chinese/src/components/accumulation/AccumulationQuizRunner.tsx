'use client'

import { useCallback, useMemo, useState } from 'react'
import clsx from 'clsx'
import type { AccumulationQuizItem } from '../../utils/chinese-accumulation-helpers'
import { ACCUMULATION_KIND_LABEL } from '../../utils/chinese-accumulation-helpers'

interface AccumulationQuizRunnerProps {
  items: AccumulationQuizItem[]
  onComplete?: (results: { id: string; correct: boolean }[]) => void
}

export default function AccumulationQuizRunner({ items, onComplete }: AccumulationQuizRunnerProps) {
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [results, setResults] = useState<{ id: string; correct: boolean }[]>([])

  const current = items[idx]
  const answered = selected !== null
  const finished = idx >= items.length

  const handleSelect = useCallback(
    (choice: string) => {
      if (!current || answered) return
      setSelected(choice)
      setResults((prev) => [...prev, { id: current.id, correct: choice === current.answer }])
    },
    [answered, current],
  )

  const handleNext = useCallback(() => {
    if (idx + 1 >= items.length) {
      onComplete?.(results)
      setIdx(items.length)
      return
    }
    setIdx((i) => i + 1)
    setSelected(null)
  }, [idx, items.length, onComplete, results])

  if (items.length === 0) {
    return <p className="text-center text-sm text-slate-500">暂无题目</p>
  }

  if (finished) {
    const score = results.filter((r) => r.correct).length
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-lg font-bold text-emerald-800">完成！</p>
        <p className="mt-1 text-sm text-emerald-700">
          {score} / {items.length} 正确
        </p>
      </div>
    )
  }

  if (!current) return null

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <div className="text-center">
        <p className="text-xs font-semibold text-teal-600">
          第 {idx + 1} / {items.length} 题 · {ACCUMULATION_KIND_LABEL[current.kind]}
        </p>
        <p className="mt-4 text-xl font-bold leading-relaxed text-slate-900">{current.prompt}</p>
      </div>

      <div className="flex flex-col gap-2">
        {current.options.map((opt) => {
          const isCorrect = opt === current.answer
          const isChosen = selected === opt
          return (
            <button
              key={opt}
              type="button"
              disabled={answered}
              onClick={() => handleSelect(opt)}
              className={clsx(
                'rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition-colors',
                !answered && 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50',
                answered && isCorrect && 'border-emerald-400 bg-emerald-50 text-emerald-800',
                answered && isChosen && !isCorrect && 'border-rose-400 bg-rose-50 text-rose-700',
                answered && !isChosen && !isCorrect && 'border-slate-100 bg-slate-50 text-slate-400',
              )}
            >
              {opt}
            </button>
          )
        })}
      </div>

      {answered && (
        <button
          type="button"
          onClick={handleNext}
          className="rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white hover:bg-teal-700"
        >
          {idx + 1 >= items.length ? '查看结果' : '下一题'}
        </button>
      )}
    </div>
  )
}
