'use client'

import { useCallback, useState } from 'react'
import clsx from 'clsx'

type Step = { label: string; formula: string; result: string }

type StepSolveProps = {
  steps: Step[]
  onSubmit: (result: {
    finalAnswer: string
    correctSteps: number
    totalSteps: number
    stepResults: { input: string; correct: boolean }[]
  }) => void
  disabled?: boolean
}

function StepSolve({ steps, onSubmit, disabled = false }: StepSolveProps) {
  const [inputs, setInputs] = useState<string[]>(() => Array(steps.length).fill(''))
  const [checked, setChecked] = useState(false)
  const [stepCorrect, setStepCorrect] = useState<boolean[]>([])

  const handleChange = useCallback(
    (idx: number, value: string) => {
      if (checked || disabled) return
      setInputs((prev) => {
        const next = [...prev]
        next[idx] = value.replace(/[^0-9.\-/]/g, '')
        return next
      })
    },
    [checked, disabled],
  )

  const handleSubmit = useCallback(() => {
    if (checked) return
    const correctness = steps.map((s, i) => {
      const userVal = parseFloat(inputs[i])
      const correctVal = parseFloat(s.result)
      if (isNaN(userVal) || isNaN(correctVal)) return inputs[i].trim() === s.result.trim()
      return Math.abs(userVal - correctVal) < 1e-6
    })
    setStepCorrect(correctness)
    setChecked(true)

    const correctSteps = correctness.filter(Boolean).length
    const finalIdx = steps.length - 1
    const finalAnswer = inputs[finalIdx] ?? ''
    onSubmit({
      finalAnswer,
      correctSteps,
      totalSteps: steps.length,
      stepResults: inputs.map((input, i) => ({ input, correct: correctness[i] })),
    })
  }, [checked, inputs, steps, onSubmit])

  const allFilled = inputs.every((v) => v.trim() !== '')

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-white/[0.06] p-4">
        <div className="mb-3 text-xs text-white/40">分步作答</div>
        <div className="flex flex-col gap-3">
          {steps.map((s, i) => {
            const isCorrect = checked && stepCorrect[i]
            const isWrong = checked && !stepCorrect[i]
            return (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">
                    第 {i + 1} 步：{s.label}
                  </span>
                  {checked && (
                    <span className={isCorrect ? 'text-green-400' : 'text-red-400'}>
                      {isCorrect ? '✓' : '✗'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-white/[0.05] px-2 py-1.5 text-sm font-medium text-white/80">
                    {s.formula}
                  </span>
                  <span className="text-white/40">=</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={inputs[i]}
                    onChange={(e) => handleChange(i, e.target.value)}
                    disabled={checked || disabled}
                    placeholder="?"
                    className={clsx(
                      'h-9 w-24 rounded-md border-2 px-2 text-center text-base font-bold outline-none',
                      !checked && 'border-white/20 bg-white/[0.03] text-white focus:border-blue-400',
                      isCorrect && 'border-green-400 bg-green-500/20 text-green-300',
                      isWrong && 'border-red-400 bg-red-500/20 text-red-300',
                    )}
                  />
                  {checked && !stepCorrect[i] && (
                    <span className="text-xs text-white/40">→ {s.result}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {!checked && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allFilled || disabled}
          className="rounded-xl bg-blue-500 py-3 text-base font-bold text-white shadow transition-colors hover:bg-blue-600 disabled:opacity-40"
        >
          提交
        </button>
      )}
    </div>
  )
}

export default StepSolve
