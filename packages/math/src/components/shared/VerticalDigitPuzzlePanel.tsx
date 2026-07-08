'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, RefObject } from 'react'
import type {
  AnswerCheckResult,
  VerticalDigitPuzzleSpec,
  VerticalPuzzleBlock,
  VerticalPuzzleCell,
} from '@rosie/core'
import VerticalDigitPad from '@rosie/calc/components/VerticalDigitPad'
import {
  allBlanksFilled,
  blankIdAt,
  blockPuzzleCols,
  cellDisplayLabel,
  evaluateVerticalPuzzle,
  fixedCellDigit,
  isCellEditable,
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
  onFillsChange?: (fills: VerticalPuzzleFills) => void
  initialFills?: VerticalPuzzleFills
  /** Ref to the grid-only region (for scratch-pad raster export). */
  exportGridRef?: RefObject<HTMLDivElement | null>
  feedback?: AnswerCheckResult | null
  disabled?: boolean
  /** Embed in question card (no outer section chrome). */
  embedded?: boolean
  /** When set, digit pad portals here (e.g. scratch-pad sticky footer). */
  padSlot?: HTMLElement | null
}

const GEO = {
  cell: { width: 44, height: 48 },
  lead: 36,
  digitFont: 24,
  labelFont: 20,
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

function symbolCellStyle(): CSSProperties {
  return {
    borderColor: 'transparent',
    background: 'transparent',
    color: '#b45309',
    fontFamily: 'var(--font-serif, ui-serif, Georgia, serif)',
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
  knownSymbols: Record<string, number> | undefined,
  onSelect: (rowKey: string, col: number) => void,
  leadContent?: string,
  readonly?: boolean,
) {
  const padded = padPuzzleRow(row, totalCols)
  const offset = totalCols - row.length

  return (
    <div className="flex justify-end gap-0.5">
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
        const isBlank = isCellEditable(cell) && blankId !== undefined
        const fixed = fixedCellDigit(cell, knownSymbols)
        const label = cellDisplayLabel(cell)

        if (!isBlank && fixed !== null) {
          return (
            <div
              key={`${rowKeyStr}-${col}`}
              className="flex items-center justify-center font-black"
              style={{
                ...GEO.cell,
                fontSize: typeof cell === 'number' ? GEO.digitFont : GEO.labelFont,
                ...(typeof cell === 'number' ? fixedCellStyle() : symbolCellStyle()),
              }}
            >
              {fixed}
            </div>
          )
        }

        if (!isBlank) {
          return (
            <div
              key={`${rowKeyStr}-${col}`}
              className="flex items-center justify-center font-black"
              style={{ ...GEO.cell, fontSize: GEO.digitFont, ...fixedCellStyle() }}
            >
              {typeof cell === 'number' ? cell : ''}
            </div>
          )
        }

        const val = blankId ? (fills[blankId] ?? null) : null
        const isActive = active?.rowKey === rowKeyStr && active.col === origCol
        const correctVal = blankId ? solutionFills?.[blankId] : undefined
        const display = val !== null ? String(val) : (label ?? '□')

        if (readonly) {
          return (
            <div
              key={`${rowKeyStr}-${col}`}
              className="flex items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 font-black text-slate-400"
              style={{
                ...GEO.cell,
                fontSize: label ? GEO.labelFont : GEO.digitFont,
              }}
            >
              {display}
            </div>
          )
        }

        return (
          <button
            key={`${rowKeyStr}-${col}`}
            type="button"
            onClick={() => onSelect(rowKeyStr, origCol)}
            className={`flex items-center justify-center rounded-xl border-2 font-black transition-all select-none active:scale-[0.96] ${
              label && val === null ? 'font-serif' : ''
            }`}
            style={{
              ...GEO.cell,
              fontSize: val !== null ? GEO.digitFont : label ? GEO.labelFont : GEO.digitFont,
              ...lightCellStyle({ isActive, graded, val, correctVal }),
              ...(label && val === null && !isActive && !graded
                ? { color: '#b45309', borderColor: '#fcd34d', background: '#fffbeb' }
                : {}),
            }}
          >
            {display}
          </button>
        )
      })}
    </div>
  )
}

