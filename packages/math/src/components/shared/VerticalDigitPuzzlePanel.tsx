'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { AnswerCheckResult, VerticalDigitPuzzleSpec, VerticalPuzzleCell } from '@rosie/core'
import VerticalDigitPad from '@rosie/calc/components/VerticalDigitPad'
import {
  allBlanksFilled,
  blankIdAt,
  evaluateVerticalPuzzle,
  listPuzzleBlanks,
  padPuzzleRow,
  totalPuzzleCols,
  type BlankSlot,
  type VerticalPuzzleFills,
} from '@rosie/math/utils/vertical-digit-puzzle'

type Props = {
  spec: VerticalDigitPuzzleSpec
  onSubmit: (fills: VerticalPuzzleFills) => void
  onStateChange?: () => void
  feedback?: AnswerCheckResult | null
  disabled?: boolean
}

const GEO = {
  cell: { width: 48, height: 52 },
  lead: 40,
  digitFont: 26,
}

function lightCellStyle(opts: {
  isActive: boolean
  graded: boolean
  val: number | null
  correctVal: number | undefined
}): Pick<CSSProperties, 'borderColor' | 'background' | 'color' | 'boxShadow'> {
  const wrong =
    opts.graded &&
    opts.correctVal !== undefined &&
    opts.val !== null &&
    opts.val !== opts.correctVal
  const right =
    opts.graded &&
    opts.correctVal !== undefined &&
    opts.val !== null &&
    opts.val === opts.correctVal

  if (wrong) {
    return {
      borderColor: opts.isActive ? '#f87171' : '#fca5a5',
      background: opts.isActive ? '#fee2e2' : '#fef2f2',
      color: '#dc2626',
    }
  }
  if (right) {
    return {
      borderColor: '#4ade80',
      background: '#dcfce7',
      color: '#15803d',
    }
  }
  if (opts.isActive) {
    return {
      borderColor: '#38bdf8',
      background: '#e0f2fe',
      color: '#0369a1',
      boxShadow: '0 0 0 2px rgba(56,189,248,0.25)',
    }
  }
  return {
    borderColor: '#cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
  }
}

function fixedCellStyle(): CSSProperties {
  return {
    borderColor: 'transparent',
    background: 'transparent',
    color: '#0f172a',
  }
}

type ActiveCell = { rowKey: string; col: number }

function renderRow(
  row: VerticalPuzzleCell[],
  rowKeyStr: string,
  totalCols: number,
  blanks: BlankSlot[],
  fills: VerticalPuzzleFills,
  active: ActiveCell | null,
  graded: boolean,
  solutionFills: Record<string, number> | undefined,
  onSelect: (rowKey: string, col: number) => void,
  leadContent?: string,
) {
  const padded = padPuzzleRow(row, totalCols)
  const offset = totalCols - row.length

  return (
    <div className="flex justify-end gap-1">
      <div
        className="flex items-center justify-center font-black text-slate-400"
        style={{ width: GEO.lead, height: GEO.cell.height, fontSize: GEO.digitFont }}
      >
        {leadContent ?? ''}
      </div>
      {padded.map((cell, col) => {
        const origCol = col - offset
        const isPadSpacer = origCol < 0
        if (isPadSpacer || cell === 'spacer') {
          return <div key={`${rowKeyStr}-${col}`} style={GEO.cell} />
        }

        const blankId = blankIdAt(blanks, rowKeyStr, origCol)
        const isBlank = cell === null && blankId !== undefined

        if (!isBlank) {
          return (
            <div
              key={`${rowKeyStr}-${col}`}
              className="flex items-center justify-center font-black"
              style={{ ...GEO.cell, fontSize: GEO.digitFont, ...fixedCellStyle() }}
            >
              {cell}
            </div>
          )
        }

        const val = blankId ? (fills[blankId] ?? null) : null
        const isActive = active?.rowKey === rowKeyStr && active.col === origCol
        const correctVal = blankId ? solutionFills?.[blankId] : undefined

        return (
          <button
            key={`${rowKeyStr}-${col}`}
            type="button"
            onClick={() => onSelect(rowKeyStr, origCol)}
            className="flex items-center justify-center rounded-xl border-2 font-black transition-all select-none active:scale-[0.96]"
            style={{
              ...GEO.cell,
              fontSize: GEO.digitFont,
              ...lightCellStyle({ isActive, graded, val, correctVal }),
            }}
          >
            {val !== null ? val : '□'}
          </button>
        )
      })}
    </div>
  )
}

