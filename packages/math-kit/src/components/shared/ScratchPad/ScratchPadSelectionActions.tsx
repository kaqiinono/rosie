'use client'

import clsx from 'clsx'
import { SCRATCH_COLORS, type ScratchColorId } from './scratch-pad-types'
import type { ScratchBounds } from './scratch-pad-types'
import { Button } from '@rosie/ui/themes'

type ScratchPadSelectionActionsProps = {
  bounds: ScratchBounds
  count: number
  containerWidth: number
  containerHeight: number
  activeColorId: ScratchColorId
  onRecolor: (hex: string, colorId: ScratchColorId) => void
  onDuplicate: () => void
  onDelete: () => void
  onClearSelection: () => void
}

const BAR_H = 38
const GAP = 22
const TOP_SAFE = 52
const MARGIN = 8
const APPROX_W = 340

function clampBarPosition(bounds: ScratchBounds, containerWidth: number, containerHeight: number) {
  const cx = (bounds.minX + bounds.maxX) / 2
  const halfW = APPROX_W / 2

  // 默认：选区正上方居中
  let top = bounds.minY - GAP
  let transform = 'translate(-50%, -100%)'

  // 上方空间不足（靠近题目浮层）→ 改到选区正下方居中
  if (top - BAR_H < TOP_SAFE) {
    top = bounds.maxY + GAP
    transform = 'translate(-50%, 0)'
  }

  let left = cx
  if (left - halfW < MARGIN) {
    left = MARGIN + halfW
  }
  if (left + halfW > containerWidth - MARGIN) {
    left = containerWidth - MARGIN - halfW
  }

  if (top < TOP_SAFE) {
    top = TOP_SAFE
  }
  if (top + BAR_H > containerHeight - MARGIN) {
    top = containerHeight - BAR_H - MARGIN
  }

  return { left, top, transform }
}

export default function ScratchPadSelectionActions({
  bounds,
  count,
  containerWidth,
  containerHeight,
  activeColorId,
  onRecolor,
  onDuplicate,
  onDelete,
  onClearSelection,
}: ScratchPadSelectionActionsProps) {
  const { left, top, transform } = clampBarPosition(bounds, containerWidth, containerHeight)

  return (
    <div
      className="pointer-events-none absolute z-30"
      style={{ left: 0, top: 0, width: containerWidth, height: containerHeight }}
    >
      <div
        className="shadow-sticker-sm pointer-events-auto absolute flex max-w-[min(94vw,360px)] items-center gap-1.5 overflow-visible rounded-xl border border-indigo-200/80 bg-white px-2 py-1.5"
        style={{ left, top, transform }}
      >
        <span className="shrink-0 text-[10px] font-semibold whitespace-nowrap text-indigo-600">
          {count}项
        </span>

        <div className="flex shrink-0 items-center gap-1 px-0.5 py-0.5">
          {SCRATCH_COLORS.map((c) => {
            const active = activeColorId === c.id
            return (
              // native-ok: 选区改色色板，背景色由 swatch 十六进制值内联提供
              <button
                key={c.id}
                type="button"
                title={`改为${c.label}色`}
                onClick={() => onRecolor(c.hex, c.id)}
                className={clsx(
                  'h-5 w-5 shrink-0 cursor-pointer rounded-full border-2 transition-all active:scale-95',
                  active
                    ? 'scale-110 border-slate-800 shadow-[0_0_0_2px_#fff,0_0_0_4px_#6366f1]'
                    : 'shadow-sticker-sm border-white/90 hover:scale-105',
                )}
                style={{ backgroundColor: c.hex }}
              />
            )
          })}
        </div>

        <div className="mx-0.5 h-5 w-px shrink-0 bg-slate-200" />

        <Button
          type="button"
          onClick={onDuplicate}
          variant="soft"
          color="indigo"
          size="1"
          className="shrink-0"
        >
          复制
        </Button>
        <Button
          type="button"
          onClick={onDelete}
          variant="solid"
          color="ruby"
          size="1"
          className="shrink-0"
        >
          删除
        </Button>
        <Button
          type="button"
          onClick={onClearSelection}
          variant="ghost"
          color="gray"
          size="1"
          className="shrink-0"
        >
          取消
        </Button>
      </div>
    </div>
  )
}
