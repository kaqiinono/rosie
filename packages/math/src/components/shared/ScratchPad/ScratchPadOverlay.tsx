'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Problem } from '@rosie/core'
import ScratchPadQuestionFloat from './ScratchPadQuestionFloat'
import ScratchPadSelectionActions from './ScratchPadSelectionActions'
import ScratchPadToolbar from './ScratchPadToolbar'
import type { ScratchObject } from './scratch-pad-types'
import { useScratchPad } from './useScratchPad'

type ScratchPadOverlayProps = {
  problem: Problem
  initialObjects?: ScratchObject[]
  onClose: () => void
  onSave?: (objects: ScratchObject[]) => void
  onEmbedBelow?: (objects: ScratchObject[]) => void
  readOnly?: boolean
}

export default function ScratchPadOverlay({
  problem,
  initialObjects,
  onClose,
  onSave,
  onEmbedBelow,
  readOnly = false,
}: ScratchPadOverlayProps) {
  const {
    canvasRef,
    containerRef,
    tool,
    setTool,
    colorId,
    pickColor,
    strokeWidth,
    setStrokeWidth,
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
    getObjects,
  } = useScratchPad(problem.id, { initialObjects })
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      setContainerSize({ width: rect.width, height: rect.height })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef])

  useEffect(() => {
    if (readOnly) return
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        e.preventDefault()
        duplicateSelected()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelected()
        return
      }
      if (e.key === 'Escape') {
        clearSelection()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [deleteSelected, clearSelection, duplicateSelected, readOnly])

  const handleClose = () => {
    if (!readOnly) onSave?.(getObjects())
    onClose()
  }

  const handleEmbedBelow = () => {
    const objects = getObjects()
    onSave?.(objects)
    onEmbedBelow?.(objects)
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#fafafa]">
      <div ref={containerRef} className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 touch-none${readOnly ? ' pointer-events-none' : ''}`}
          onPointerDown={readOnly ? undefined : handlePointerDown}
          onPointerMove={readOnly ? undefined : handlePointerMove}
          onPointerUp={readOnly ? undefined : handlePointerUp}
          onPointerCancel={readOnly ? undefined : handlePointerUp}
          onPointerLeave={readOnly ? undefined : handlePointerLeave}
        />
        {!readOnly && (
          <ScratchPadQuestionFloat problem={problem} onInsertFigure={insertImage} />
        )}
        {!readOnly && hasSelection && selectionBoundsRect && containerSize.width > 0 && (
          <ScratchPadSelectionActions
            bounds={selectionBoundsRect}
            count={selectionCount}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
            activeColorId={colorId}
            onRecolor={(_hex, id) => pickColor(id)}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onClearSelection={clearSelection}
          />
        )}
      </div>

      {readOnly ? (
        <div
          className="shrink-0 border-t border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur-md"
          style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-semibold text-slate-500">草稿只读，不可修改</span>
            <button
              type="button"
              onClick={handleClose}
              className="cursor-pointer rounded-lg bg-indigo-500 px-4 py-2 text-[12px] font-bold text-white shadow-sm active:scale-95"
            >
              关闭
            </button>
          </div>
        </div>
      ) : (
        <ScratchPadToolbar
          tool={tool}
          onToolChange={setTool}
          colorId={colorId}
          onColorChange={pickColor}
          strokeWidth={strokeWidth}
          onStrokeWidthChange={setStrokeWidth}
          eraserWidth={eraserWidth}
          onEraserWidthChange={setEraserWidth}
          canUndo={canUndo}
          onUndo={undo}
          hasSelection={hasSelection}
          selectionCount={selectionCount}
          onDeleteSelected={deleteSelected}
          onClearSelection={clearSelection}
          onDuplicateSelected={duplicateSelected}
          onClear={clearAll}
          onClose={handleClose}
          onEmbedBelow={onEmbedBelow ? handleEmbedBelow : undefined}
        />
      )}
    </div>,
    document.body,
  )
}
