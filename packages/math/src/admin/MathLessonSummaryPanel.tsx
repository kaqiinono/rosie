'use client'

import { useEffect, useState } from 'react'
import { lessonSummaryProblemId } from '@rosie/math/constants'
import type { useMathProblemNotesAdmin } from '@rosie/math/hooks/useMathProblemNotesAdmin'
import MathLessonSummaryEditor from '@rosie/math/admin/MathLessonSummaryEditor'
import MathLessonSummaryEditModal from '@rosie/math/admin/MathLessonSummaryEditModal'

type AdminApi = ReturnType<typeof useMathProblemNotesAdmin>

type Props = {
  lessonId: string
  lessonTitle?: string
  admin: AdminApi
  onFlash: (msg: string) => void
  /** Inside multi-lesson accordion — hide section title block. */
  embedded?: boolean
}

export default function MathLessonSummaryPanel({
  lessonId,
  lessonTitle,
  admin,
  onFlash,
  embedded = false,
}: Props) {
  const existing = admin.getNotes(lessonSummaryProblemId(lessonId))[0] ?? null

  const [bodyHtml, setBodyHtml] = useState(existing?.bodyHtml ?? '<p></p>')
  const [dirty, setDirty] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (!dirty) setBodyHtml(existing?.bodyHtml ?? '<p></p>')
  }, [existing, dirty])

  return (
    <>
      <div className="space-y-3">
        {!embedded && (
          <div>
            <div className="text-[12px] font-bold text-violet-900">
              {lessonTitle ?? `第 ${lessonId} 讲`} · 内容总结
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-violet-700">
              图文录入本讲要点。支持加粗、列表、插图按钮，也可直接粘贴（⌘V / Ctrl+V）图片。
            </p>
          </div>
        )}

        <MathLessonSummaryEditor
          lessonId={lessonId}
          admin={admin}
          onFlash={onFlash}
          bodyHtml={bodyHtml}
          onBodyHtmlChange={setBodyHtml}
          onDirtyChange={setDirty}
          onOpenModal={() => setModalOpen(true)}
        />
      </div>

      <MathLessonSummaryEditModal
        open={modalOpen}
        lessonId={lessonId}
        lessonTitle={lessonTitle ?? `第 ${lessonId} 讲`}
        admin={admin}
        onFlash={onFlash}
        bodyHtml={bodyHtml}
        onBodyHtmlChange={setBodyHtml}
        sharedDirty={dirty}
        onClose={() => setModalOpen(false)}
        onSaveSuccess={() => {
          setDirty(false)
          setModalOpen(false)
        }}
      />
    </>
  )
}
