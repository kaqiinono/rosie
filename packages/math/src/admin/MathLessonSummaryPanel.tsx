'use client'

import { useState } from 'react'
import { lessonSummaryProblemId } from '@rosie/math-kit/constants'
import type { useMathProblemNotesAdmin } from '@rosie/math-kit/hooks/useMathProblemNotesAdmin'
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

  const [draftHtml, setDraftHtml] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const bodyHtml = draftHtml ?? existing?.bodyHtml ?? '<p></p>'

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
          onBodyHtmlChange={setDraftHtml}
          onSaveSuccess={() => setDraftHtml(null)}
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
        onBodyHtmlChange={setDraftHtml}
        sharedDirty={draftHtml !== null}
        onClose={() => setModalOpen(false)}
        onSaveSuccess={() => {
          setDraftHtml(null)
          setModalOpen(false)
        }}
      />
    </>
  )
}
