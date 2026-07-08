'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { OrbBackground } from '@rosie/ui'
import { RICH_CONTENT_CLEARFIX_TW } from '@rosie/math/components/shared/rich-text-image'
import LessonSummaryBody from '@rosie/math/components/shared/LessonSummaryBody'
import { lessonSummaryProblemId } from '@rosie/math/constants'
import {
  loadLessonNotes,
  notesForProblem,
  type MathProblemNote,
} from '@rosie/math/hooks/useMathProblemNotes'
import {
  buildLessonNoteEntries,
  type LessonNoteEntry,
} from '@rosie/math/utils/lesson-note-entries'
import {
  GRADE_LABEL,
  gradeOf,
  gradesInOrder,
  highestGrade,
  lessonsForGrade,
} from '@rosie/math/utils/lesson-grade'
import {
  compareLessonIds,
  lessonByKey,
  routeForLesson,
} from '@rosie/math/utils/lesson-registry'
import { SEA_LESSON_MAP, type SeaLessonMeta } from '@rosie/math/utils/sea-data'
import {
  isRichBodyEmpty,
  RICH_CONTENT_IMG_TW_COMPACT,
  sanitizeRichHtml,
} from '@rosie/math/utils/sanitize-summary-html'

type LessonNotesGroup = {
  lessonId: string
  meta: SeaLessonMeta
  basePath: string
  notesHref: string
  summary: MathProblemNote | null
  entries: LessonNoteEntry[]
}

function seaLessonsForGrade(grade: number): SeaLessonMeta[] {
  return Object.values(SEA_LESSON_MAP)
    .filter((l) => gradeOf(l.id) === grade)
    .sort((a, b) => compareLessonIds(a.id, b.id))
}

