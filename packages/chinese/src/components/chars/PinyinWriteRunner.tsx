'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import type { PinyinWriteQuizItem } from '../../utils/chinese-pinyin-write-helpers'
import CharWriter from './CharWriter'

function splitWordChars(word: string, pinyin: string): { char: string; pinyin: string }[] {
  const chars = [...word]
  const syllables = pinyin.trim().split(/\s+/)
  return chars.map((char, i) => ({ char, pinyin: syllables[i] ?? '' }))
}

function writerSize(charCount: number): number {
  if (charCount <= 2) return 168
  if (charCount <= 4) return 140
  return 112
}

interface PinyinWriteRunnerProps {
  item: PinyinWriteQuizItem
  onComplete: (correct: boolean) => void
}

export default function PinyinWriteRunner({
  item,
  onComplete,
}: PinyinWriteRunnerProps) {
  const segments = useMemo(
    () => splitWordChars(item.word, item.pinyin),
    [item.word, item.pinyin],
  )
  const size = writerSize(segments.length)

  /** null = not yet written; number = mistake count for that char */
  const [charMistakes, setCharMistakes] = useState<(number | null)[]>(() =>
    segments.map(() => null),
  )
  const [writerAttempts, setWriterAttempts] = useState<number[]>(() => segments.map(() => 0))
  const [showWrongSummary, setShowWrongSummary] = useState(false)
  const finishedRef = useRef(false)

  useEffect(() => {
    finishedRef.current = false
    setCharMistakes(segments.map(() => null))
    setWriterAttempts(segments.map(() => 0))
    setShowWrongSummary(false)
  }, [item.id, segments])

  const handleCharComplete = useCallback(
    (index: number, totalMistakes: number) => {
      setCharMistakes((prev) => {
        const next = [...prev]
        next[index] = totalMistakes
        const allDone = next.every((m) => m !== null)
        if (allDone && !finishedRef.current) {
          finishedRef.current = true
          const correct = next.every((m) => m === 0)
          if (correct) {
            onComplete(true)
          } else {
            setShowWrongSummary(true)
          }
        }
        return next
      })
    },
    [onComplete],
  )

  const retryChar = useCallback((index: number) => {
    finishedRef.current = false
    setCharMistakes((prev) => {
      const next = [...prev]
      next[index] = null
      return next
    })
    setWriterAttempts((prev) => {
      const next = [...prev]
      next[index] += 1
      return next
    })
  }, [])

  const doneCount = charMistakes.filter((m) => m !== null).length

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="rounded-2xl border border-teal-200/70 bg-white/85 p-4 text-center sm:p-5">
        <p className="text-sm font-semibold text-teal-700/70">看拼音，按笔顺写出词语</p>
        <p className="mt-2 text-2xl font-black tracking-wide text-teal-900 sm:text-3xl">
          {item.pinyin}
        </p>
        <p className="mt-2 text-xs font-semibold text-teal-800/50">
          已写 {doneCount} / {segments.length} 字
        </p>
      </div>

      <div
        className={clsx(
          'flex flex-wrap justify-center gap-3 sm:gap-4',
          segments.length > 4 && 'gap-2',
        )}
      >
        {segments.map((seg, index) => {
          const mistakes = charMistakes[index]
          const done = mistakes !== null

          return (
            <div
              key={`${item.id}::${index}::${seg.char}`}
              className={clsx(
                'flex flex-col items-center rounded-2xl border-2 p-2 transition',
                done && mistakes === 0 && 'border-emerald-300 bg-emerald-50/60',
                done && mistakes > 0 && 'border-amber-300 bg-amber-50/60',
                !done && 'border-teal-200/80 bg-white/80',
              )}
            >
              {seg.pinyin && (
                <p className="mb-1 text-sm font-black text-teal-800">{seg.pinyin}</p>
              )}
              {done ? (
                <div className="flex flex-col items-center gap-1">
                  <span
                    className={clsx(
                      'flex items-center justify-center rounded-xl border-2 bg-white text-4xl font-black',
                      mistakes === 0 ? 'border-emerald-300 text-emerald-800' : 'border-amber-300 text-amber-800',
                    )}
                    style={{ width: size + 24, height: size + 24 }}
                  >
                    {seg.char}
                  </span>
                  <p className="text-[10px] font-bold text-stone-500">
                    {mistakes === 0 ? '写好了' : `有 ${mistakes} 处笔误`}
                  </p>
                  <button
                    type="button"
                    onClick={() => retryChar(index)}
                    className="cursor-pointer text-[11px] font-bold text-teal-700 hover:text-teal-900"
                  >
                    重写
                  </button>
                </div>
              ) : (
                <CharWriter
                  key={`${item.id}::${index}::${writerAttempts[index]}`}
                  char={seg.char}
                  mode="quiz"
                  size={size}
                  onQuizComplete={({ totalMistakes }) =>
                    handleCharComplete(index, totalMistakes)
                  }
                />
              )}
            </div>
          )
        })}
      </div>

      {showWrongSummary && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-center">
          <p className="text-sm font-bold text-rose-700">
            再想想看～正确答案是「{item.word}」
          </p>
          <button
            type="button"
            onClick={() => onComplete(false)}
            className="cn-start-btn mt-3 cursor-pointer rounded-xl border-0 px-5 py-2 text-sm font-bold text-white"
          >
            下一题
          </button>
        </div>
      )}
    </div>
  )
}
