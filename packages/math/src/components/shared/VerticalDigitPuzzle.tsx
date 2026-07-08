'use client'

import type { VerticalDigitPuzzleSpec, VerticalPuzzleSymbolCell } from '@rosie/core'
import VerticalDigitPuzzlePanel from '@rosie/math/components/shared/VerticalDigitPuzzlePanel'
import type { VerticalPuzzleFills } from '@rosie/math/utils/vertical-digit-puzzle'

/** @deprecated Prefer `VerticalDigitPuzzleSpec` + `VerticalDigitPuzzlePanel`. */
export interface MathCellConfig {
  value?: string
  isInput?: boolean
  answer?: string
  placeholder?: string
}

/** @deprecated Prefer `VerticalDigitPuzzleSpec`. */
export interface MathQuizConfig {
  id: string
  title: string
  rows: {
    cells: MathCellConfig[]
    operator?: string
    isResultLine?: boolean
  }[]
}

/** Shorthand for symbol / 汉字 / 字母格 */
export function sym(label: string, fixed?: number): VerticalPuzzleSymbolCell {
  return fixed !== undefined ? { sym: label, label, fixed } : { sym: label, label }
}

/** Convert legacy demo config → spec (for /math/demo). */
export function quizConfigToSpec(config: MathQuizConfig): VerticalDigitPuzzleSpec {
  const operandRows: VerticalDigitPuzzleSpec['operands'] = []
  let result: VerticalDigitPuzzleSpec['result'] = []
  let op: '+' | '-' = '+'
  let chainSubtract: VerticalDigitPuzzleSpec['chainSubtract']
  let chainResult: VerticalDigitPuzzleSpec['chainResult']
  let afterResult = false

  for (const row of config.rows) {
    const cells = row.cells.map((c) => {
      if (c.isInput) {
        if (c.placeholder) return sym(c.placeholder)
        return null
      }
      return Number(c.value)
    })

    if (row.isResultLine) {
      if (afterResult) {
        chainResult = cells
      } else {
        result = cells
        afterResult = true
      }
      continue
    }

    if (row.operator === '-') {
      if (afterResult) {
        chainSubtract = cells
      } else {
        op = '-'
        operandRows.push(cells)
      }
      continue
    }

    if (row.operator === '+') op = '+'
    operandRows.push(cells)
  }

  return {
    op,
    operands: operandRows.length > 0 ? operandRows : [[null]],
    result: result.length > 0 ? result : [null],
    chainSubtract,
    chainResult,
  }
}

type VerticalDigitPuzzleProps = {
  config: MathQuizConfig
  onSubmit?: (fills: VerticalPuzzleFills) => void
}

/** Standalone demo card — wraps `VerticalDigitPuzzlePanel` with project styling. */
export function VerticalDigitPuzzle({ config, onSubmit }: VerticalDigitPuzzleProps) {
  const spec = quizConfigToSpec(config)

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-text-secondary mb-4 border-l-4 border-sky-500 pl-2 text-sm font-bold">
        {config.title}
      </h3>
      <VerticalDigitPuzzlePanel
        spec={spec}
        embedded
        onSubmit={onSubmit ?? (() => {})}
      />
    </div>
  )
}

export type { VerticalDigitPuzzleSpec, VerticalPuzzleFills }