function NotesFilterPanel({
  expanded,
  onToggleExpanded,
  selectedGrade,
  onGradeChange,
  selectedLessons,
  noteCountByLesson,
  onChangeLessons,
}: {
  expanded: boolean
  onToggleExpanded: () => void
  selectedGrade: number
  onGradeChange: (grade: number) => void
  selectedLessons: Set<string>
  noteCountByLesson: Map<string, number>
  onChangeLessons: (next: Set<string>) => void
}) {
  const gradeLessons = useMemo(() => seaLessonsForGrade(selectedGrade), [selectedGrade])
  const gradeLessonIds = useMemo(() => gradeLessons.map((l) => l.id), [gradeLessons])
  const selectedCount = selectedLessons.size
  const totalCount = gradeLessonIds.length
  const allSelected = totalCount > 0 && selectedCount === totalCount
  const totalNotes = gradeLessonIds.reduce((n, id) => n + (noteCountByLesson.get(id) ?? 0), 0)

  const chipBase =
    'relative cursor-pointer rounded-full border-[1.5px] px-2.5 py-1.5 text-[11px] font-semibold transition-all active:scale-95 sm:px-3 sm:py-1.5 sm:text-xs'
  const chipOn = 'border-violet-400 bg-violet-500 text-white shadow-[0_1px_4px_rgba(139,92,246,0.25)]'
  const chipOff = 'border-slate-200 bg-slate-50 text-slate-600 hover:border-violet-200 hover:bg-violet-50'

  const toggleLesson = useCallback(
    (lessonId: string) => {
      const next = new Set(selectedLessons)
      if (next.has(lessonId)) next.delete(lessonId)
      else next.add(lessonId)
      onChangeLessons(next)
    },
    [onChangeLessons, selectedLessons],
  )

  return (
    <div className="mb-2.5 w-full overflow-hidden rounded-2xl border border-violet-200/80 bg-white/95 shadow-[0_2px_14px_rgba(109,40,217,0.06)] backdrop-blur-sm">
      <button
        type="button"
        onClick={onToggleExpanded}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-violet-50/40 sm:px-4 sm:py-3"
        aria-expanded={expanded}
      >
        <span className="text-[11px] font-extrabold tracking-wide text-violet-900 sm:text-xs">筛选</span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">
            {GRADE_LABEL[selectedGrade] ?? `${selectedGrade} 年级`}
          </span>
          <span className="rounded-full border border-violet-100 bg-violet-50/80 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
            {allSelected ? '全部讲次' : `${selectedCount}/${totalCount} 讲`}
          </span>
          {totalNotes > 0 && (
            <span className="rounded-full border border-violet-200/80 bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">
              {totalNotes} 条
            </span>
          )}
        </div>
        <span
          className="shrink-0 text-[11px] text-violet-400 transition-transform duration-200"
          style={{ transform: expanded ? 'rotate(180deg)' : undefined }}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-violet-100/80 px-3 pb-3.5 pt-3 sm:px-4 sm:pb-4">
          <div>
            <div className="mb-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              年级
            </div>
            <div className="flex flex-wrap gap-1.5">
              {gradesInOrder().map((grade) => {
                const active = selectedGrade === grade
                const count = seaLessonsForGrade(grade).reduce(
                  (n, l) => n + (noteCountByLesson.get(l.id) ?? 0),
                  0,
                )
                return (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => onGradeChange(grade)}
                    className={`${chipBase} ${active ? chipOn : chipOff}`}
                  >
                    {GRADE_LABEL[grade] ?? `${grade} 年级`}
                    {count > 0 && (
                      <span className={`ml-1 text-[10px] ${active ? 'opacity-80' : 'text-violet-400'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="border-t border-violet-50 pt-1">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                讲次
              </span>
              <button
                type="button"
                onClick={() =>
                  onChangeLessons(allSelected ? new Set() : new Set(gradeLessonIds))
                }
                className="text-[11px] font-semibold text-violet-500 hover:text-violet-700"
              >
                {allSelected ? '全不选' : '全选'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {gradeLessons.map((lesson) => {
                const isSelected = selectedLessons.has(lesson.id)
                const noteN = noteCountByLesson.get(lesson.id) ?? 0
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => toggleLesson(lesson.id)}
                    className={`${chipBase} ${isSelected ? chipOn : chipOff}`}
                    title={lesson.title}
                  >
                    <span className="inline-flex items-center gap-1">
                      <span>{lesson.icon}</span>
                      <span>{lesson.shortTitle}</span>
                    </span>
                    {noteN > 0 && (
                      <span
                        className={`absolute -top-1.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-bold ${
                          isSelected ? 'bg-white text-violet-600' : 'bg-violet-500 text-white'
                        }`}
                      >
                        {noteN}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NoteEntryCard({ entry }: { entry: LessonNoteEntry }) {
  const body = (
    <>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        {entry.sourceLabel && (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
            {entry.sourceLabel}
          </span>
        )}
        <span className="truncate text-[13px] font-bold text-text-primary">{entry.problemTitle}</span>
      </div>
      <div
        className={clsx(
          'lesson-note-preview text-[12px] leading-relaxed text-text-secondary',
          '[&_strong]:font-bold [&_strong]:text-text-primary',
          '[&_ul]:my-0.5 [&_ul]:list-disc [&_ul]:pl-4',
          '[&_ol]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-4',
          '[&_p]:my-0.5 [&_p:last-child]:mb-0',
          RICH_CONTENT_IMG_TW_COMPACT,
          RICH_CONTENT_CLEARFIX_TW,
        )}
        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(entry.note.bodyHtml) }}
      />
    </>
  )

  const cardClass =
    'block rounded-[12px] border border-violet-100 bg-[#faf9ff] p-3.5 no-underline transition hover:border-violet-200 hover:bg-violet-50/60 hover:shadow-[0_4px_16px_rgba(91,76,204,0.08)]'

  if (entry.href) {
    return (
      <Link href={entry.href} className={cardClass}>
        {body}
        <div className="mt-2 text-[10px] font-semibold text-violet-600">查看题目 →</div>
      </Link>
    )
  }

  return <div className={cardClass}>{body}</div>
}

function LessonNotesSection({ group }: { group: LessonNotesGroup }) {
  const { meta, summary, entries, notesHref } = group
  const showSummary = summary != null && !isRichBodyEmpty(summary.bodyHtml)
  const noteCount = entries.length + (showSummary ? 1 : 0)

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-100/80 bg-white shadow-[0_2px_14px_rgba(109,40,217,0.06)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-violet-50 bg-gradient-to-r from-violet-50/80 to-indigo-50/50 px-4 py-3">
        <span className="text-lg" aria-hidden>
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[14px] font-extrabold text-violet-950 sm:text-[15px]">{meta.title}</h2>
        </div>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
          {noteCount} 条
        </span>
        <Link
          href={notesHref}
          className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-violet-700 no-underline hover:bg-violet-50"
        >
          本讲笔记 →
        </Link>
      </div>

      <div className="space-y-3 p-4">
        {showSummary && <LessonSummaryBody bodyHtml={summary.bodyHtml} />}
        {entries.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {entries.map((entry) => (
              <NoteEntryCard key={entry.note.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function compareNotesByCreatedAtDesc(a: MathProblemNote, b: MathProblemNote): number {
  return b.createdAt.localeCompare(a.createdAt)
}

function latestNoteCreatedAt(group: LessonNotesGroup): string {
  const times = group.entries.map((entry) => entry.note.createdAt)
  if (group.summary && !isRichBodyEmpty(group.summary.bodyHtml)) {
    times.push(group.summary.createdAt)
  }
  return times.sort().at(-1) ?? ''
}

function countDisplayNotes(notes: MathProblemNote[]): number {
  let count = 0
  for (const note of notes) {
    if (isRichBodyEmpty(note.bodyHtml)) continue
    count += 1
  }
  return count
}

export default function MathNotesPage() {
  const defaultGrade = highestGrade()
  const [selectedGrade, setSelectedGrade] = useState(defaultGrade)
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(
    () => new Set(lessonsForGrade(defaultGrade)),
  )
  const [filterExpanded, setFilterExpanded] = useState(false)
  const [notesByLesson, setNotesByLesson] = useState<Map<string, MathProblemNote[]>>(() => new Map())
  const [loadedKey, setLoadedKey] = useState('')

  const handleGradeChange = useCallback((grade: number) => {
    setSelectedGrade(grade)
    setSelectedLessons(new Set(lessonsForGrade(grade)))
  }, [])

  const selectedLessonIds = useMemo(
    () => [...selectedLessons].sort(compareLessonIds),
    [selectedLessons],
  )
  const selectedLessonIdsKey = selectedLessonIds.join(',')
  const isLoading = selectedLessonIds.length > 0 && loadedKey !== selectedLessonIdsKey

  useEffect(() => {
    if (!selectedLessonIdsKey) return

    let cancelled = false
    const key = selectedLessonIdsKey
    const ids = key.split(',')

    void Promise.all(
      ids.map(async (lessonId) => ({
        lessonId,
        notes: await loadLessonNotes(lessonId),
      })),
    ).then((rows) => {
      if (cancelled) return
      setNotesByLesson(new Map(rows.map((r) => [r.lessonId, r.notes])))
      setLoadedKey(key)
    })

    return () => {
      cancelled = true
    }
  }, [selectedLessonIdsKey])

  const noteCountByLesson = useMemo(() => {
    const counts = new Map<string, number>()
    for (const [lessonId, notes] of notesByLesson) {
      const n = countDisplayNotes(notes)
      if (n > 0) counts.set(lessonId, n)
    }
    return counts
  }, [notesByLesson])

  const groups = useMemo((): LessonNotesGroup[] => {
    const result: LessonNotesGroup[] = []
    for (const lessonId of selectedLessonIds) {
      const meta = SEA_LESSON_MAP[lessonId]
      const entry = lessonByKey(lessonId)
      if (!meta || !entry) continue

      const notes = notesByLesson.get(lessonId) ?? []
      const basePath = routeForLesson(entry)
      const summaryNotes = notesForProblem(notes, lessonSummaryProblemId(lessonId))
      const summary = summaryNotes[0] ?? null
      const entries = buildLessonNoteEntries(notes, lessonId, basePath, meta.problems).sort((a, b) =>
        compareNotesByCreatedAtDesc(a.note, b.note),
      )
      const showSummary = summary != null && !isRichBodyEmpty(summary.bodyHtml)
      if (!showSummary && entries.length === 0) continue

      result.push({
        lessonId,
        meta,
        basePath,
        notesHref: `${basePath}/notes`,
        summary,
        entries,
      })
    }
    return result.sort((a, b) => latestNoteCreatedAt(b).localeCompare(latestNoteCreatedAt(a)))
  }, [selectedLessonIds, notesByLesson])

  const totalNoteCount = useMemo(
    () => groups.reduce((n, g) => {
      const summaryN = g.summary && !isRichBodyEmpty(g.summary.bodyHtml) ? 1 : 0
      return n + g.entries.length + summaryN
    }, 0),
    [groups],
  )

  const allLessonsSelected =
    selectedLessons.size === seaLessonsForGrade(selectedGrade).length &&
    selectedLessons.size > 0

  return (
    <>
      <OrbBackground variant="math" />

      <header className="fixed top-0 right-0 left-0 z-20 border-b border-violet-200/60 bg-[#faf8ff]/92 shadow-[0_4px_20px_rgba(109,40,217,0.05)] backdrop-blur-lg">
        <div className="flex items-center gap-2 px-2.5 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
          <Link
            href="/math"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-violet-100 bg-white px-3 text-[12px] font-bold text-violet-900/55 no-underline shadow-sm transition-all hover:border-violet-200 hover:text-violet-900 active:scale-95 sm:text-[13px]"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span className="hidden sm:inline">返回数学</span>
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[14px] font-extrabold tracking-tight text-violet-950 sm:text-[15px]">
                汇总笔记
              </span>
              {!isLoading && totalNoteCount > 0 && (
                <span className="rounded-full bg-violet-500 px-1.5 py-px text-[10px] font-bold text-white">
                  {totalNoteCount} 条
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-1 mx-auto flex min-h-screen w-full max-w-[900px] flex-col px-2 pt-[4.75rem] pb-4 sm:px-3 sm:pt-[5.25rem] sm:pb-6">
        <NotesFilterPanel
          expanded={filterExpanded}
          onToggleExpanded={() => setFilterExpanded((v) => !v)}
          selectedGrade={selectedGrade}
          onGradeChange={handleGradeChange}
          selectedLessons={selectedLessons}
          noteCountByLesson={noteCountByLesson}
          onChangeLessons={setSelectedLessons}
        />

        {isLoading ? (
          <p className="py-16 text-center text-[13px] text-text-muted">加载中…</p>
        ) : selectedLessons.size === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-violet-200/80 bg-white/50 px-4 py-12 text-center">
            <div className="text-4xl" aria-hidden>
              🔍
            </div>
            <div className="text-text-primary max-w-xs text-[14px] font-bold leading-snug">
              请至少选择一个讲次
            </div>
            <button
              type="button"
              onClick={() => setSelectedLessons(new Set(lessonsForGrade(selectedGrade)))}
              className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700"
            >
              全选本年级讲次
            </button>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-violet-200/80 bg-white/50 px-4 py-12 text-center">
            <div className="text-4xl" aria-hidden>
              📭
            </div>
            <div className="text-text-primary max-w-xs text-[14px] font-bold leading-snug">
              {allLessonsSelected
                ? `${GRADE_LABEL[selectedGrade] ?? ''}暂无笔记`
                : '所选讲次暂无笔记'}
            </div>
            {!allLessonsSelected && (
              <button
                type="button"
                onClick={() => setSelectedLessons(new Set(lessonsForGrade(selectedGrade)))}
                className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700"
              >
                查看本年级全部讲次
              </button>
            )}
            <Link
              href="/math"
              className="rounded-full bg-violet-600 px-4 py-1.5 text-[12px] font-semibold text-white no-underline"
            >
              返回数学 →
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between px-0.5">
              <span className="text-[11px] font-semibold text-violet-900/60">
                共 {totalNoteCount} 条 · {groups.length} 讲
              </span>
              {!filterExpanded && (
                <button
                  type="button"
                  onClick={() => setFilterExpanded(true)}
                  className="text-[11px] font-semibold text-violet-500 hover:text-violet-700"
                >
                  调整筛选
                </button>
              )}
            </div>
            <div className="flex flex-col gap-4">
              {groups.map((group) => (
                <LessonNotesSection key={group.lessonId} group={group} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
