'use client'

import { useCallback, useState } from 'react'
import type { Problem } from '@rosie/core'
import { IconButton } from '@rosie/ui/themes'
import PaperDraftUploadButton from '@rosie/math-kit/components/shared/PaperDraftUploadButton'
import { useProblemWorkspaceRuntime } from '@rosie/math-kit/components/shared/ProblemWorkspaceRuntime'
import { useLessonScratchActions } from '@rosie/math-kit/components/shared/ScratchPad/LessonScratchActionsContext'
import ScratchPadTrigger from '@rosie/math-kit/components/shared/ScratchPad/ScratchPadTrigger'
import ProblemActionIcon from './ProblemActionIcon'

type Props = {
  problem: Problem
  variant?: 'compact' | 'toolbar'
}

/** Shared actions for electronic and photographed paper drafts. */
export default function ProblemDraftActions({ problem, variant = 'compact' }: Props) {
  const scratchActions = useLessonScratchActions()
  const runtime = useProblemWorkspaceRuntime()
  const [flash, setFlash] = useState<string | null>(null)

  const showFlash = useCallback((message: string) => {
    setFlash(message)
    window.setTimeout(() => setFlash(null), 2200)
  }, [])

  return (
    <>
      {runtime?.onOpenScratch ? (
        <IconButton
          type="button"
          size="2"
          radius="full"
          variant={variant === 'toolbar' ? 'ghost' : 'soft'}
          color={variant === 'toolbar' ? 'gray' : 'indigo'}
          onClick={runtime.onOpenScratch}
          title="打草稿"
          aria-label="打草稿"
        >
          {variant === 'toolbar' ? (
            <ProblemActionIcon name="pencil" />
          ) : (
            <span className="text-sm leading-none">📝</span>
          )}
        </IconButton>
      ) : (
        <ScratchPadTrigger
          problem={problem}
          variant={variant}
          onSolve={scratchActions?.onSolve}
          onWrong={scratchActions?.onWrong}
          onResolved={scratchActions?.onResolved}
        />
      )}
      <PaperDraftUploadButton
        problem={problem}
        variant={variant}
        onFlash={showFlash}
        onArchived={runtime?.onPaperArchived}
      />
      {flash && (
        <div className="shadow-sticker pointer-events-none fixed top-16 left-1/2 z-[130] -translate-x-1/2 rounded-full bg-amber-800 px-4 py-2 text-[13px] font-semibold text-white">
          {flash}
        </div>
      )}
    </>
  )
}
