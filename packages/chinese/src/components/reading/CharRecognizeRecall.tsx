'use client'

import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { shuffle } from '../../utils/chinese-helpers'
import CharSpeakButton from '../chars/CharSpeakButton'

export interface RecognizeRecallChar {
  char: string
  charKey: string
  pinyin: string
}

interface CharRecognizeRecallProps {
  chars: RecognizeRecallChar[]
  /** All lesson pinyins — used as the distractor pool. */
  pinyinPool: string[]
  /** Session outcomes keyed by charKey (true = correct). */
  answered: Record<string, boolean>
  onAnswer: (charKey: string, correct: boolean) => void
}

function buildPinyinOptions(correct: string, pool: string[], seed: number): string[] {
  const others = [...new Set(pool)].filter((p) => p && p !== correct)
  const distractors = shuffle(others, seed).slice(0, 3)
  // Pad defensively when a lesson has fewer than 4 distinct readings.
  const PAD = ['de', 'le', 'shì', 'yī']
  let i = 0
  while (distractors.length < 3) {
    const cand = PAD[i++ % PAD.length]
    if (cand !== correct && !distractors.includes(cand)) distractors.push(cand)
    if (i > 20) break
  }
  return shuffle([correct, ...distractors.slice(0, 3)], seed + 1)
}

function RecognizeCard({
  item,
  pinyinPool,
  result,
  onAnswer,
}: {
  item: RecognizeRecallChar
  pinyinPool: string[]
  result: boolean | undefined
  onAnswer: (charKey: string, correct: boolean) => void
}) {
  const [picked, setPicked] = useState<string | null>(null)

  const options = useMemo(() => {
    const seed = item.charKey.split('').reduce((s, c) => s * 31 + c.charCodeAt(0), 7) >>> 0
    return buildPinyinOptions(item.pinyin, pinyinPool, seed)
  }, [item.charKey, item.pinyin, pinyinPool])

  const locked = result !== undefined

  const handlePick = (opt: string) => {
    if (locked) return
    setPicked(opt)
    onAnswer(item.charKey, opt === item.pinyin)
  }

  return (
    <div
      className={clsx(
        'flex flex-col gap-2 rounded-2xl border-[1.5px] bg-white/85 p-3 transition',
        result === true
          ? 'border-emerald-300 bg-emerald-50/70'
          : result === false
            ? 'border-rose-300 bg-rose-50/60'
            : 'border-sky-200/80',
      )}
    >
      <div className="flex items-center justify-center gap-1">
        <span className="cn-grid-cell-sm">{item.char}</span>
        {locked && (
          <CharSpeakButton text={item.char} size="sm" className="text-sky-700" />
        )}
      </div>

      {locked && (
        <p
          className={clsx(
            'text-center text-[13px] font-black',
            result ? 'text-emerald-700' : 'text-rose-600',
          )}
        >
          {item.pinyin}
        </p>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        {options.map((opt) => {
          const isCorrect = opt === item.pinyin
          const isChosen = picked === opt
          return (
            <button
              key={opt}
              type="button"
              disabled={locked}
              onClick={() => handlePick(opt)}
              className={clsx(
                'rounded-lg border-[1.5px] px-2 py-1.5 text-[13px] font-bold transition',
                !locked && 'cursor-pointer border-sky-200 bg-white text-sky-900 hover:border-sky-400 hover:bg-sky-50',
                locked && isCorrect && 'border-emerald-400 bg-emerald-100 text-emerald-800',
                locked && isChosen && !isCorrect && 'border-rose-400 bg-rose-100 text-rose-700',
                locked && !isCorrect && !isChosen && 'border-slate-200 bg-slate-50 text-slate-400',
              )}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function CharRecognizeRecall({
  chars,
  pinyinPool,
  answered,
  onAnswer,
}: CharRecognizeRecallProps) {
  if (chars.length === 0) return null

  const done = chars.filter((c) => answered[c.charKey] !== undefined).length
  const correct = chars.filter((c) => answered[c.charKey] === true).length

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[13px] font-extrabold text-sky-700">
          <span className="inline-block h-3 w-3 rounded border border-sky-300 bg-sky-100" />
          认读回想 · 会认字（{chars.length}）
        </h3>
        <span className="text-[11px] font-bold text-sky-600/70">
          已答 {done}/{chars.length}
          {done === chars.length && ` · 对 ${correct} 🎉`}
        </span>
      </div>
      <p className="mb-2.5 text-[11px] text-slate-400">看字选读音，回想刚才读到的字</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {chars.map((item) => (
          <RecognizeCard
            key={item.charKey}
            item={item}
            pinyinPool={pinyinPool}
            result={answered[item.charKey]}
            onAnswer={onAnswer}
          />
        ))}
      </div>
    </section>
  )
}