export default function VerticalDigitPuzzlePanel({
  spec,
  onSubmit,
  onStateChange,
  feedback,
  disabled = false,
}: Props) {
  const blanks = useMemo(() => listPuzzleBlanks(spec), [spec])
  const totalCols = useMemo(() => totalPuzzleCols(spec), [spec])
  const [fills, setFills] = useState<VerticalPuzzleFills>({})
  const [active, setActive] = useState<ActiveCell | null>(() =>
    blanks.length > 0 ? { rowKey: blanks[0].rowKey, col: blanks[0].col } : null,
  )
  const [graded, setGraded] = useState(false)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    setFills({})
    setGraded(false)
    setLocked(false)
    setActive(blanks.length > 0 ? { rowKey: blanks[0].rowKey, col: blanks[0].col } : null)
  }, [spec, blanks])

  const complete = allBlanksFilled(spec, fills)

  const notifyChange = useCallback(() => {
    onStateChange?.()
    setGraded(false)
  }, [onStateChange])

  const handleDigit = (digit: number) => {
    if (disabled || locked || !active) return
    const id = blankIdAt(blanks, active.rowKey, active.col)
    if (!id) return
    setFills((prev) => ({ ...prev, [id]: digit }))
    notifyChange()

    const idx = blanks.findIndex((b) => b.id === id)
    const next = blanks[idx + 1]
    if (next) setActive({ rowKey: next.rowKey, col: next.col })
  }

  const handleDelete = () => {
    if (disabled || locked || !active) return
    const id = blankIdAt(blanks, active.rowKey, active.col)
    if (!id) return
    setFills((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    notifyChange()
  }

  const handleCheck = () => {
    if (locked || !complete) return
    const ok = evaluateVerticalPuzzle(spec, fills)
    setGraded(true)
    onSubmit(fills)
    if (ok) setLocked(true)
  }

  const handleAction = () => {
    if (complete) handleCheck()
    else {
      const idx = blanks.findIndex(
        (b) => b.rowKey === active?.rowKey && b.col === active?.col,
      )
      for (let i = idx + 1; i < blanks.length; i++) {
        if (fills[blanks[i].id] === undefined) {
          setActive({ rowKey: blanks[i].rowKey, col: blanks[i].col })
          return
        }
      }
      const firstEmpty = blanks.find((b) => fills[b.id] === undefined)
      if (firstEmpty) setActive({ rowKey: firstEmpty.rowKey, col: firstEmpty.col })
    }
  }

  const padLocked = locked || (graded && feedback?.ok)

  return (
    <div className="flex flex-col gap-4">
      <div className="mb-1 flex items-center gap-2">
        <div className="h-px flex-1 bg-border-light" />
        <div className="whitespace-nowrap text-xs font-semibold text-text-muted">✏️ 填入竖式方格</div>
        <div className="h-px flex-1 bg-border-light" />
      </div>

      <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-4">
        <div className="mx-auto w-fit rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
          {spec.operands.map((row, ri) => {
            const lead =
              spec.op === '-' && ri === 1
                ? spec.op
                : spec.op === '+' && ri === spec.operands.length - 1
                  ? spec.op
                  : ''
            return renderRow(
              row,
              `op${ri}`,
              totalCols,
              blanks,
              fills,
              active,
              graded,
              spec.solutionFills,
              (rowKey, col) => !disabled && !locked && setActive({ rowKey, col }),
              lead,
            )
          })}
          <div className="my-1.5 border-t-2 border-sky-200" />
          {renderRow(
            spec.result,
            'result',
            totalCols,
            blanks,
            fills,
            active,
            graded,
            spec.solutionFills,
            (rowKey, col) => !disabled && !locked && setActive({ rowKey, col }),
          )}
          {spec.chainSubtract && spec.chainResult && (
            <>
              <div className="my-1.5 border-t-2 border-sky-200" />
              {renderRow(
                spec.chainSubtract,
                'sub',
                totalCols,
                blanks,
                fills,
                active,
                graded,
                spec.solutionFills,
                (rowKey, col) => !disabled && !locked && setActive({ rowKey, col }),
                '-',
              )}
              <div className="my-1.5 border-t-2 border-sky-200" />
              {renderRow(
                spec.chainResult,
                'final',
                totalCols,
                blanks,
                fills,
                active,
                graded,
                spec.solutionFills,
                (rowKey, col) => !disabled && !locked && setActive({ rowKey, col }),
              )}
            </>
          )}
        </div>

        <div className={`mt-4 ${padLocked ? 'pointer-events-none opacity-50' : ''}`}>
          <VerticalDigitPad
            variant="light"
            complete={complete}
            disabled={disabled || locked}
            onDigit={handleDigit}
            onDelete={handleDelete}
            onAction={handleAction}
          />
        </div>

        {feedback?.message && (
          <div
            className={`mt-3 text-center text-[13px] font-medium ${feedback.ok ? 'text-app-green-dark' : 'text-app-red'}`}
          >
            {feedback.message}
          </div>
        )}
      </div>
    </div>
  )
}
