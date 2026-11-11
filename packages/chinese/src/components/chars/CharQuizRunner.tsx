'use client'

import { useCallback, useMemo, useState } from 'react'
import { hashSeed, shuffle } from '../../utils/chinese-helpers'
import { Button } from '@rosie/ui/themes'

export interface CharQuizItem {
  char: string
  pinyin: string
  charKey: string
  phrases?: string[]
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
    const seed = hashSeed(current.charKey, 7)
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
          <span className="cn-grid-cell cn-grid-cell-quiz">{current.char}</span>
        </div>
        {current.phrases && current.phrases.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2" aria-label="组词提示">
            {current.phrases.slice(0, 3).map((phrase) => (
              <span
                key={phrase}
                className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-base font-extrabold text-sky-900"
              >
                {phrase}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => {
          const isCorrect = opt === current.pinyin
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
        <Button type="button" onClick={handleNext} variant="solid" color="sky" size="3">
          {idx + 1 >= items.length ? '查看结果' : '下一题'}
        </Button>
      )}
    </div>
  )
}
