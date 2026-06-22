'use client'

import { useState } from 'react'
import clsx from 'clsx'
import type {
  FlipbookDuplicateAction,
  FlipbookDuplicatePrompt,
} from '../utils/flipbook-duplicate'

type FlipbookDuplicateDialogProps = {
  prompt: FlipbookDuplicatePrompt
  showApplyToRest?: boolean
  onChoose: (action: FlipbookDuplicateAction, applyToRest: boolean) => void
}

export default function FlipbookDuplicateDialog({
  prompt,
  showApplyToRest = false,
  onChoose,
}: FlipbookDuplicateDialogProps) {
  const [applyToRest, setApplyToRest] = useState(false)

  const headline =
    prompt.kind === 'existing_book' ? '书架已有同名书籍' : '页图页码重复'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="flipbook-dup-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#1f120c] p-5 shadow-xl">
        <h2 id="flipbook-dup-title" className="text-base font-bold text-white">
          {headline}
        </h2>
        <p className="mt-2 text-sm text-white/70">{prompt.title}</p>
        <p className="mt-1 text-xs text-white/45">{prompt.detail}</p>

        {showApplyToRest && (
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-white/55">
            <input
              type="checkbox"
              checked={applyToRest}
              onChange={(e) => setApplyToRest(e.target.checked)}
              className="rounded border-white/20"
            />
            对后续重复项执行相同操作
          </label>
        )}

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <ActionButton
            variant="primary"
            onClick={() => onChoose('overwrite', applyToRest)}
          >
            覆盖
          </ActionButton>
          <ActionButton variant="muted" onClick={() => onChoose('skip', applyToRest)}>
            跳过
          </ActionButton>
          <ActionButton variant="danger" onClick={() => onChoose('abort', applyToRest)}>
            放弃上传
          </ActionButton>
        </div>
      </div>
    </div>
  )
}

function ActionButton({
  children,
  onClick,
  variant,
}: {
  children: React.ReactNode
  onClick: () => void
  variant: 'primary' | 'muted' | 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-xl py-2.5 text-sm font-semibold transition-colors',
        variant === 'primary' && 'bg-orange-500 text-white hover:bg-orange-400',
        variant === 'muted' && 'border border-white/15 bg-white/10 text-white hover:bg-white/15',
        variant === 'danger' && 'bg-red-600/90 text-white hover:bg-red-600',
      )}
    >
      {children}
    </button>
  )
}
