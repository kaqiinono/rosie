'use client'

import { useEffect, useState } from 'react'
import type { Problem } from '@rosie/core'
import type { ScratchObject } from './scratch-pad-types'
import ScratchPadContentPreview from './ScratchPadContentPreview'
import ScratchPadInsertFigureButton from './ScratchPadInsertFigureButton'
import ScratchPadSelectionActions from './ScratchPadSelectionActions'
import ScratchPadToolbar from './ScratchPadToolbar'
import { useScratchPad } from './useScratchPad'

type ScratchPadInlineProps = {
  problem: Problem
  objects: ScratchObject[]
  onChange?: (objects: ScratchObject[]) => void
  onCollapse?: () => void
  readOnly?: boolean
}

const EDITOR_FIT_HEIGHT = 300

function ScratchPadInlineHeader({
  readOnly,
  problem,
  onInsertFigure,
  onCollapse,
}: {
  readOnly: boolean
  problem: Problem
  onInsertFigure?: (src: string, naturalW: number, naturalH: number) => void
  onCollapse?: () => void
}) {
  return (
    <div className="flex items-center justify-between border-b border-indigo-50 bg-indigo-50/50 px-3 py-2">
      <span className="text-[12px] font-semibold text-indigo-700">
        📝 我的草稿{readOnly ? '（只读）' : ''}
      </span>
      <div className="flex items-center gap-2">
        {!readOnly && onInsertFigure && (
          <ScratchPadInsertFigureButton problem={problem} onInsertFigure={onInsertFigure} compact />
        )}
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="cursor-pointer rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
          >
            收起
          </button>
        )}
      </div>
    </div>
  )
}

function ScratchPadInlineReadOnly({ objects }: { objects: ScratchObject[] }) {
  return <ScratchPadContentPreview objects={objects} />
}

function ScratchPadInlineEditor({
  problem,
  objects,
  onChange,
  onCollapse,
}: {
  problem: Problem
  objects: ScratchObject[]
  onChange?: (objects: ScratchObject[]) => void
  onCollapse?: () => void
}) {
  const {
    canvasRef,
    containerRef,
    tool,
    setTool,
    colorId,
    pickColor,
    highlightColorId,
    pickHighlightColor,
    strokeWidth,
    setStrokeWidth,
    highlightWidth,
    setHighlightWidth,
    shapeFillEnabled,
    setShapeFillEnabled,
    triangleVariant,
    setTriangleVariant,
    eraserWidth,
    setEraserWidth,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    canUndo,
    undo,
    hasSelection,
    selectionCount,
    selectionBoundsRect,
    deleteSelected,
    clearSelection,
    duplicateSelected,
    clearAll,
    insertImage,
  } = useScratchPad(problem.id, {
    initialObjects: objects,
    onObjectsChange: onChange,
    fitContent: true,
  })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        e.preventDefault()
        duplicateSelected()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelected()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [deleteSelected, duplicateSelected])

  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      setCanvasSize({ width: rect.width, height: rect.height })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef])

  return (
    <div className="overflow-hidden rounded-xl border border-indigo-100 bg-[#fafafa]">
      <ScratchPadInlineHeader
        readOnly={false}
        problem={problem}
        onInsertFigure={insertImage}
        onCollapse={onCollapse}
      />
      <div ref={containerRef} className="relative w-full" style={{ height: EDITOR_FIT_HEIGHT }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerLeave}
        />
        {hasSelection && selectionBoundsRect && canvasSize.width > 0 && (
          <ScratchPadSelectionActions
            bounds={selectionBoundsRect}
            count={selectionCount}
            containerWidth={canvasSize.width}
            containerHeight={canvasSize.height}
            activeColorId={colorId}
            onRecolor={(_hex, id) => pickColor(id)}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onClearSelection={clearSelection}
          />
        )}
      </div>
      <ScratchPadToolbar
        tool={tool}
        onToolChange={setTool}
        colorId={colorId}
        onColorChange={pickColor}
        highlightColorId={highlightColorId}
        onHighlightColorChange={pickHighlightColor}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
        highlightWidth={highlightWidth}
        onHighlightWidthChange={setHighlightWidth}
        shapeFillEnabled={shapeFillEnabled}
        onShapeFillChange={setShapeFillEnabled}
        triangleVariant={triangleVariant}
        onTriangleVariantChange={setTriangleVariant}
        eraserWidth={eraserWidth}
        onEraserWidthChange={setEraserWidth}
        canUndo={canUndo}
        onUndo={undo}
        hasSelection={hasSelection}
        onClear={clearAll}
        variant="inline"
      />
    </div>
  )
}

export default function ScratchPadInline({
  problem,
  objects,
  onChange,
  onCollapse,
  readOnly = false,
}: ScratchPadInlineProps) {
  if (readOnly) {
    return <ScratchPadInlineReadOnly objects={objects} />
  }

  return (
    <ScratchPadInlineEditor
      problem={problem}
      objects={objects}
      onChange={onChange}
      onCollapse={onCollapse}
    />
  )
}
