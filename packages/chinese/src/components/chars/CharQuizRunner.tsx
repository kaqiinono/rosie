'use client'

import { useCallback, useMemo, useState } from 'react'
import clsx from 'clsx'
import { shuffle } from '../../utils/chinese-helpers'

export interface CharQuizItem {
  char: string
  pinyin: string
  charKey: string
}

interface CharQuizRunnerProps {
  items: CharQuizItem[]
  /** Pool of pinyin strings for distractors; defaults to all item pinyins. */
  pinyinPool?: string[]
  onComplete?: (results: { charKey: string; correct: boolean }[]) => void
}

function buildOptions(correct: string, pool: string[], seed: number): string[] {
  const distractors = shuffle(
    pool.filter((p) => p !== correct),
    seed,
  ).slice(0, 3)
  while (distractors.length < 3) {
    distractors.push(correct)
  }
  return shuffle([correct, ...distractors.slice(0, 3)], seed + 1)
}

export default function CharQuizRunner({ items, pinyinPool, onComplete }: CharQuizRunnerProps) {
  const pool = pinyinPool ?? items.map((i) => i.pinyin)
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [results, setResults] = useState<{ charKey: string; correct: boolean }[]>([])

  const current = items[idx]
  const options = useMemo(() => {
    if (!current) return []
    const seed = current.charKey.split('').reduce((s, c) => s * 31 + c.charCodeAt(0), 7) >>> 0
    return buildOptions(current.pinyin, pool, seed)
  }, [current, pool])

  const answered = selected !== null
  const finished = idx >= items.length

  const handleSelect = useCallback(
    (choice: string) => {
      if (!current || answered) return
      setSelected(choice)
      const correct = choice === current.pinyin
      setResults((prev) => [...prev, { charKey: current.charKey, correct }])
    },
    [answered, current],
  )

  const handleNext = useCallback(() => {
    const nextResults = results
    if (idx + 1 >= items.length) {
      onComplete?.(nextResults)
      setIdx(items.length)
      return
    }
    setIdx((i) => i + 1)
    setSelected(null)
  }, [idx, items.length, onComplete, results])

  if (items.length === 0) {
    return <p className="text-center text-sm text-slate-500">暂无测验题目</p>
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
        <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
          第 {idx + 1} / {items.length} 题
        </p>
        <p className="mt-3 text-sm text-slate-500">选出正确的拼音</p>
        <div className="mt-4 flex justify-center">
          <span className="cn-grid-cell">{current.char}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => {
          const isCorrect = opt === current.pinyin
          const isChosen = selected === opt
          return (
            <button
              key={opt}
              type="button"
              disabled={answered}
              onClick={() => handleSelect(opt)}
              className={clsx(
                'rounded-xl border-2 px-4 py-3 text-lg font-semibold transition-colors',
                !answered && 'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50',
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
          className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white hover:bg-sky-700"
        >
          {idx + 1 >= items.length ? '查看结果' : '下一题'}
        </button>
      )}
    </div>
  )
}
