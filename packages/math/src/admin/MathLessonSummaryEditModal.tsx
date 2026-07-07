'use client'

import { useCallback, useEffect, useState } from 'react'
import type { useMathProblemNotesAdmin } from '@rosie/math/hooks/useMathProblemNotesAdmin'
import { lessonDisplayLabel } from '@rosie/math/utils/lesson-grade'
import MathLessonSummaryEditor from '@rosie/math/admin/MathLessonSummaryEditor'

type AdminApi = ReturnType<typeof useMathProblemNotesAdmin>

type Props = {
  open: boolean
  lessonId: string
  lessonTitle: string
  admin: AdminApi
  onFlash: (msg: string) => void
  onClose: () => void
  onSaveSuccess?: () => void
  bodyHtml: string
  onBodyHtmlChange: (html: string) => void
  /** Unsaved changes in inline editor (shared state). */
  sharedDirty?: boolean
}

export default function MathLessonSummaryEditModal({
  open,
  lessonId,
  lessonTitle,
  admin,
  onFlash,
  onClose,
  onSaveSuccess,
  bodyHtml,
  onBodyHtmlChange,
  sharedDirty = false,
}: Props) {
  const [modalDirty, setModalDirty] = useState(false)

  useEffect(() => {
    if (!open) setModalDirty(false)
  }, [open, lessonId])

  const requestClose = useCallback(() => {
    if ((modalDirty || sharedDirty) && !window.confirm('有未保存的修改，确定关闭？')) return
    onClose()
  }, [modalDirty, sharedDirty, onClose])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, requestClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={requestClose}
      role="presentation"
    >
      <div
        className="flex h-[96vh] w-full max-w-[min(96vw,1280px)] flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="summary-edit-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-violet-100 px-5 py-3">
          <div className="min-w-0">
            <h3 id="summary-edit-title" className="text-[14px] font-extrabold text-violet-900">
              {lessonDisplayLabel(lessonId, true)} · {lessonTitle}
            </h3>
            <p className="mt-0.5 text-[11px] text-violet-700">
              图文录入本讲要点。支持加粗、列表、插图与粘贴图片。
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="shrink-0 rounded-lg px-2 py-1 text-[18px] leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4">
          <MathLessonSummaryEditor
            key={`modal-${lessonId}`}
            lessonId={lessonId}
            admin={admin}
            onFlash={onFlash}
            onDirtyChange={setModalDirty}
            bodyHtml={bodyHtml}
            onBodyHtmlChange={onBodyHtmlChange}
            onSaveSuccess={onSaveSuccess ?? onClose}
            modal
          />
        </div>
      </div>
    </div>
  )
}
