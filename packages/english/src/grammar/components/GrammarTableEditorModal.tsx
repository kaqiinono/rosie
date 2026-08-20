'use client'

import { useEffect, useMemo, useState, type ClipboardEvent as ReactClipboardEvent } from 'react'
import type { GrammarTableBlock, GrammarTableMerge } from '../types'
import { GrammarTableView } from './LessonView'

interface GrammarTableEditorModalProps {
  table: GrammarTableBlock
  onSave: (table: GrammarTableBlock) => Promise<void>
  onClose: () => void
}

interface CellPosition {
  /** -1 表示表头，0 起表示正文行 */
  row: number
  column: number
}

function encodeTsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) =>
          /[\t\r\n"]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell,
        )
        .join('\t'),
    )
    .join('\n')
}

/** 解析 Excel/Sheets 剪贴板 TSV，并保留带引号单元格中的换行与制表符。 */
function decodeTsv(text: string): string[][] {
  const rows: string[][] = [[]]
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (char === '\t' && !quoted) {
      rows[rows.length - 1].push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      rows[rows.length - 1].push(cell)
      rows.push([])
      cell = ''
    } else {
      cell += char
    }
  }
  rows[rows.length - 1].push(cell)
  if (rows.length > 1 && rows.at(-1)?.length === 1 && rows.at(-1)?.[0] === '') rows.pop()
  return rows
}

function rectangularTable(table: GrammarTableBlock): GrammarTableBlock {
  const columns = Math.max(1, table.headers.length, ...table.rows.map((row) => row.length))
  return {
    ...table,
    headers: Array.from({ length: columns }, (_, index) => table.headers[index] ?? ''),
    rows: table.rows.map((row) =>
      Array.from({ length: columns }, (_, index) => row[index] ?? ''),
    ),
  }
}

