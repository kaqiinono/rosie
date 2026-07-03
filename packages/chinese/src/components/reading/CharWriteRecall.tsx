'use client'

import { useState } from 'react'
import clsx from 'clsx'
import CharWriter from '../chars/CharWriter'
import CharSpeakButton from '../chars/CharSpeakButton'

export interface WriteRecallChar {
  char: string
  charKey: string
  pinyin: string
}

interface CharWriteRecallProps {
  chars: WriteRecallChar[]
  /** Session outcomes keyed by charKey (true = wrote with no mistakes). */
  answered: Record<string, boolean>
  onAnswer: (charKey: string, correct: boolean) => void
}

function WriteCard({
  item,
  result,
  onAnswer,
}: {
  item: WriteRecallChar
  result: boolean | undefined
  onAnswer: (charKey: string, correct: boolean) => void
}) {
  const [active, setActive] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const handleComplete = ({ totalMistakes }: { totalMistakes: number }) => {
    onAnswer(item.charKey, totalMistakes === 0)
  }

  return (
    <div
      className={clsx(
        'rounded-2xl border-[1.5px] bg-white/85 p-3 transition',
        result === true
          ? 'border-emerald-300 bg-emerald-50/70'
          : result === false
            ? 'border-amber-300 bg-amber-50/60'
            : 'border-rose-200/80',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-2xl font-black text-rose-900">
          {item.char}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="text-sm font-black text-rose-800">{item.pinyin}</p>
            <CharSpeakButton text={item.char} size="sm" className="text-rose-600" />
          </div>
          <p className="text-[11px] text-slate-400">
            {result === true
              ? '书写正确 ✓'
              : result === false
                ? '有笔误，可再写一次'
                : '按笔顺默写这个字'}
          </p>
        </div>
        {!active && (
          <button
            type="button"
            onClick={() => {
              setActive(true)
              setAttempt((n) => n + 1)
            }}
            className={clsx(
              'shrink-0 cursor-pointer rounded-lg border-[1.5px] px-3 py-1.5 text-[12px] font-bold transition',
              result === undefined
                ? 'border-rose-300 bg-rose-500 text-white hover:bg-rose-600'
                : 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50',
            )}
          >
            {result === undefined ? '✍️ 写一写' : '重写'}
          </button>
        )}
      </div>

      {active && (
        <div className="mt-3 flex flex-col items-center gap-2">
          <CharWriter
            key={`${item.charKey}-${attempt}`}
            char={item.char}
            mode="quiz"
            size={190}
            onQuizComplete={(summary) => {
              handleComplete(summary)
              setActive(false)
            }}
          />
          <button
            type="button"
            onClick={() => setActive(false)}
            className="cursor-pointer text-[11px] font-bold text-slate-400 hover:text-slate-600"
          >
            收起
          </button>
        </div>
      )}
    </div>
  )
}

export default function CharWriteRecall({ chars, answered, onAnswer }: CharWriteRecallProps) {
  if (chars.length === 0) return null

  const done = chars.filter((c) => answered[c.charKey] !== undefined).length
  const correct = chars.filter((c) => answered[c.charKey] === true).length

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[13px] font-extrabold text-rose-700">
          <span className="inline-block h-3 w-3 rounded border border-rose-400 bg-rose-100" />
          书写回想 · 会写字（{chars.length}）
        </h3>
        <span className="text-[11px] font-bold text-rose-600/70">
          已写 {done}/{chars.length}
          {done === chars.length && ` · 对 ${correct} 🎉`}
        </span>
      </div>
      <p className="mb-2.5 text-[11px] text-slate-400">按笔顺默写会写字，检验能不能写出来</p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {chars.map((item) => (
          <WriteCard
            key={item.charKey}
            item={item}
            result={answered[item.charKey]}
            onAnswer={onAnswer}
          />
        ))}
      </div>
    </section>
  )
}
