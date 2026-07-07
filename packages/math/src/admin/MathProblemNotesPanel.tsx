'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@rosie/core'
import type { Problem } from '@rosie/core'
import { lessonIdFromProblemId } from '@rosie/math/constants'
import type { MathProblemNote } from '@rosie/math/hooks/useMathProblemNotes'
import { uploadProblemNoteContentImage } from '@rosie/math/hooks/useMathProblemImages'
import type { useMathProblemNotesAdmin } from '@rosie/math/hooks/useMathProblemNotesAdmin'
import RichTextEditor from '@rosie/math/components/shared/RichTextEditor'
import { RICH_CONTENT_CLEARFIX_TW } from '@rosie/math/components/shared/rich-text-image'
import {
  RICH_CONTENT_IMG_TW,
  isRichBodyEmpty,
  sanitizeRichHtml,
} from '@rosie/math/utils/sanitize-summary-html'

type AdminApi = ReturnType<typeof useMathProblemNotesAdmin>

type Props = {
  problem: Problem
  admin: AdminApi
  onFlash: (msg: string) => void
  /** Hide题干 preview when the surrounding page already shows the problem. */
  showProblemContext?: boolean
}

function ProblemContextCard({ problem }: { problem: Problem }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
          {problem.tagLabel}
        </span>
        <span className="text-[10px] text-slate-400">{problem.finalQ}</span>
      </div>
      <div
        className="text-[12px] leading-relaxed text-slate-700 [&_strong]:font-bold [&_strong]:text-slate-900"
        dangerouslySetInnerHTML={{ __html: problem.text }}
      />
    </div>
  )
}

function NoteEditor({
  bodyHtml,
  onBodyChange,
  onUploadImage,
  onSave,
  onCancel,
  isSaving,
  saveLabel,
}: {
  bodyHtml: string
  onBodyChange: (html: string) => void
  onUploadImage: (file: File) => Promise<string | null>
  onSave: () => void
  onCancel: () => void
  isSaving: boolean
  saveLabel: string
}) {
  return (
    <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
      <RichTextEditor
        value={bodyHtml}
        onChange={onBodyChange}
        onUploadImage={onUploadImage}
        placeholder="输入文字、点插图、或粘贴图片…"
        disabled={isSaving}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={onSave}
          className="flex-1 rounded-lg bg-violet-600 py-2 text-[12px] font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
        >
          {isSaving ? '保存中…' : saveLabel}
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={onCancel}
          className="rounded-lg border border-violet-200 px-3 py-2 text-[12px] font-semibold text-violet-700 transition hover:bg-violet-50"
        >
          取消
        </button>
      </div>
    </div>
  )
}

