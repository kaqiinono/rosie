'use client'

import { useCallback, useState } from 'react'
import clsx from 'clsx'

type EquationFillProps = {
  /** 完整等式模板，用 ? 代表空位，如 "3 + ? = 7" 或 "12 ? 4 = 3" */
  template: string
  /** 期望答案 */
  answer: string
  /** 题型：填数 / 填运算符 */
  kind?: 'number' | 'operator'
  onSubmit: (userAnswer: string) => void
  disabled?: boolean
}

const OPERATORS = ['+', '−', '×', '÷']

function EquationFill({ template, answer, kind = 'number', onSubmit, disabled = false }: EquationFillProps) {
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleConfirm = useCallback(() => {
    if (!value || submitted || disabled) return
    setSubmitted(true)
    onSubmit(value)
  }, [value, submitted, disabled, onSubmit])

  const parts = template.split('?')
  const correct = submitted && value === answer
  const wrong = submitted && value !== answer

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-2xl bg-white/[0.06] p-6 w-full">
        <div className="flex flex-wrap items-center justify-center gap-2 text-2xl font-bold text-white">
          {parts.map((p, i) => (
            <span key={i} className="contents">
              <span>{p}</span>
              {i < parts.length - 1 && (
                <span
                  className={clsx(
                    'inline-flex h-10 min-w-[3rem] items-center justify-center rounded-lg border-2 px-2',
                    !submitted && 'border-blue-400 bg-blue-500/10 text-blue-300',
                    correct && 'border-green-400 bg-green-500/20 text-green-300',
                    wrong && 'border-red-400 bg-red-500/20 text-red-300',
                  )}
                >
                  {value || '?'}
                </span>
              )}
            </span>
          ))}
        </div>
        {submitted && !correct && (
          <div className="mt-3 text-center text-sm text-white/60">
            正确答案：<span className="text-green-400">{answer}</span>
          </div>
        )}
      </div>

      {!submitted && (
        <>
          {kind === 'operator' ? (
            <div className="grid grid-cols-4 gap-2">
              {OPERATORS.map((op) => (
                <button
                  key={op}
                  type="button"
                  disabled={disabled}
                  onClick={() => setValue(op)}
                  className={clsx(
                    'h-14 w-14 rounded-xl border-2 text-2xl font-bold transition',
                    value === op
                      ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                      : 'border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.10]',
                  )}
                >
                  {op}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid w-full max-w-xs grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={disabled}
                  onClick={() => setValue((prev) => (prev.length < 4 ? prev + d : prev))}
                  className="min-h-[48px] rounded-xl bg-white text-xl font-bold shadow hover:bg-gray-50"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                disabled={disabled}
                onClick={() => setValue((prev) => prev.slice(0, -1))}
                className="min-h-[48px] rounded-xl bg-white text-xl font-bold shadow hover:bg-gray-50"
              >
                ⌫
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setValue((prev) => (prev.length < 4 ? prev + '0' : prev))}
                className="min-h-[48px] rounded-xl bg-white text-xl font-bold shadow hover:bg-gray-50"
              >
                0
              </button>
              <button
                type="button"
                disabled={disabled || !value}
                onClick={handleConfirm}
                className="min-h-[48px] rounded-xl bg-blue-500 text-xl font-bold text-white shadow hover:bg-blue-600 disabled:opacity-40"
              >
                确认
              </button>
            </div>
          )}
          {kind === 'operator' && value && (
            <button
              type="button"
              disabled={disabled}
              onClick={handleConfirm}
              className="rounded-xl bg-blue-500 px-8 py-3 text-base font-bold text-white shadow hover:bg-blue-600"
            >
              确认
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default EquationFill
