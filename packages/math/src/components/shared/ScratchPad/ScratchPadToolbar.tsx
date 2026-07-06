'use client'

import clsx from 'clsx'
import type { ScratchColorId, ScratchEraserWidth, ScratchStrokeWidth, ScratchTool } from './scratch-pad-types'
import { SCRATCH_COLORS, SCRATCH_ERASER_WIDTHS, SCRATCH_STROKE_WIDTHS } from './scratch-pad-types'

type ToolDef = { id: ScratchTool; label: string; icon: string }

const TOOLS: ToolDef[] = [
  { id: 'select-box', label: '框选', icon: '▢' },
  { id: 'select-lasso', label: '套索', icon: '◠' },
  { id: 'pen', label: '画笔', icon: '✏️' },
  { id: 'line', label: '直线', icon: '／' },
  { id: 'rect', label: '矩形', icon: '▭' },
  { id: 'circle', label: '圆形', icon: '○' },
  { id: 'triangle', label: '三角', icon: '△' },
  { id: 'eraser', label: '橡皮', icon: '⌫' },
]

type ScratchPadToolbarProps = {
  tool: ScratchTool
  onToolChange: (tool: ScratchTool) => void
  colorId: ScratchColorId
  onColorChange: (id: ScratchColorId) => void
  strokeWidth: ScratchStrokeWidth
  onStrokeWidthChange: (w: ScratchStrokeWidth) => void
  eraserWidth: ScratchEraserWidth
  onEraserWidthChange: (w: ScratchEraserWidth) => void
  canUndo: boolean
  onUndo: () => void
  hasSelection: boolean
  selectionCount: number
  onDeleteSelected: () => void
  onClearSelection: () => void
  onDuplicateSelected: () => void
  onClear: () => void
  onClose?: () => void
  variant?: 'overlay' | 'inline'
  onEmbedBelow?: () => void
}

function ToolButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean
  label: string
  icon: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={clsx(
        'flex h-9 min-w-9 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl px-1.5 text-[10px] font-semibold transition-all active:scale-95',
        active
          ? 'bg-indigo-500 text-white shadow-[0_4px_12px_rgba(99,102,241,0.35)]'
          : 'bg-white/80 text-slate-600 hover:bg-white',
      )}
    >
      <span className="text-[15px] leading-none">{icon}</span>
      <span className="mt-0.5 leading-none">{label}</span>
    </button>
  )
}

export default function ScratchPadToolbar({
  tool,
  onToolChange,
  colorId,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  eraserWidth,
  onEraserWidthChange,
  canUndo,
  onUndo,
  hasSelection,
  selectionCount,
  onDeleteSelected,
  onClearSelection,
  onDuplicateSelected,
  onClear,
  onClose,
  variant = 'overlay',
  onEmbedBelow,
}: ScratchPadToolbarProps) {
  return (
    <div
      className="relative z-20 shrink-0 border-t border-slate-200/80 bg-white/95 backdrop-blur-md"
      style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
    >
      {hasSelection && (
        <div className="flex items-center justify-between gap-2 border-b border-indigo-100 bg-indigo-50/90 px-3 py-2">
          <span className="min-w-0 text-[12px] font-semibold text-indigo-700">
            <span>已选 {selectionCount} 项</span>
            <span className="hidden text-indigo-600/80 sm:inline"> · 点色换色 · 拖移 · 拖角缩放</span>
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onDuplicateSelected}
              className="cursor-pointer rounded-lg bg-indigo-500 px-3 py-1.5 text-[12px] font-bold text-white shadow-sm active:scale-95"
            >
              复制
            </button>
            <button
              type="button"
              onClick={onDeleteSelected}
              className="cursor-pointer rounded-lg bg-rose-500 px-3 py-1.5 text-[12px] font-bold text-white shadow-sm active:scale-95"
            >
              删除
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              className="cursor-pointer rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 ring-1 ring-slate-200 active:scale-95"
            >
              取消
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-1.5 overflow-x-auto px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TOOLS.map((t) => (
          <ToolButton
            key={t.id}
            active={tool === t.id}
            label={t.label}
            icon={t.icon}
            onClick={() => onToolChange(t.id)}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2">
        {tool === 'eraser' ? (
          <>
            <span className="shrink-0 text-[11px] font-semibold text-slate-500">橡皮大小</span>
            <div className="flex items-center gap-1.5">
              {SCRATCH_ERASER_WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  title={`${w}px`}
                  onClick={() => onEraserWidthChange(w)}
                  className={clsx(
                    'flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-all active:scale-95',
                    eraserWidth === w ? 'bg-slate-200 ring-2 ring-slate-500' : 'bg-slate-50 hover:bg-slate-100',
                  )}
                >
                  <span
                    className="rounded-full border border-slate-400/60 bg-white/80"
                    style={{ width: Math.min(w, 28), height: Math.min(w, 28) }}
                  />
                </button>
              ))}
            </div>
            <span className="hidden text-[11px] text-slate-400 sm:inline">按住拖动擦除</span>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              {SCRATCH_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  onClick={() => onColorChange(c.id)}
                  className={clsx(
                    'h-6 w-6 shrink-0 cursor-pointer rounded-full border-2 transition-transform active:scale-90',
                    colorId === c.id ? 'scale-110 border-slate-800 shadow-md' : 'border-white shadow-sm',
                    hasSelection && 'ring-1 ring-indigo-200',
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>

            <div className="mx-1 h-5 w-px shrink-0 bg-slate-200" />

            <div className="flex items-center gap-1">
              {SCRATCH_STROKE_WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  title={`${w}px`}
                  onClick={() => onStrokeWidthChange(w)}
                  className={clsx(
                    'flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-all active:scale-95',
                    strokeWidth === w ? 'bg-indigo-100 ring-2 ring-indigo-400' : 'bg-slate-50 hover:bg-slate-100',
                  )}
                >
                  <span
                    className="rounded-full bg-slate-700"
                    style={{ width: w + 4, height: w + 4 }}
                  />
                </button>
              ))}
            </div>
          </>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            className="cursor-pointer rounded-lg bg-slate-100 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 transition-all hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            撤销
          </button>
          <button
            type="button"
            disabled={!hasSelection}
            onClick={onDeleteSelected}
            className={clsx(
              'cursor-pointer rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40',
              hasSelection
                ? 'bg-rose-500 font-bold text-white shadow-[0_4px_12px_rgba(244,63,94,0.3)] active:scale-95'
                : 'bg-rose-50 text-rose-600',
            )}
          >
            删除
          </button>
          <button
            type="button"
            onClick={onClear}
            className="cursor-pointer rounded-lg bg-slate-100 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 transition-all hover:bg-slate-200"
          >
            清空
          </button>
          {onEmbedBelow && (
            <button
              type="button"
              onClick={onEmbedBelow}
              className="cursor-pointer rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[12px] font-semibold text-indigo-600 transition-all hover:bg-indigo-100 active:scale-95"
            >
              附在题目下
            </button>
          )}
          {variant === 'overlay' && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg bg-indigo-500 px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)] transition-all hover:bg-indigo-600 active:scale-95"
            >
              完成
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
