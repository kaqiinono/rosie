'use client'

import { useMemo, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import type { PoemEntry } from '../../utils/g1b/types'

interface PoemReciteProps {
  poem: PoemEntry
  onComplete?: (score: number) => void
}

interface BlankSlot {
  lineIdx: number
  charIdx: number
  char: string
}

function pickBlanks(poem: PoemEntry): BlankSlot[] {
  const blanks: BlankSlot[] = []
  poem.lines.forEach((line, lineIdx) => {
    const chars = [...line.replace(/[，。、；：！？\s]/g, '')]
    if (chars.length === 0) return
    const charIdx = line.search(/[\u4e00-\u9fff]/)
    if (charIdx >= 0) {
      blanks.push({ lineIdx, charIdx, char: line[charIdx] })
    }
    if (chars.length > 4) {
      const mid = Math.floor(chars.length / 2)
      let count = 0
      for (let i = 0; i < line.length; i++) {
        if (/[\u4e00-\u9fff]/.test(line[i])) {
          if (count === mid) {
            blanks.push({ lineIdx, charIdx: i, char: line[i] })
            break
          }
          count++
        }
      }
    }
  })
  return blanks
}

export default function PoemRecite({ poem, onComplete }: PoemReciteProps) {
  const blanks = useMemo(() => pickBlanks(poem), [poem])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  const keyFor = (slot: BlankSlot) => `${slot.lineIdx}:${slot.charIdx}`

  const score = useMemo(() => {
    if (!submitted) return 0
    const correct = blanks.filter((b) => answers[keyFor(b)] === b.char).length
    return blanks.length ? Math.round((correct / blanks.length) * 100) : 100
  }, [answers, blanks, submitted])

  const handleSubmit = () => {
    setSubmitted(true)
    const correct = blanks.filter((b) => answers[keyFor(b)] === b.char).length
    const pct = blanks.length ? Math.round((correct / blanks.length) * 100) : 100
    onComplete?.(pct)
  }

  return (
    <div className="mx-auto max-w-lg">
      <header className="mb-6 text-center">
        <h2 className="text-2xl font-extrabold text-violet-900">{poem.title}</h2>
        <p className="mt-1 text-sm text-violet-600">
          {poem.dynasty} · {poem.author}
        </p>
        <p className="mt-2 text-xs text-slate-500">填空背诵 — 写出挖空的字</p>
      </header>

      <div className="space-y-3 rounded-2xl border border-violet-100 bg-white/80 p-5 shadow-sm">
        {poem.lines.map((line, lineIdx) => {
          const lineBlanks = blanks.filter((b) => b.lineIdx === lineIdx)
          if (lineBlanks.length === 0) {
            return (
              <p key={lineIdx} className="text-center text-lg leading-loose text-slate-800">
                {line}
              </p>
            )
          }

          const parts: ReactNode[] = []
          let cursor = 0
          const sorted = [...lineBlanks].sort((a, b) => a.charIdx - b.charIdx)
          for (const slot of sorted) {
            if (cursor < slot.charIdx) {
              parts.push(<span key={`t-${cursor}`}>{line.slice(cursor, slot.charIdx)}</span>)
            }
            const k = keyFor(slot)
            const val = answers[k] ?? ''
            const ok = submitted && val === slot.char
            const bad = submitted && val !== slot.char
            parts.push(
              <input
                key={k}
                type="text"
                maxLength={1}
                value={val}
                disabled={submitted}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [k]: e.target.value }))}
                className={clsx(
                  'mx-0.5 inline-block h-9 w-9 rounded-md border-2 text-center text-lg font-bold',
                  !submitted && 'border-violet-200 bg-violet-50',
                  ok && 'border-emerald-400 bg-emerald-50 text-emerald-800',
                  bad && 'border-rose-400 bg-rose-50 text-rose-700',
                )}
                aria-label={`第 ${lineIdx + 1} 行填空`}
              />,
            )
            cursor = slot.charIdx + 1
          }
          if (cursor < line.length) {
            parts.push(<span key={`t-end`}>{line.slice(cursor)}</span>)
          }

          return (
            <p key={lineIdx} className="text-center text-lg leading-loose text-slate-800">
              {parts}
            </p>
          )
        })}
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        {!submitted ? (
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
          >
            提交
          </button>
        ) : (
          <p className="text-sm font-semibold text-violet-800">得分：{score}%</p>
        )}
      </div>
    </div>
  )
}