function NoteRow({
  note,
  onUploadImage,
  admin,
  onFlash,
  isFirst,
  isLast,
}: {
  note: MathProblemNote
  onUploadImage: (file: File) => Promise<string | null>
  admin: AdminApi
  onFlash: (msg: string) => void
  isFirst: boolean
  isLast: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [bodyHtml, setBodyHtml] = useState(note.bodyHtml)

  useEffect(() => {
    if (!editing) setBodyHtml(note.bodyHtml)
  }, [note, editing])

  const handleSave = async () => {
    const toSave = sanitizeRichHtml(bodyHtml)
    if (isRichBodyEmpty(toSave)) {
      onFlash('笔记不能为空（可输入文字或插入图片）')
      return
    }
    const { error } = await admin.saveNote(note, { bodyHtml: toSave })
    if (error) onFlash(`保存失败：${error}`)
    else {
      onFlash('笔记已保存')
      setEditing(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('确定删除这条笔记？')) return
    const { error } = await admin.removeNote(note)
    if (error) onFlash(`删除失败：${error}`)
    else onFlash('已删除笔记')
  }

  if (editing) {
    return (
      <NoteEditor
        bodyHtml={bodyHtml}
        onBodyChange={setBodyHtml}
        onUploadImage={onUploadImage}
        onSave={() => void handleSave()}
        onCancel={() => setEditing(false)}
        isSaving={admin.isSaving}
        saveLabel="保存"
      />
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div
        className={`note-preview text-[12px] leading-relaxed text-slate-700 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:font-bold ${RICH_CONTENT_IMG_TW} ${RICH_CONTENT_CLEARFIX_TW}`}
        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(note.bodyHtml) }}
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg border border-violet-200 px-2 py-1 text-[10px] font-semibold text-violet-700 hover:bg-violet-50"
        >
          编辑
        </button>
        <button
          type="button"
          onClick={() => void handleDelete()}
          className="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50"
        >
          删除
        </button>
        {!isFirst && (
          <button
            type="button"
            onClick={() => void admin.moveNote(note, 'up').then((r) => r.error && onFlash(r.error))}
            className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            ↑
          </button>
        )}
        {!isLast && (
          <button
            type="button"
            onClick={() => void admin.moveNote(note, 'down').then((r) => r.error && onFlash(r.error))}
            className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            ↓
          </button>
        )}
      </div>
    </div>
  )
}

export default function MathProblemNotesPanel({
  problem,
  admin,
  onFlash,
  showProblemContext = true,
}: Props) {
  const { user } = useAuth()
  const lessonId = lessonIdFromProblemId(problem.id)
  const [adding, setAdding] = useState(false)
  const [bodyHtml, setBodyHtml] = useState('<p></p>')

  const notes = admin.getNotes(problem.id)

  const handleUploadImage = useCallback(
    async (file: File): Promise<string | null> => {
      if (!user) {
        onFlash('请先登录')
        return null
      }
      const { error, url } = await uploadProblemNoteContentImage(lessonId, problem.id, file)
      if (error || !url) {
        onFlash(error ? `图片上传失败：${error}` : '图片上传失败')
        return null
      }
      return url
    },
    [user, lessonId, problem.id, onFlash],
  )

  const resetAdd = useCallback(() => {
    setAdding(false)
    setBodyHtml('<p></p>')
  }, [])

  const handleAdd = async () => {
    const toSave = sanitizeRichHtml(bodyHtml)
    if (isRichBodyEmpty(toSave)) {
      onFlash('笔记不能为空（可输入文字或插入图片）')
      return
    }
    const { error } = await admin.addNote(problem.id, { bodyHtml: toSave })
    if (error) onFlash(`添加失败：${error}`)
    else {
      onFlash('笔记已添加')
      resetAdd()
    }
  }

  return (
    <div className="space-y-3">
      {showProblemContext && <ProblemContextCard problem={problem} />}

      <p className="text-[11px] leading-relaxed text-violet-700">
        为本题添加补充笔记（要点、易错提醒、插图等）。支持加粗、列表、插图与粘贴图片。
      </p>

      {notes.length === 0 && !adding && (
        <div className="rounded-xl border border-dashed border-violet-200 py-8 text-center text-[12px] text-violet-500">
          暂无笔记
        </div>
      )}

      <div className="space-y-2">
        {notes.map((note, i) => (
          <NoteRow
            key={note.id}
            note={note}
            onUploadImage={handleUploadImage}
            admin={admin}
            onFlash={onFlash}
            isFirst={i === 0}
            isLast={i === notes.length - 1}
          />
        ))}
      </div>

      {adding ? (
        <NoteEditor
          bodyHtml={bodyHtml}
          onBodyChange={setBodyHtml}
          onUploadImage={handleUploadImage}
          onSave={() => void handleAdd()}
          onCancel={resetAdd}
          isSaving={admin.isSaving}
          saveLabel="添加"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full rounded-xl border border-dashed border-violet-300 py-2.5 text-[12px] font-bold text-violet-700 transition hover:bg-violet-50"
        >
          + 添加笔记
        </button>
      )}
    </div>
  )
}
