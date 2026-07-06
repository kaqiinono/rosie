'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Problem } from '@rosie/core'
import type { MathProblemNote } from '@rosie/math/hooks/useMathProblemNotes'
import type { useMathProblemNotesAdmin } from '@rosie/math/hooks/useMathProblemNotesAdmin'
import RichTextEditor from '@rosie/math/components/shared/RichTextEditor'
import { isNoteBodyEmpty } from '@rosie/math/utils/sanitize-note-html'

type AdminApi = ReturnType<typeof useMathProblemNotesAdmin>

type Props = {
  problem: Problem
  admin: AdminApi
  onFlash: (msg: string) => void
  /** Hide题干 preview when the surrounding page already shows the problem. */
  showProblemContext?: boolean
}

type Draft = {
  title: string
  bodyHtml: string
}

function emptyDraft(): Draft {
  return { title: '', bodyHtml: '<p></p>' }
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
  draft,
  onDraftChange,
  onSave,
  onCancel,
  isSaving,
  saveLabel,
}: {
  draft: Draft
  onDraftChange: (d: Draft) => void
  onSave: () => void
  onCancel: () => void
  isSaving: boolean
  saveLabel: string
}) {
  return (
    <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
      <input
        type="text"
        value={draft.title}
        onChange={(e) => onDraftChange({ ...draft, title: e.target.value })}
        placeholder="标题（可选）"
        className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-violet-400"
      />
      <RichTextEditor
        value={draft.bodyHtml}
        onChange={(bodyHtml) => onDraftChange({ ...draft, bodyHtml })}
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
  admin,
  onFlash,
  isFirst,
  isLast,
}: {
  note: MathProblemNote
  admin: AdminApi
  onFlash: (msg: string) => void
  isFirst: boolean
  isLast: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>({ title: note.title ?? '', bodyHtml: note.bodyHtml })

  useEffect(() => {
    if (!editing) {
      setDraft({ title: note.title ?? '', bodyHtml: note.bodyHtml })
    }
  }, [note, editing])

  const handleSave = async () => {
    if (isNoteBodyEmpty(draft.bodyHtml)) {
      onFlash('笔记正文不能为空')
      return
    }
    const { error } = await admin.saveNote(note, {
      title: draft.title,
      bodyHtml: draft.bodyHtml,
    })
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
        draft={draft}
        onDraftChange={setDraft}
        onSave={() => void handleSave()}
        onCancel={() => setEditing(false)}
        isSaving={admin.isSaving}
        saveLabel="保存"
      />
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      {note.title && <div className="mb-1 text-[12px] font-bold text-violet-900">{note.title}</div>}
      <div
        className="note-preview text-[12px] leading-relaxed text-slate-700 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:font-bold"
        dangerouslySetInnerHTML={{ __html: note.bodyHtml }}
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
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)

  const notes = admin.getNotes(problem.id)

  const resetAdd = useCallback(() => {
    setAdding(false)
    setDraft(emptyDraft())
  }, [])

  const handleAdd = async () => {
    if (isNoteBodyEmpty(draft.bodyHtml)) {
      onFlash('笔记正文不能为空')
      return
    }
    const { error } = await admin.addNote(problem.id, {
      title: draft.title,
      bodyHtml: draft.bodyHtml,
    })
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
        为本题添加补充笔记（要点、易错提醒等）。支持加粗与列表，孩子做题时可展开查看。
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
            admin={admin}
            onFlash={onFlash}
            isFirst={i === 0}
            isLast={i === notes.length - 1}
          />
        ))}
      </div>

      {adding ? (
        <NoteEditor
          draft={draft}
          onDraftChange={setDraft}
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
