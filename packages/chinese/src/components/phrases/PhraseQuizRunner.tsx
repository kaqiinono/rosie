'use client'

import { useCallback, useMemo, useState } from 'react'
import clsx from 'clsx'
import type { PhraseQuizItem } from '../../utils/chinese-phrase-helpers'
import { buildPhraseOptions } from '../../utils/chinese-phrase-helpers'
import QuizBlankSentence from '../chars/QuizBlankSentence'

interface PhraseQuizRunnerProps {
  items: PhraseQuizItem[]
  charPool: string[]
  onComplete?: (results: { id: string; correct: boolean }[]) => void
}

export default function PhraseQuizRunner({ items, charPool, onComplete }: PhraseQuizRunnerProps) {
  const [idx, setIdx] = useState(0)
  const [wrongFeedback, setWrongFeedback] = useState<{
    selected: string
    correct: string
  } | null>(null)
  const [results, setResults] = useState<{ id: string; correct: boolean }[]>([])

  const current = items[idx]
  const options = useMemo(() => {
    if (!current) return []
    const seed = current.id.split('').reduce((s, c) => s * 31 + c.charCodeAt(0), 11) >>> 0
    return buildPhraseOptions(current, charPool, seed)
  }, [current, charPool])

  const locked = wrongFeedback !== null
  const finished = idx >= items.length

  const handleSelect = useCallback(
    (choice: string) => {
      if (!current || locked) return
      const correct = choice === current.answer
      const nextResults = [...results, { id: current.id, correct }]
      setResults(nextResults)
      if (correct) {
        setWrongFeedback(null)
        if (idx + 1 >= items.length) {
          onComplete?.(nextResults)
          setIdx(items.length)
        } else {
          setIdx((i) => i + 1)
        }
      } else {
        setWrongFeedback({ selected: choice, correct: current.answer })
      }
    },
    [current, idx, items.length, locked, onComplete, results],
  )

  if (items.length === 0) {
    return <p className="text-center text-sm text-slate-500">暂无词语题目</p>
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
          <span className="ml-2 normal-case text-violet-600">
            {current.source === 'recall' ? '读一读记一记' : '组词'}
          </span>
        </p>
        <p className="mt-3 text-sm font-semibold text-violet-700/80">
          选出彩色小空格里应该填的字
        </p>
        <div className="mt-4">
          <QuizBlankSentence display={current.display} size="lg" />
        </div>
        <p className="mt-2 text-xs text-slate-400">{current.lessonTitle}</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {options.map((opt) => {
          const isCorrect = opt === current.answer
          const isChosen = wrongFeedback?.selected === opt
          return (
            <button
              key={opt}
              type="button"
              disabled={locked}
              onClick={() => handleSelect(opt)}
              className={clsx(
                'rounded-xl border-2 py-4 text-2xl font-bold transition-colors',
                !locked && 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50',
                locked && isCorrect && 'border-emerald-400 bg-emerald-50 text-emerald-800',
                locked && isChosen && !isCorrect && 'border-rose-400 bg-rose-50 text-rose-700',
                locked && !isChosen && !isCorrect && 'border-slate-100 bg-slate-50 text-slate-400',
              )}
            >
              {opt}
            </button>
          )
        })}
      </div>

      {wrongFeedback && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-center">
          <p className="text-sm font-bold text-rose-700">
            再想想看～正确答案是「{wrongFeedback.correct}」
          </p>
          <button
            type="button"
            onClick={() => {
              setWrongFeedback(null)
              if (idx + 1 >= items.length) {
                onComplete?.(results)
                setIdx(items.length)
              } else {
                setIdx((i) => i + 1)
              }
            }}
            className="mt-3 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-700"
          >
            {idx + 1 >= items.length ? '查看结果' : '下一题'}
          </button>
        </div>
      )}
    </div>
  )
}
