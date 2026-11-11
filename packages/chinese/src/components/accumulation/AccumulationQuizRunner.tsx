'use client'

import { useCallback, useState } from 'react'
import type { AccumulationQuizItem } from '../../utils/chinese-accumulation-helpers'
import { ACCUMULATION_KIND_LABEL } from '../../utils/chinese-accumulation-helpers'
import { Button } from '@rosie/ui/themes'

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
        <p className="mt-4 text-xl leading-relaxed font-bold text-slate-900">{current.prompt}</p>
      </div>

      <div className="flex flex-col gap-2">
        {current.options.map((opt) => {
          const isCorrect = opt === current.answer
          const isChosen = selected === opt
          return (
            <Button
              key={opt}
              type="button"
              aria-disabled={answered}
              onClick={() => {
                if (!answered) handleSelect(opt)
              }}
              variant={!answered ? 'outline' : isCorrect || isChosen ? 'solid' : 'soft'}
              color={!answered ? 'gray' : isCorrect ? 'jade' : isChosen ? 'red' : 'gray'}
              size="3"
              radius="full"
              className="w-full"
            >
              {opt}
            </Button>
          )
        })}
      </div>

      {answered && (
        <Button type="button" onClick={handleNext} variant="solid" color="teal" size="3">
          {idx + 1 >= items.length ? '查看结果' : '下一题'}
        </Button>
      )}
    </div>
  )
}