function renderEquation(
  spec: Pick<
    VerticalDigitPuzzleSpec,
    'op' | 'operands' | 'result' | 'chainSubtract' | 'chainResult' | 'knownSymbols' | 'solutionFills' | 'readonly'
  >,
  prefix: string,
  totalCols: number,
  blanks: BlankSlot[],
  fills: VerticalPuzzleFills,
  active: ActiveCell | null,
  graded: boolean,
  onSelect: (rowKey: string, col: number) => void,
) {
  return (
    <>
      {spec.operands.map((row, ri) => {
        const rowKey = `${prefix}op${ri}`
        const lead =
          spec.op === '-' && ri === 1
            ? spec.op
            : spec.op === '+' && ri === spec.operands.length - 1
              ? spec.op
              : ''
        return (
          <div key={rowKey}>
            {renderRow(
              row,
              rowKey,
              totalCols,
              blanks,
              fills,
              active,
              graded,
              spec.solutionFills,
              spec.knownSymbols,
              onSelect,
              lead,
              spec.readonly,
            )}
          </div>
        )
      })}
      <div className="my-1 border-t-2 border-sky-200" />
      {renderRow(
        spec.result,
        `${prefix}result`,
        totalCols,
        blanks,
        fills,
        active,
        graded,
        spec.solutionFills,
        spec.knownSymbols,
        onSelect,
        undefined,
        spec.readonly,
      )}
      {spec.chainSubtract && spec.chainResult && (
        <>
          <div className="my-1 border-t-2 border-sky-200" />
          {renderRow(
            spec.chainSubtract,
            `${prefix}sub`,
            totalCols,
            blanks,
            fills,
            active,
            graded,
            spec.solutionFills,
            spec.knownSymbols,
            onSelect,
            '-',
            spec.readonly,
          )}
          <div className="my-1 border-t-2 border-sky-200" />
          {renderRow(
            spec.chainResult,
            `${prefix}final`,
            totalCols,
            blanks,
            fills,
            active,
            graded,
            spec.solutionFills,
            spec.knownSymbols,
            onSelect,
            undefined,
            spec.readonly,
          )}
        </>
      )}
    </>
  )
}

function renderBlock(
  block: VerticalPuzzleBlock,
  blockIndex: number,
  blanks: BlankSlot[],
  fills: VerticalPuzzleFills,
  active: ActiveCell | null,
  graded: boolean,
  spec: VerticalDigitPuzzleSpec,
  onSelect: (rowKey: string, col: number) => void,
) {
  const prefix = `blk${blockIndex}_`
  const cols = blockPuzzleCols(block)
  return (
    <div className="rounded-xl border border-sky-100 bg-white px-3 py-3">
      {renderEquation(
        {
          ...block,
          knownSymbols: spec.knownSymbols,
          solutionFills: spec.solutionFills,
          readonly: spec.readonly,
        },
        prefix,
        cols,
        blanks,
        fills,
        active,
        graded,
        onSelect,
      )}
    </div>
  )
}

