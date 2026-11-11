'use client'

import { useCallback, useEffect, useState } from 'react'
import type { useMathProblemNotesAdmin } from '@rosie/math-kit/hooks/useMathProblemNotesAdmin'
import { lessonDisplayLabel } from '@rosie/math-kit/utils/lesson-grade'
import MathLessonSummaryEditor from '@rosie/math/admin/MathLessonSummaryEditor'
import { StickerCard } from '@rosie/ui'
import { IconButton } from '@rosie/ui/themes'

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

export default function MathLessonSummaryEditModal(props: Props) {
  return props.open ? <OpenSummaryModal key={props.lessonId} {...props} /> : null
}

function OpenSummaryModal({
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
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={requestClose}
      role="presentation"
    >
      <StickerCard
        size="none"
        elevation="lg"
        radius="md"
        className="flex h-[96vh] w-full max-w-[min(96vw,1280px)] flex-col overflow-hidden"
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
          <IconButton
            type="button"
            onClick={requestClose}
            aria-label="关闭"
            variant="ghost"
            color="gray"
            size="3"
            className="shrink-0"
          >
            ×
          </IconButton>
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
      </StickerCard>
    </div>
  )
}
