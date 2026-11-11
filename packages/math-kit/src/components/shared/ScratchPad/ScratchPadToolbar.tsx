'use client'

import clsx from 'clsx'
import type {
  ScratchColorId,
  ScratchEraserWidth,
  ScratchHighlightColorId,
  ScratchHighlightWidth,
  ScratchStrokeWidth,
  ScratchTool,
  ScratchTriangleVariant,
} from './scratch-pad-types'
import {
  SCRATCH_COLORS,
  SCRATCH_ERASER_WIDTHS,
  SCRATCH_HIGHLIGHT_COLORS,
  SCRATCH_HIGHLIGHT_WIDTHS,
  SCRATCH_STROKE_WIDTHS,
  SCRATCH_TRIANGLE_VARIANTS,
} from './scratch-pad-types'
import { Button, SegmentedControl } from '@rosie/ui/themes'

type ToolDef = { id: ScratchTool; label: string; icon: string }

const TOOLS: ToolDef[] = [
  { id: 'select-box', label: '框选', icon: '▢' },
  { id: 'select-lasso', label: '套索', icon: '◠' },
  { id: 'pan', label: '移动', icon: '✋' },
  { id: 'pen', label: '画笔', icon: '✏️' },
  { id: 'highlighter', label: '荧光', icon: '🖍️' },
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
  highlightColorId: ScratchHighlightColorId
  onHighlightColorChange: (id: ScratchHighlightColorId) => void
  strokeWidth: ScratchStrokeWidth
  onStrokeWidthChange: (w: ScratchStrokeWidth) => void
  highlightWidth: ScratchHighlightWidth
  onHighlightWidthChange: (w: ScratchHighlightWidth) => void
  shapeFillEnabled: boolean
  onShapeFillChange: (enabled: boolean) => void
  triangleVariant: ScratchTriangleVariant
  onTriangleVariantChange: (variant: ScratchTriangleVariant) => void
  eraserWidth: ScratchEraserWidth
  onEraserWidthChange: (w: ScratchEraserWidth) => void
  canUndo: boolean
  onUndo: () => void
  hasSelection?: boolean
  onClear: () => void
  onClose?: () => void
  closeLabel?: string
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
    // native-ok: 绘图工具面板按钮，图标 + 文字上下两行排布，Radix Button 为单行居中会被挤压
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={clsx(
        'flex h-9 min-w-9 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl px-1.5 text-[10px] font-semibold transition-all active:scale-95',
        active
          ? 'shadow-sticker-sm bg-indigo-500 text-white'
          : 'bg-white text-slate-600 hover:bg-white',
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
  highlightColorId,
  onHighlightColorChange,
  strokeWidth,
  onStrokeWidthChange,
  highlightWidth,
  onHighlightWidthChange,
  shapeFillEnabled,
  onShapeFillChange,
  triangleVariant,
  onTriangleVariantChange,
  eraserWidth,
  onEraserWidthChange,
  canUndo,
  onUndo,
  hasSelection = false,
  onClear,
  onClose,
  closeLabel = '完成',
  variant = 'overlay',
  onEmbedBelow,
}: ScratchPadToolbarProps) {
  const showShapeFillToggle = tool === 'rect' || tool === 'circle' || tool === 'triangle'

  return (
    <div
      className="border-kid-line relative z-30 shrink-0 border-t bg-white"
      style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
    >
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

      <div className="border-kid-line flex items-center gap-2 border-t px-3 py-2">
        {tool === 'eraser' ? (
          <>
            <span className="shrink-0 text-[11px] font-semibold text-slate-500">橡皮大小</span>
            <div className="flex items-center gap-1.5">
              {SCRATCH_ERASER_WIDTHS.map((w) => (
                // native-ok: 橡皮粗细圆点选择器，按钮内容是按像素绘制的预览圆点
                <button
                  key={w}
                  type="button"
                  title={`${w}px`}
                  onClick={() => onEraserWidthChange(w)}
                  className={clsx(
                    'flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-all active:scale-95',
                    eraserWidth === w
                      ? 'bg-slate-200 ring-2 ring-slate-500'
                      : 'bg-slate-50 hover:bg-slate-100',
                  )}
                >
                  <span
                    className="rounded-full border border-slate-400/60 bg-white"
                    style={{ width: Math.min(w, 28), height: Math.min(w, 28) }}
                  />
                </button>
              ))}
            </div>
            <span className="hidden text-[11px] text-slate-400 sm:inline">按住拖动擦除</span>
          </>
        ) : tool === 'pan' ? (
          <span className="text-[11px] font-semibold text-slate-500">
            在画布上拖动可平移，查看更大作画区域
          </span>
        ) : tool === 'highlighter' ? (
          <>
            <div className="flex items-center gap-1.5">
              {SCRATCH_HIGHLIGHT_COLORS.map((c) => (
                // native-ok: 荧光笔色板，背景色由 swatch 十六进制值内联提供
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  onClick={() => onHighlightColorChange(c.id)}
                  className={clsx(
                    'h-6 w-6 shrink-0 cursor-pointer rounded-full border-2 transition-transform active:scale-90',
                    highlightColorId === c.id
                      ? 'shadow-sticker scale-110 border-slate-800'
                      : 'shadow-sticker-sm border-white',
                    hasSelection && 'ring-1 ring-amber-200',
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>

            <div className="mx-1 h-5 w-px shrink-0 bg-slate-200" />

            <div className="flex items-center gap-1">
              {SCRATCH_HIGHLIGHT_WIDTHS.map((w) => (
                // native-ok: 荧光笔粗细圆点选择器，按钮内容是按像素绘制的预览圆点
                <button
                  key={w}
                  type="button"
                  title={`${w}px`}
                  onClick={() => onHighlightWidthChange(w)}
                  className={clsx(
                    'flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-all active:scale-95',
                    highlightWidth === w
                      ? 'bg-amber-100 ring-2 ring-amber-400'
                      : 'bg-slate-50 hover:bg-slate-100',
                  )}
                >
                  <span
                    className="rounded-full bg-amber-300/80"
                    style={{ width: Math.min(w / 2 + 4, 22), height: Math.min(w / 2 + 4, 22) }}
                  />
                </button>
              ))}
            </div>

            <span className="hidden text-[11px] text-slate-400 sm:inline">
              半透明圈画，不遮挡题面
            </span>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              {SCRATCH_COLORS.map((c) => (
                // native-ok: 画笔色板，背景色由 swatch 十六进制值内联提供
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  onClick={() => onColorChange(c.id)}
                  className={clsx(
                    'h-6 w-6 shrink-0 cursor-pointer rounded-full border-2 transition-transform active:scale-90',
                    colorId === c.id
                      ? 'shadow-sticker scale-110 border-slate-800'
                      : 'shadow-sticker-sm border-white',
                    hasSelection && 'ring-1 ring-indigo-200',
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>

            <div className="mx-1 h-5 w-px shrink-0 bg-slate-200" />

            <div className="flex items-center gap-1">
              {SCRATCH_STROKE_WIDTHS.map((w) => (
                // native-ok: 画笔粗细圆点选择器，按钮内容是按像素绘制的预览圆点
                <button
                  key={w}
                  type="button"
                  title={`${w}px`}
                  onClick={() => onStrokeWidthChange(w)}
                  className={clsx(
                    'flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-all active:scale-95',
                    strokeWidth === w
                      ? 'bg-indigo-100 ring-2 ring-indigo-400'
                      : 'bg-slate-50 hover:bg-slate-100',
                  )}
                >
                  <span
                    className="rounded-full bg-slate-700"
                    style={{ width: w + 4, height: w + 4 }}
                  />
                </button>
              ))}
            </div>

            {showShapeFillToggle && (
              <>
                <div className="mx-1 h-5 w-px shrink-0 bg-slate-200" />
                <Button
                  type="button"
                  size="1"
                  className="shrink-0"
                  variant={shapeFillEnabled ? 'solid' : 'soft'}
                  color={shapeFillEnabled ? 'indigo' : 'gray'}
                  title="为矩形/圆/三角添加半透明填充"
                  aria-pressed={shapeFillEnabled}
                  onClick={() => onShapeFillChange(!shapeFillEnabled)}
                >
                  填充
                </Button>
              </>
            )}

            {tool === 'triangle' && (
              <>
                <div className="mx-1 h-5 w-px shrink-0 bg-slate-200" />
                <SegmentedControl.Root
                  size="1"
                  className="shrink-0"
                  value={triangleVariant}
                  onValueChange={(next) => onTriangleVariantChange(next as ScratchTriangleVariant)}
                >
                  {SCRATCH_TRIANGLE_VARIANTS.map((v) => (
                    <SegmentedControl.Item key={v.id} value={v.id} title={`${v.label}三角形`}>
                      {v.label}
                    </SegmentedControl.Item>
                  ))}
                </SegmentedControl.Root>
              </>
            )}
          </>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            variant="soft"
            color="gray"
            size="1"
          >
            撤销
          </Button>
          <Button type="button" onClick={onClear} variant="soft" color="gray" size="1">
            清空
          </Button>
          {onEmbedBelow && (
            <Button type="button" onClick={onEmbedBelow} variant="soft" color="indigo" size="1">
              附在题目下
            </Button>
          )}
          {variant === 'overlay' && onClose && (
            <Button type="button" onClick={onClose} variant="solid" color="indigo" size="1">
              {closeLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
