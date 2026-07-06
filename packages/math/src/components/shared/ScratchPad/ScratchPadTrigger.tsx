'use client'

import { useState } from 'react'
import type { Problem } from '@rosie/core'
import type { ScratchObject } from './scratch-pad-types'
import ScratchPadOverlay from './ScratchPadOverlay'

type ScratchPadTriggerProps = {
  problem: Problem
  /** compact = icon-only circle; default = pill with label */
  variant?: 'default' | 'compact'
  className?: string
  initialObjects?: ScratchObject[]
  onSave?: (objects: ScratchObject[]) => void
  onEmbedBelow?: (objects: ScratchObject[]) => void
  readOnly?: boolean
}

export default function ScratchPadTrigger({
  problem,
  variant = 'default',
  className = '',
  initialObjects,
  onSave,
  onEmbedBelow,
  readOnly = false,
}: ScratchPadTriggerProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={readOnly ? '查看草稿' : '草稿纸'}
        className={
          variant === 'compact'
            ? `flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-base transition-all hover:bg-indigo-100 active:scale-95 ${className}`
            : `flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 px-3 py-1.5 text-[12px] font-semibold text-indigo-700 shadow-sm transition-all hover:from-indigo-100 hover:to-violet-100 active:scale-95 ${className}`
        }
      >
        <span className="text-sm leading-none">📝</span>
        {variant !== 'compact' && <span>{readOnly ? '查看草稿' : '草稿纸'}</span>}
      </button>
      {open && (
        <ScratchPadOverlay
          problem={problem}
          initialObjects={initialObjects}
          onClose={() => setOpen(false)}
          onSave={readOnly ? undefined : onSave}
          onEmbedBelow={readOnly ? undefined : onEmbedBelow}
          readOnly={readOnly}
        />
      )}
    </>
  )
}
