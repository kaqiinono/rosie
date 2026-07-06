'use client'

import { useCallback, useState } from 'react'
import clsx from 'clsx'
import type { Problem } from '@rosie/core'
import { useAuth } from '@rosie/core'
import { lessonIdFromProblemId } from '@rosie/math/constants'
import MathProblemNotesPanel from '@rosie/math/admin/MathProblemNotesPanel'
import { useMathProblemNotesAdmin } from '@rosie/math/hooks/useMathProblemNotesAdmin'
import { useProblemNotes } from '@rosie/math/hooks/useProblemNotes'

type Props = {
  problemId: string
  /** Pass on problem detail pages to enable in-place note editing for logged-in users. */
  problem?: Problem
  className?: string
}

function ReadOnlyNotes({
  notes,
  open,
  onToggle,
  className,
}: {
  notes: ReturnType<typeof useProblemNotes>['notes']
  open: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <section className={clsx('ql-notes', className)}>
      <button
        type="button"
        onClick={onToggle}
        className="ql-notes-toggle"
        aria-expanded={open}
      >
        <span>📝 笔记</span>
        <span className="ql-notes-count">{notes.length}</span>
        <span className="ql-notes-chevron" aria-hidden="true">
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div className="ql-notes-body">
          {notes.map((note, i) => (
            <article key={note.id} className="ql-note-item">
              {note.title && <div className="ql-note-title">{note.title}</div>}
              <div
                className="ql-note-content"
                dangerouslySetInnerHTML={{ __html: note.bodyHtml }}
              />
              {i < notes.length - 1 && <hr className="ql-note-divider" />}
            </article>
          ))}
        </div>
      )}
      <NotesPanelStyles />
    </section>
  )
}

function NotesPanelStyles() {
  return (
    <style>{`
        .ql-notes {
          border-top: 1.5px solid #e8e4ff;
          background: #faf9ff;
        }
        .ql-notes-toggle {
          display: flex;
          width: 100%;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          font-size: 13px;
          font-weight: 700;
          color: #5b4ccc;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
        }
        .ql-notes-toggle:hover { background: #f3f0ff; }
        .ql-notes-count {
          font-size: 10px;
          font-weight: 800;
          background: #ebe5ff;
          color: #6c4fff;
          border-radius: 999px;
          padding: 2px 8px;
        }
        .ql-notes-chevron {
          margin-left: auto;
          font-size: 10px;
          opacity: 0.7;
        }
        .ql-notes-body {
          padding: 0 28px 20px;
        }
        .ql-notes-body--edit {
          padding: 0 20px 20px;
        }
        .ql-note-item { padding: 10px 0; }
        .ql-note-title {
          font-size: 12px;
          font-weight: 800;
          color: #4338ca;
          margin-bottom: 6px;
        }
        .ql-note-content {
          font-size: 13px;
          line-height: 1.75;
          color: #3a3222;
        }
        .ql-note-content strong { font-weight: 700; }
        .ql-note-content ul { list-style: disc; padding-left: 1.25rem; margin: 0.25rem 0; }
        .ql-note-content ol { list-style: decimal; padding-left: 1.25rem; margin: 0.25rem 0; }
        .ql-note-content p { margin: 0 0 0.35rem; }
        .ql-note-content p:last-child { margin-bottom: 0; }
        .ql-note-divider {
          border: none;
          border-top: 1px dashed #ddd6fe;
          margin: 12px 0 0;
        }
        .ql-notes-flash {
          margin: 0 20px 8px;
          border-radius: 999px;
          background: #5b4ccc;
          padding: 6px 12px;
          text-align: center;
          font-size: 11px;
          font-weight: 600;
          color: white;
        }
        @media (max-width: 480px) {
          .ql-notes-toggle { padding: 12px 18px; }
          .ql-notes-body, .ql-notes-body--edit { padding: 0 18px 16px; }
          .ql-notes-flash { margin: 0 18px 8px; }
        }
      `}</style>
  )
}

/** Notes below the answer area — read-only for viewers; editable when logged in on problem detail. */
export default function ProblemNotesPanel({ problemId, problem, className }: Props) {
  const { user } = useAuth()
  const lessonId = lessonIdFromProblemId(problemId)
  const { notes, isLoading } = useProblemNotes(problemId)
  const notesAdmin = useMathProblemNotesAdmin(user, user ? lessonId : null)
  const [open, setOpen] = useState(true)
  const [flash, setFlash] = useState<string | null>(null)

  const showFlash = useCallback((msg: string) => {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 2200)
  }, [])

  const canEdit = Boolean(user && problem)

  if (!canEdit && (isLoading || notes.length === 0)) return null

  if (canEdit && problem) {
    return (
      <section className={clsx('ql-notes', className)}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ql-notes-toggle"
          aria-expanded={open}
        >
          <span>📝 笔记</span>
          <span className="ql-notes-count">{notesAdmin.getNotes(problem.id).length || '＋'}</span>
          <span className="ql-notes-chevron" aria-hidden="true">
            {open ? '▲' : '▼'}
          </span>
        </button>
        {flash && <div className="ql-notes-flash">{flash}</div>}
        {open && (
          <div className="ql-notes-body--edit">
            <MathProblemNotesPanel
              problem={problem}
              admin={notesAdmin}
              onFlash={showFlash}
              showProblemContext={false}
            />
          </div>
        )}
        <NotesPanelStyles />
      </section>
    )
  }

  return (
    <ReadOnlyNotes
      notes={notes}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      className={className}
    />
  )
}
