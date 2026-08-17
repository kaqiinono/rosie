'use client'

import { useCallback, useState } from 'react'
import clsx from 'clsx'
import type { Problem } from '@rosie/core'
import { useAuth } from '@rosie/core'
import {
  lessonIdFromProblemId,
  lessonSummaryProblemId,
} from '@rosie/math-kit/constants'
import MathProblemNotesPanel from '@rosie/math-kit/admin/MathProblemNotesPanel'
import LessonSummaryBody from '@rosie/math-kit/components/shared/LessonSummaryBody'
import { useMathProblemNotesAdmin } from '@rosie/math-kit/hooks/useMathProblemNotesAdmin'
import { useProblemNotes } from '@rosie/math-kit/hooks/useProblemNotes'
import { useLessonSummary } from '@rosie/math-kit/hooks/useLessonSummary'
import {
  isRichBodyEmpty,
  sanitizeRichHtml,
} from '@rosie/math-kit/utils/sanitize-summary-html'

type Props = {
  problemId: string
  /** Pass on problem detail pages to enable in-place note editing for logged-in users. */
  problem?: Problem
  className?: string
}

type NotesTab = 'problem' | 'lesson'

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
        .ql-notes-loading,
        .ql-notes-error {
          margin: 0 20px 14px;
          border-radius: 10px;
          padding: 9px 12px;
          font-size: 11px;
          font-weight: 600;
        }
        .ql-notes-loading {
          background: #f5f3ff;
          color: #6d5bd0;
        }
        .ql-notes-error {
          background: #fff1f2;
          color: #be123c;
        }
        .ql-lesson-summary { margin-bottom: 14px; }
        .ql-notes-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          margin-bottom: 12px;
          border-radius: 10px;
          background: #ede9fe;
          padding: 3px;
        }
        .ql-notes-tab {
          cursor: pointer;
          border: 0;
          border-radius: 8px;
          background: transparent;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 700;
          color: #6d5bd0;
          transition: background 150ms, color 150ms, box-shadow 150ms;
        }
        .ql-notes-tab--active {
          background: white;
          color: #4338ca;
          box-shadow: 0 1px 4px rgba(67, 56, 202, 0.12);
        }
        .ql-problem-notes-title {
          margin: 4px 0 8px;
          font-size: 12px;
          font-weight: 800;
          color: #5b4ccc;
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
        .ql-note-content img.rich-inline-img {
          display: block;
          width: auto;
          height: auto;
          max-width: 100%;
          max-height: none;
          margin: 0.375rem 0;
          border-radius: 0.375rem;
        }
        .ql-note-content img.rich-img-block { float: none; clear: both; }
        .ql-note-content img.rich-img-left {
          float: left;
          margin: 0 0.75rem 0.5rem 0;
          clear: none;
        }
        .ql-note-content img.rich-img-right {
          float: right;
          margin: 0 0 0.5rem 0.75rem;
          clear: none;
        }
        .ql-note-content img.rich-img-pct-40 { width: 40%; min-width: 300px; }
        .ql-note-content img.rich-img-pct-60 { width: 60%; min-width: 500px; }
        .ql-note-content img.rich-img-pct-80 { width: 80%; min-width: 600px; }
        .ql-note-content img.rich-img-pct-100 { width: 100%; min-width: 800px; }
        .ql-note-content img.rich-img-left.rich-img-pct-100,
        .ql-note-content img.rich-img-right.rich-img-pct-100 {
          width: 50%;
          min-width: 500px;
        }
        .ql-note-content::after {
          content: '';
          display: block;
          clear: both;
        }
        @media (max-width: 767px) {
          .ql-note-content img.rich-inline-img {
            float: none !important;
            clear: both !important;
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
        }
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
          .ql-notes-flash, .ql-notes-loading, .ql-notes-error { margin: 0 18px 8px; }
        }
      `}</style>
  )
}

/** Notes below the answer area — read-only for viewers; editable when logged in on problem detail. */
export default function ProblemNotesPanel({ problemId, problem, className }: Props) {
  const { user } = useAuth()
  const lessonId = lessonIdFromProblemId(problemId)
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<NotesTab>('problem')
  const [flash, setFlash] = useState<string | null>(null)
  const canEdit = Boolean(user && problem)
  const { notes, isLoading } = useProblemNotes(open && !canEdit ? problemId : undefined)
  const { summary: readOnlySummary, isLoading: summaryLoading } = useLessonSummary(
    open && !canEdit ? lessonId : undefined,
  )
  const notesAdmin = useMathProblemNotesAdmin(user, user ? lessonId : null, { enabled: open })
  const editableSummary = notesAdmin.getNotes(lessonSummaryProblemId(lessonId))[0] ?? null
  const summary = canEdit ? editableSummary : readOnlySummary
  const showSummary = summary != null && !isRichBodyEmpty(summary.bodyHtml)
  const panelLoading = canEdit ? notesAdmin.isLoading : isLoading || summaryLoading

  const showFlash = useCallback((msg: string) => {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 2200)
  }, [])

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
        {open && panelLoading && (
          <div className="ql-notes-loading">正在加载本讲笔记…</div>
        )}
        {open && notesAdmin.loadError && (
          <div className="ql-notes-error">笔记加载失败，收起后再次展开即可重试。</div>
        )}
        {open && !panelLoading && (
          <div className="ql-notes-body--edit">
            {showSummary && (
              <div className="ql-notes-tabs" role="tablist" aria-label="笔记类型">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'problem'}
                  onClick={() => setActiveTab('problem')}
                  className={`ql-notes-tab ${activeTab === 'problem' ? 'ql-notes-tab--active' : ''}`}
                >
                  📝 本题笔记
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'lesson'}
                  onClick={() => setActiveTab('lesson')}
                  className={`ql-notes-tab ${activeTab === 'lesson' ? 'ql-notes-tab--active' : ''}`}
                >
                  📋 本讲要点
                </button>
              </div>
            )}
            {activeTab === 'lesson' && showSummary && summary ? (
              <div className="ql-lesson-summary">
                <LessonSummaryBody
                  bodyHtml={summary.bodyHtml}
                  headerLabel="📋 本讲要点"
                />
              </div>
            ) : (
              <>
                {!showSummary && <div className="ql-problem-notes-title">📝 本题笔记</div>}
                <MathProblemNotesPanel
                  problem={problem}
                  admin={notesAdmin}
                  onFlash={showFlash}
                  showProblemContext={false}
                />
              </>
            )}
          </div>
        )}
        <NotesPanelStyles />
      </section>
    )
  }

  return (
    <section className={clsx('ql-notes', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ql-notes-toggle"
        aria-expanded={open}
      >
        <span>📝 笔记</span>
        <span className="ql-notes-count">{notes.length || '＋'}</span>
        <span className="ql-notes-chevron" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>
      {open && panelLoading && <div className="ql-notes-loading">正在加载本讲笔记…</div>}
      {open && !panelLoading && (
        <div className="ql-notes-body">
          {showSummary && (
            <div className="ql-notes-tabs" role="tablist" aria-label="笔记类型">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'problem'}
                onClick={() => setActiveTab('problem')}
                className={`ql-notes-tab ${activeTab === 'problem' ? 'ql-notes-tab--active' : ''}`}
              >
                📝 本题笔记
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'lesson'}
                onClick={() => setActiveTab('lesson')}
                className={`ql-notes-tab ${activeTab === 'lesson' ? 'ql-notes-tab--active' : ''}`}
              >
                📋 本讲要点
              </button>
            </div>
          )}
          {activeTab === 'lesson' && showSummary && summary ? (
            <div className="ql-lesson-summary">
              <LessonSummaryBody bodyHtml={summary.bodyHtml} headerLabel="📋 本讲要点" />
            </div>
          ) : (
            <>
              {!showSummary && notes.length > 0 && (
                <div className="ql-problem-notes-title">📝 本题笔记</div>
              )}
              {notes.map((note, i) => (
                <article key={note.id} className="ql-note-item">
                  <div
                    className="ql-note-content"
                    dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(note.bodyHtml) }}
                  />
                  {i < notes.length - 1 && <hr className="ql-note-divider" />}
                </article>
              ))}
            </>
          )}
        </div>
      )}
      <NotesPanelStyles />
    </section>
  )
}