export default function VerticalDigitPuzzlePanel({
  spec,
  onSubmit,
  onStateChange,
  onFillsChange,
  initialFills,
  exportGridRef,
  feedback,
  disabled = false,
  embedded = false,
  padSlot,
}: Props) {
  const blanks = useMemo(() => listPuzzleBlanks(spec), [spec])
  const totalCols = useMemo(() => totalPuzzleCols(spec), [spec])
  const readonly = spec.readonly ?? false
  const [fills, setFills] = useState<VerticalPuzzleFills>(() => initialFills ?? {})
  const [active, setActive] = useState<ActiveCell | null>(() =>
    !readonly && blanks.length > 0 ? { rowKey: blanks[0].rowKey, col: blanks[0].col } : null,
  )
  const [graded, setGraded] = useState(false)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    setFills(initialFills ?? {})
    setGraded(false)
    setLocked(false)
    setActive(!readonly && blanks.length > 0 ? { rowKey: blanks[0].rowKey, col: blanks[0].col } : null)
  }, [spec, blanks, readonly, initialFills])

  const complete = readonly || allBlanksFilled(spec, fills)

  const notifyChange = useCallback(() => {
    onStateChange?.()
    setGraded(false)
  }, [onStateChange])

  const handleDigit = (digit: number) => {
    if (readonly || disabled || locked || !active) return
    const id = blankIdAt(blanks, active.rowKey, active.col)
    if (!id) return
    setFills((prev) => {
      const next = { ...prev, [id]: digit }
      onFillsChange?.(next)
      return next
    })
    notifyChange()

    const idx = blanks.findIndex((b) => b.id === id)
    const next = blanks[idx + 1]
    if (next) setActive({ rowKey: next.rowKey, col: next.col })
  }

  const handleDelete = () => {
    if (readonly || disabled || locked || !active) return
    const id = blankIdAt(blanks, active.rowKey, active.col)
    if (!id) return
    setFills((prev) => {
      const next = { ...prev }
      delete next[id]
      onFillsChange?.(next)
      return next
    })
    notifyChange()
  }

  const handleCheck = () => {
    if (readonly || locked || !complete) return
    const ok = evaluateVerticalPuzzle(spec, fills)
    setGraded(true)
    onSubmit(fills)
    if (ok) setLocked(true)
  }

  const handleAction = () => {
    if (complete) handleCheck()
    else {
      const idx = blanks.findIndex((b) => b.rowKey === active?.rowKey && b.col === active?.col)
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

  const padLocked = readonly || locked || (graded && feedback?.ok)
  const onSelect = (rowKey: string, col: number) => {
    if (!disabled && !locked && !readonly) setActive({ rowKey, col })
  }

  const grid = (
    <div
      ref={exportGridRef}
      data-scratch-puzzle-grid=""
      className={`mx-auto w-fit rounded-2xl border border-sky-100 bg-white p-3 shadow-sm sm:p-4 ${embedded ? 'shadow-none' : ''}`}
    >
      {renderEquation(spec, '', totalCols, blanks, fills, active, graded, onSelect)}
      {spec.blocks && spec.blocks.length > 0 && (
        <div
          className={`mt-3 flex flex-wrap justify-center gap-3 ${spec.blocks.length > 1 ? 'border-t border-sky-100 pt-3' : ''}`}
        >
          {spec.blocks.map((block, bi) =>
            renderBlock(block, bi, blanks, fills, active, graded, spec, onSelect),
          )}
        </div>
      )}
    </div>
  )

  const pad = !readonly && (
    <div className={padLocked ? 'pointer-events-none opacity-50' : ''}>
      <VerticalDigitPad
        variant="light"
        complete={complete}
        disabled={disabled || locked}
        onDigit={handleDigit}
        onDelete={handleDelete}
        onAction={handleAction}
      />
    </div>
  )

  const useExternalPad = padSlot !== undefined
  const padTarget = padSlot ?? null

  const padNode =
    pad &&
    (padTarget
      ? createPortal(pad, padTarget)
      : useExternalPad
        ? null
        : <div className="mt-3">{pad}</div>)

  if (embedded) {
    return (
      <div className="flex flex-col gap-2">
        {grid}
        {feedback?.message && (
          <div
            className={`text-center text-[12px] font-medium ${feedback.ok ? 'text-emerald-600' : 'text-rose-600'}`}
          >
            {feedback.message}
          </div>
        )}
        {padNode}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {!readonly && (
        <div className="mb-1 flex items-center gap-2">
          <div className="h-px flex-1 bg-border-light" />
          <div className="text-text-muted whitespace-nowrap text-xs font-semibold">✏️ 填入竖式方格</div>
          <div className="h-px flex-1 bg-border-light" />
        </div>
      )}

      <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-3 sm:p-4">
        {grid}
        {padNode}
        {!embedded && feedback?.message && (
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
