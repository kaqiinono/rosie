'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Problem } from '@rosie/core'
import type { ScratchSessionMode } from '@rosie/math/hooks/math-scratch-types'
import ScratchPadQuestionFloat from './ScratchPadQuestionFloat'
import ScratchPadSelectionActions from './ScratchPadSelectionActions'
import ScratchPadToolbar from './ScratchPadToolbar'
import ScratchPadEdgeNav from './ScratchPadEdgeNav'
import type { ScratchObject } from './scratch-pad-types'
import { useScratchPad } from './useScratchPad'

type EdgeNavConfig = {
  hasPrev: boolean
  hasNext: boolean
  positionLabel: string
  onPrev: () => void
  onNext: () => void
}

type ScratchPadOverlayProps = {
  problem: Problem
  initialObjects?: ScratchObject[]
  showCanvas?: boolean
  questionExpandedDefault?: boolean
  mode?: ScratchSessionMode
  section?: string
  attemptRefreshKey?: number
  answerDraft?: unknown
  mistakeHint?: string
  onClose: () => void
  onObjectsChange?: (objects: ScratchObject[]) => void
  onAnswerDraftChange?: (snapshot: unknown) => void
  onSubmitResult?: (correct: boolean, snapshot: unknown) => void
  edgeNav?: EdgeNavConfig
  readOnly?: boolean
}

export default function ScratchPadOverlay({
  problem,
  initialObjects,
  showCanvas = true,
  questionExpandedDefault = false,
  mode = 'practice',
  section = '',
  attemptRefreshKey = 0,
  answerDraft,
  mistakeHint,
  onClose,
  onObjectsChange,
  onAnswerDraftChange,
  onSubmitResult,
  edgeNav,
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
  } = useScratchPad(problem.id, {
    initialObjects,
    onObjectsChange,
  })
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    if (!showCanvas) return
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
  }, [containerRef, showCanvas])

  useEffect(() => {
    if (readOnly) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (!showCanvas) return
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
  }, [deleteSelected, clearSelection, duplicateSelected, readOnly, showCanvas])

  const handleClose = () => {
    if (!readOnly && showCanvas) onObjectsChange?.(getObjects())
    onClose()
  }

  const answerMode = mode === 'quiz' ? 'quiz' : 'practice'
  const showAnswerPanel = mode === 'practice'

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#fafafa]">
      <div
        ref={showCanvas ? containerRef : undefined}
        className={`relative min-h-0 flex-1 ${showCanvas ? '' : 'flex items-start justify-center pt-4'}`}
      >
        {showCanvas && (
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 touch-none${readOnly ? ' pointer-events-none' : ''}`}
            onPointerDown={readOnly ? undefined : handlePointerDown}
            onPointerMove={readOnly ? undefined : handlePointerMove}
            onPointerUp={readOnly ? undefined : handlePointerUp}
            onPointerCancel={readOnly ? undefined : handlePointerUp}
            onPointerLeave={readOnly ? undefined : handlePointerLeave}
          />
        )}

        {!showCanvas && !readOnly && (
          <div className="w-full max-w-md px-4">
            <ScratchPadQuestionFloat
              problem={problem}
              expandedDefault={questionExpandedDefault}
              mistakeHint={mistakeHint}
              section={section}
              attemptRefreshKey={attemptRefreshKey}
              showAnswerPanel
              answerMode={answerMode}
              initialAnswer={answerDraft}
              onAnswerDraftChange={onAnswerDraftChange}
              onSubmitResult={onSubmitResult}
            />
          </div>
        )}

        {!showCanvas && readOnly && (
          <div className="px-4 text-center text-[13px] text-slate-500">
            本题错时未使用草稿纸
          </div>
        )}

        {!readOnly && showCanvas && (
          <ScratchPadQuestionFloat
            problem={problem}
            onInsertFigure={insertImage}
            expandedDefault={questionExpandedDefault}
            mistakeHint={mistakeHint}
            section={section}
            attemptRefreshKey={attemptRefreshKey}
            showAnswerPanel={showAnswerPanel}
            answerMode={answerMode}
            initialAnswer={answerDraft}
            onAnswerDraftChange={onAnswerDraftChange}
            onSubmitResult={onSubmitResult}
          />
        )}

        {readOnly && (
          <ScratchPadQuestionFloat
            problem={problem}
            expandedDefault
            section={section}
            attemptRefreshKey={attemptRefreshKey}
            showAnswerPanel={false}
          />
        )}

        {!readOnly && showCanvas && hasSelection && selectionBoundsRect && containerSize.width > 0 && (
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

        {edgeNav && <ScratchPadEdgeNav {...edgeNav} />}
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
      ) : showCanvas ? (
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
        />
      ) : (
        <div
          className="shrink-0 border-t border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur-md"
          style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={handleClose}
            className="w-full cursor-pointer rounded-lg bg-indigo-500 py-2.5 text-[13px] font-bold text-white shadow-sm active:scale-95"
          >
            关闭
          </button>
        </div>
      )}
    </div>,
    document.body,
  )
}