export function GrammarTableEditorModal({ table, onSave, onClose }: GrammarTableEditorModalProps) {
  const [draft, setDraft] = useState(() => rectangularTable(table))
  const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null)
  const [selectionAnchor, setSelectionAnchor] = useState<CellPosition | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<CellPosition | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const columnCount = draft.headers.length
  const preview = useMemo(() => rectangularTable(draft), [draft])
  const selectionBounds = useMemo(() => {
    if (!selectionAnchor || !selectionEnd) return null
    return {
      top: Math.min(selectionAnchor.row, selectionEnd.row),
      bottom: Math.max(selectionAnchor.row, selectionEnd.row),
      left: Math.min(selectionAnchor.column, selectionEnd.column),
      right: Math.max(selectionAnchor.column, selectionEnd.column),
    }
  }, [selectionAnchor, selectionEnd])
  const multiCellSelection = selectionBounds !== null &&
    (selectionBounds.top !== selectionBounds.bottom || selectionBounds.left !== selectionBounds.right)
  const bodyCellSelected = selectedCell !== null && selectedCell.row >= 0
  const selectedMerge = selectedCell
    ? draft.merges?.find(
        (merge) =>
          selectedCell.row >= merge.row &&
          selectedCell.row < merge.row + merge.rowSpan &&
          selectedCell.column >= merge.column &&
          selectedCell.column < merge.column + merge.colSpan,
      )
    : undefined

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, saving])

  const selectCell = (position: CellPosition, extend: boolean) => {
    setSelectedCell(position)
    if (extend && selectionAnchor) {
      setSelectionEnd(position)
    } else {
      setSelectionAnchor(position)
      setSelectionEnd(position)
    }
  }

  const selectSingleCell = (position: CellPosition) => {
    setSelectedCell(position)
    setSelectionAnchor(position)
    setSelectionEnd(position)
  }

  const clearSelection = () => {
    clearSelection()
    setSelectionAnchor(null)
    setSelectionEnd(null)
  }

  const isInSelection = (row: number, column: number): boolean =>
    selectionBounds !== null &&
    row >= selectionBounds.top &&
    row <= selectionBounds.bottom &&
    column >= selectionBounds.left &&
    column <= selectionBounds.right

  const handleGridCopy = (event: ReactClipboardEvent<HTMLDivElement>) => {
    if (!selectionBounds || !multiCellSelection) return
    const copied: string[][] = []
    for (let row = selectionBounds.top; row <= selectionBounds.bottom; row += 1) {
      const values: string[] = []
      for (let column = selectionBounds.left; column <= selectionBounds.right; column += 1) {
        values.push(row === -1 ? draft.headers[column] ?? '' : draft.rows[row]?.[column] ?? '')
      }
      copied.push(values)
    }
    event.preventDefault()
    event.clipboardData.setData('text/plain', encodeTsv(copied))
  }

  const handleGridPaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
    if (!selectedCell) return
    const text = event.clipboardData.getData('text/plain')
    if (!/[\t\r\n]/.test(text)) return
    const pasted = decodeTsv(text)
    if (pasted.length === 0) return
    event.preventDefault()
    const start = selectionBounds
      ? { row: selectionBounds.top, column: selectionBounds.left }
      : selectedCell
    const pastedColumns = Math.max(1, ...pasted.map((row) => row.length))
    const requiredColumns = start.column + pastedColumns
    const sourceBodyStart = start.row === -1 ? 1 : 0
    const targetBodyStart = Math.max(0, start.row)
    const requiredBodyRows = targetBodyStart + Math.max(0, pasted.length - sourceBodyStart)

    setDraft((current) => {
      const columns = Math.max(current.headers.length, requiredColumns)
      const headers = Array.from({ length: columns }, (_, column) => current.headers[column] ?? '')
      const rows = Array.from({ length: Math.max(current.rows.length, requiredBodyRows) }, (_, row) =>
        Array.from({ length: columns }, (__, column) => current.rows[row]?.[column] ?? ''),
      )
      if (start.row === -1) {
        pasted[0].forEach((value, column) => {
          headers[start.column + column] = value
        })
      }
      for (let sourceRow = sourceBodyStart; sourceRow < pasted.length; sourceRow += 1) {
        const targetRow = targetBodyStart + sourceRow - sourceBodyStart
        pasted[sourceRow].forEach((value, column) => {
          rows[targetRow][start.column + column] = value
        })
      }
      return { ...current, headers, rows }
    })

    const pastedBottom = start.row === -1
      ? pasted.length - 2
      : start.row + pasted.length - 1
    const nextEnd = {
      row: Math.max(start.row, pastedBottom),
      column: start.column + pastedColumns - 1,
    }
    setSelectedCell(start)
    setSelectionAnchor(start)
    setSelectionEnd(nextEnd)
  }

  const setHeader = (columnIndex: number, value: string) => {
    setDraft((current) => ({
      ...current,
      headers: current.headers.map((cell, index) => (index === columnIndex ? value : cell)),
    }))
  }

  const setCell = (rowIndex: number, columnIndex: number, value: string) => {
    setDraft((current) => ({
      ...current,
      rows: current.rows.map((row, ri) =>
        ri === rowIndex
          ? row.map((cell, ci) => (ci === columnIndex ? value : cell))
          : row,
      ),
    }))
  }

  const removeColumn = (columnIndex: number) => {
    if (columnCount <= 1) return
    setDraft((current) => ({
      ...current,
      headers: current.headers.filter((_, index) => index !== columnIndex),
      rows: current.rows.map((row) => row.filter((_, index) => index !== columnIndex)),
      merges: [],
    }))
    clearSelection()
  }

  const removeRow = (rowIndex: number) => {
    setDraft((current) => ({
      ...current,
      rows: current.rows.filter((_, index) => index !== rowIndex),
      merges: [],
    }))
    setSelectedCell(null)
  }

  const mergeSelected = (direction: 'right' | 'down') => {
    if (!selectedCell || selectedCell.row < 0) return
    setDraft((current) => {
      const merges = current.merges ?? []
      const existing = merges.find(
        (merge) =>
          selectedCell.row >= merge.row &&
          selectedCell.row < merge.row + merge.rowSpan &&
          selectedCell.column >= merge.column &&
          selectedCell.column < merge.column + merge.colSpan,
      )
      const base: GrammarTableMerge = existing ?? {
        row: selectedCell.row,
        column: selectedCell.column,
        rowSpan: 1,
        colSpan: 1,
      }
      const next: GrammarTableMerge = {
        ...base,
        rowSpan: base.rowSpan + (direction === 'down' ? 1 : 0),
        colSpan: base.colSpan + (direction === 'right' ? 1 : 0),
      }
      if (
        next.row + next.rowSpan > current.rows.length ||
        next.column + next.colSpan > current.headers.length
      ) return current

      const overlaps = merges.some(
        (merge) =>
          merge !== existing &&
          next.row < merge.row + merge.rowSpan &&
          next.row + next.rowSpan > merge.row &&
          next.column < merge.column + merge.colSpan &&
          next.column + next.colSpan > merge.column,
      )
      if (overlaps) return current
      let rows = current.rows
      if (direction === 'down') {
        const addedRowIndex = next.row + next.rowSpan - 1
        const additions = current.rows[addedRowIndex]
          ?.slice(next.column, next.column + next.colSpan)
          .filter((cell) => cell.trim() !== '') ?? []
        if (additions.length > 0) {
          const anchor = current.rows[next.row]?.[next.column] ?? ''
          const seen = new Set<string>()
          const combined = [anchor, ...additions]
            .flatMap((cell) => cell.split('\n'))
            .map((line) => line.trim())
            .filter((line) => {
              if (line === '' || seen.has(line)) return false
              seen.add(line)
              return true
            })
            .join('\n')
          rows = current.rows.map((row, rowIndex) =>
            rowIndex === next.row
              ? row.map((cell, columnIndex) =>
                  columnIndex === next.column ? combined : cell,
                )
              : row,
          )
        }
      }
      return {
        ...current,
        rows,
        merges: existing
          ? merges.map((merge) => (merge === existing ? next : merge))
          : [...merges, next],
      }
    })
  }

  const unmergeSelected = () => {
    if (!selectedCell || selectedCell.row < 0) return
    setDraft((current) => ({
      ...current,
      // 空数组同时表示关闭旧表的自动合并推断。
      merges: (current.merges ?? []).filter(
        (merge) =>
          !(
            selectedCell.row >= merge.row &&
            selectedCell.row < merge.row + merge.rowSpan &&
            selectedCell.column >= merge.column &&
            selectedCell.column < merge.column + merge.colSpan
          ),
      ),
    }))
  }

  const insertRowBelow = () => {
    if (!selectedCell) return
    const insertIndex = selectedCell.row + 1
    setDraft((current) => ({
      ...current,
      rows: [
        ...current.rows.slice(0, insertIndex),
        Array<string>(current.headers.length).fill(''),
        ...current.rows.slice(insertIndex),
      ],
      merges: current.merges?.map((merge) => {
        if (insertIndex <= merge.row) return { ...merge, row: merge.row + 1 }
        if (insertIndex < merge.row + merge.rowSpan) {
          return { ...merge, rowSpan: merge.rowSpan + 1 }
        }
        return merge
      }),
    }))
    selectSingleCell({ row: insertIndex, column: selectedCell.column })
  }

  const insertColumnRight = () => {
    if (!selectedCell) return
    const insertIndex = selectedCell.column + 1
    setDraft((current) => ({
      ...current,
      headers: [
        ...current.headers.slice(0, insertIndex),
        '',
        ...current.headers.slice(insertIndex),
      ],
      rows: current.rows.map((row) => [
        ...row.slice(0, insertIndex),
        '',
        ...row.slice(insertIndex),
      ]),
      merges: current.merges?.map((merge) => {
        if (insertIndex <= merge.column) return { ...merge, column: merge.column + 1 }
        if (insertIndex < merge.column + merge.colSpan) {
          return { ...merge, colSpan: merge.colSpan + 1 }
        }
        return merge
      }),
    }))
    selectSingleCell({ row: selectedCell.row, column: insertIndex })
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(preview)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="grammar-table-editor-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose()
      }}
    >
      <div className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl ring-1 ring-border-light">
        <header className="flex items-center justify-between gap-3 border-b border-border-light px-4 py-3 sm:px-5">
          <div>
            <h2 id="grammar-table-editor-title" className="font-black text-text-primary">
              编辑语法表格
            </h2>
            <p className="text-xs text-text-muted">Shift 点击选择区域 · ⌘/Ctrl+C、V 复制粘贴</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="关闭表格编辑器"
            className="min-h-11 min-w-11 rounded-full text-lg font-bold text-text-secondary transition-colors hover:bg-surface-dim disabled:opacity-40"
          >
            ×
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-3 border-b border-border-light p-4 lg:border-r lg:border-b-0 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex min-w-[260px] flex-1 items-center gap-2 text-xs font-bold text-text-secondary">
                <span className="shrink-0">表格标题</span>
              <input
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  className="min-h-10 min-w-0 flex-1 rounded-lg bg-surface px-3 text-sm text-text-primary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue"
                placeholder="可留空"
              />
              </label>
              <span className="shrink-0 rounded-lg bg-app-blue-light/50 px-3 py-2 text-xs font-bold text-app-blue-dark">
                {multiCellSelection && selectionBounds
                  ? `已选 ${selectionBounds.bottom - selectionBounds.top + 1} × ${selectionBounds.right - selectionBounds.left + 1}`
                  : selectedCell
                  ? selectedCell.row < 0
                    ? `表头 · 第 ${selectedCell.column + 1} 列`
                    : `第 ${selectedCell.row + 1} 行 · 第 ${selectedCell.column + 1} 列`
                  : '未选择单元格'}
              </span>
            </div>

            <div className="overflow-x-auto pb-2">
              <div className="mb-3 flex min-w-max items-center gap-1.5 rounded-lg bg-surface-dim p-1.5 ring-1 ring-border-light">
                      <button
                        type="button"
                        onClick={insertRowBelow}
                        disabled={!selectedCell}
                  className="min-h-8 rounded-md bg-surface px-2.5 text-xs font-bold whitespace-nowrap text-text-secondary disabled:opacity-35"
                      >
                  ＋ 行
                      </button>
                      <button
                        type="button"
                        onClick={insertColumnRight}
                        disabled={!selectedCell}
                  className="min-h-8 rounded-md bg-surface px-2.5 text-xs font-bold whitespace-nowrap text-text-secondary disabled:opacity-35"
                      >
                  ＋ 列
                      </button>
                <span className="mx-0.5 h-5 w-px bg-border-light" />
                      <button
                        type="button"
                        onClick={() => mergeSelected('right')}
                        disabled={!bodyCellSelected}
                  className="min-h-8 rounded-md bg-app-blue-light/50 px-2.5 text-xs font-bold whitespace-nowrap text-app-blue disabled:opacity-35"
                      >
                  合并 →
                      </button>
                      <button
                        type="button"
                        onClick={() => mergeSelected('down')}
                        disabled={!bodyCellSelected}
                  className="min-h-8 rounded-md bg-app-blue-light/50 px-2.5 text-xs font-bold whitespace-nowrap text-app-blue disabled:opacity-35"
                      >
                  合并 ↓
                      </button>
                      <button
                        type="button"
                        onClick={unmergeSelected}
                        disabled={!bodyCellSelected || (!selectedMerge && draft.merges !== undefined)}
                  className="min-h-8 rounded-md bg-surface px-2.5 text-xs font-bold whitespace-nowrap text-text-secondary disabled:opacity-35"
                      >
                        取消合并
                      </button>
                <span className="mx-0.5 h-5 w-px bg-border-light" />
                      <button
                        type="button"
                        onClick={() => selectedCell && selectedCell.row >= 0 && removeRow(selectedCell.row)}
                        disabled={!bodyCellSelected}
                  className="min-h-8 rounded-md bg-app-red-light/35 px-2.5 text-xs font-bold whitespace-nowrap text-app-red disabled:opacity-35"
                      >
                  删行
                      </button>
                      <button
                        type="button"
                        onClick={() => selectedCell && removeColumn(selectedCell.column)}
                        disabled={!selectedCell || columnCount <= 1}
                  className="min-h-8 rounded-md bg-app-red-light/35 px-2.5 text-xs font-bold whitespace-nowrap text-app-red disabled:opacity-35"
                      >
                  删列
                      </button>
              </div>
              <div
                className="min-w-max space-y-2"
                onCopy={handleGridCopy}
                onPaste={handleGridPaste}
              >
                <div className="flex items-stretch gap-2">
                  <span className="flex w-12 shrink-0 items-center justify-center text-xs font-bold text-text-muted">表头</span>
                  {draft.headers.map((header, columnIndex) => (
                    <div key={columnIndex} className="w-36 min-w-0 shrink-0">
                      <textarea
                        value={header}
                        onFocus={() => setSelectedCell({ row: -1, column: columnIndex })}
                        onClick={(event) =>
                          selectCell({ row: -1, column: columnIndex }, event.shiftKey)
                        }
                        onChange={(event) => setHeader(columnIndex, event.target.value)}
                        aria-label={`第 ${columnIndex + 1} 列表头`}
                        className={`block min-h-16 w-full max-w-full resize-y rounded-lg bg-app-blue-light/50 p-2 text-sm font-bold text-text-primary outline-none ring-1 focus:ring-2 focus:ring-app-blue ${
                          selectedCell?.row === -1 && selectedCell.column === columnIndex
                            ? 'ring-2 ring-app-blue'
                            : isInSelection(-1, columnIndex)
                              ? 'ring-2 ring-app-blue/40'
                            : 'ring-border-light'
                        }`}
                      />
                    </div>
                  ))}
                </div>

                {draft.rows.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex items-stretch gap-2">
                    <span className="flex w-12 shrink-0 items-center justify-center text-xs font-bold text-text-muted">
                      第 {rowIndex + 1} 行
                    </span>
                    {row.map((cell, columnIndex) => {
                      const inMerge = draft.merges?.some(
                        (merge) =>
                          rowIndex >= merge.row &&
                          rowIndex < merge.row + merge.rowSpan &&
                          columnIndex >= merge.column &&
                          columnIndex < merge.column + merge.colSpan,
                      )
                      return (
                        <div key={columnIndex} className="relative w-36 min-w-0 shrink-0">
                          <textarea
                            value={cell}
                            onFocus={() => setSelectedCell({ row: rowIndex, column: columnIndex })}
                            onClick={(event) =>
                              selectCell({ row: rowIndex, column: columnIndex }, event.shiftKey)
                            }
                            onChange={(event) => setCell(rowIndex, columnIndex, event.target.value)}
                            aria-label={`第 ${rowIndex + 1} 行第 ${columnIndex + 1} 列`}
                            className={`block min-h-16 w-full max-w-full resize-y rounded-lg bg-surface p-2 text-sm text-text-primary outline-none ring-1 focus:ring-2 focus:ring-app-blue ${
                              selectedCell?.row === rowIndex && selectedCell.column === columnIndex
                                ? 'ring-2 ring-app-blue'
                                : isInSelection(rowIndex, columnIndex)
                                  ? 'bg-app-blue-light/35 ring-2 ring-app-blue/40'
                                : 'ring-border-light'
                            }`}
                          />
                          {inMerge && (
                            <span className="pointer-events-none absolute right-1 bottom-1 rounded bg-app-purple-light px-1.5 py-0.5 text-[9px] font-bold text-app-purple-dark">
                              合并区
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

          </div>

          <aside className="min-w-0 bg-surface-dim/45 p-4 sm:p-5">
            <div className="sticky top-0">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-black text-text-primary">实时效果</h3>
                <span className="rounded-full bg-app-green-light px-2.5 py-1 text-[11px] font-bold text-app-green-dark">
                  自动更新
                </span>
              </div>
              <GrammarTableView block={preview} />
            </div>
          </aside>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border-light px-4 py-3 sm:px-5">
          {error && <p role="alert" className="mr-auto text-sm font-bold text-app-red">{error}</p>}
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-11 rounded-full px-5 text-sm font-bold text-text-secondary ring-1 ring-border-light disabled:opacity-40"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="min-h-11 rounded-full bg-app-blue px-6 text-sm font-bold text-white shadow-md disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存并应用'}
          </button>
        </footer>
      </div>
    </div>
  )
}
