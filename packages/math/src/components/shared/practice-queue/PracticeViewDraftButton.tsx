'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@rosie/core'
import type { Problem } from '@rosie/core'
import ScratchPadContentPreview from '@rosie/math/components/shared/ScratchPad/ScratchPadContentPreview'
import type { ScratchObject } from '@rosie/math/components/shared/ScratchPad/scratch-pad-types'
import {
  fetchViewableDraftObjects,
  problemHasViewableDraft,
} from '@rosie/math/utils/math-scratch-db'

type Props = {
  problem: Problem
  className?: string
  /** Bump after submit so draft button visibility refreshes */
  refreshKey?: number
}

export default function PracticeViewDraftButton({
  problem,
  className = '',
  refreshKey = 0,
}: Props) {
  const { user } = useAuth()
  const [hasDraft, setHasDraft] = useState(false)
  const [checking, setChecking] = useState(true)
  const [open, setOpen] = useState(false)
  const [previewObjects, setPreviewObjects] = useState<ScratchObject[] | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const refreshHasDraft = useCallback(async () => {
    if (!user) {
      setHasDraft(false)
      setChecking(false)
      return
    }
    setChecking(true)
    const ok = await problemHasViewableDraft(user.id, problem.id)
    setHasDraft(ok)
    setChecking(false)
  }, [user, problem.id, refreshKey])

  useEffect(() => {
    void refreshHasDraft()
  }, [refreshHasDraft])

  const handleClose = useCallback(() => {
    setOpen(false)
    setPreviewObjects(null)
    void refreshHasDraft()
  }, [refreshHasDraft])

  useEffect(() => {
    if (!open || !user) return
    let cancelled = false
    void fetchViewableDraftObjects(user.id, problem.id).then((objects) => {
      if (!cancelled) setPreviewObjects(objects)
    })
    return () => {
      cancelled = true
    }
  }, [open, user, problem.id])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        e.preventDefault()
        handleClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, handleClose])

  async function handleOpen() {
    if (!user || !hasDraft) return
    setPreviewObjects(null)
    setOpen(true)
  }

  if (!user || checking || !hasDraft) return null

  const modal =
    open && mounted ? (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="练习草稿"
        onClick={handleClose}
      >
        <div
          className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-slate-800">练习草稿</span>
            <button
              type="button"
              onClick={handleClose}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-600 transition-colors hover:bg-slate-200"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
          {previewObjects === null ? (
            <p className="py-10 text-center text-xs text-slate-400">加载中…</p>
          ) : previewObjects.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-400">暂无草稿</p>
          ) : (
            <ScratchPadContentPreview objects={previewObjects} />
          )}
          <button
            type="button"
            onClick={handleClose}
            className="mt-4 w-full cursor-pointer rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
          >
            关闭
          </button>
        </div>
      </div>
    ) : null

  return (
    <>
      <button
        type="button"
        onClick={() => void handleOpen()}
        title="查看草稿"
        className={`cursor-pointer rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 transition-all hover:bg-indigo-100 active:scale-95 ${className}`}
      >
        📝 草稿
      </button>
      {modal && createPortal(modal, document.body)}
    </>
  )
}
