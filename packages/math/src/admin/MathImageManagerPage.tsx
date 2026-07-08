'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import type { Problem } from '@rosie/core'
import clsx from 'clsx'
import { findSeaLesson } from '@rosie/math/utils/sea-data'
import {
  buildProblemPool,
  filterProblemPool,
} from '@rosie/math/utils/math-problem-search'
import MathLessonFilterPanel from '@rosie/math/admin/MathLessonFilterPanel'
import { useMathLessonFilter } from '@rosie/math/admin/useMathLessonFilter'
import {
  MATH_IMAGE_KIND_LABEL,
  MATH_IMAGE_KIND_HINT,
  readPersistedImageKind,
  persistImageKind,
  lessonSummaryProblemId,
  type MathImageKind,
} from '@rosie/math/constants'
import { useMathProblemImagesAdmin } from '@rosie/math/hooks/useMathProblemImagesAdmin'
import { useMathProblemNotesAdmin } from '@rosie/math/hooks/useMathProblemNotesAdmin'
import MathPdfSliceMatcher from '@rosie/math/admin/MathPdfSliceMatcher'
import MathProblemNotesPanel from '@rosie/math/admin/MathProblemNotesPanel'
import MathLessonSummariesPanel from '@rosie/math/admin/MathLessonSummariesPanel'
import AnalysisGuideBadge from '@rosie/math/components/shared/AnalysisGuideBadge'
import { problemHasAnalysisImage } from '@rosie/math/utils/problem-analysis-image'
import { isRichBodyEmpty } from '@rosie/math/utils/sanitize-summary-html'

type Props = { user: User | null }

type AdminMode = 'single' | 'pdf-slice'

type DetailTab = 'image' | 'notes' | 'summary'

type ImageCoverageKey = 'analysis' | 'figure'
type NotesCoverageKey = 'has' | 'none'

const IMAGE_COVERAGE_BTNS: { key: ImageCoverageKey; label: string }[] = [
  { key: 'analysis', label: '题解图' },
  { key: 'figure', label: '题面图' },
]

const NOTES_COVERAGE_BTNS: { key: NotesCoverageKey; label: string }[] = [
  { key: 'has', label: '有笔记' },
  { key: 'none', label: '无笔记' },
]

const MAX_FILE_MB = 20
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024
const ACCEPTED_IMAGE_RE = /\.(png|jpe?g|webp|gif)$/i

function isAcceptedImage(file: File): boolean {
  const type = file.type.toLowerCase()
  if (type.startsWith('image/')) {
    const sub = type.split('/')[1]
    return sub === 'png' || sub === 'jpeg' || sub === 'jpg' || sub === 'webp' || sub === 'gif'
  }
  return ACCEPTED_IMAGE_RE.test(file.name)
}

function pickImageFile(files: FileList | Iterable<File>): File | null {
  for (const file of files) {
    if (isAcceptedImage(file)) return file
  }
  return null
}

function pickImageFromClipboard(dt: DataTransfer): File | null {
  for (const item of dt.items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file && isAcceptedImage(file)) return file
    }
  }
  return pickImageFile(dt.files)
}

function imageStatus(
  problemId: string,
  findImage: (problemId: string, kind: MathImageKind) => { storagePath: string } | undefined,
): { analysis: boolean; figure: boolean } {
  return {
    analysis: !!findImage(problemId, 'analysis'),
    figure: !!findImage(problemId, 'figure'),
  }
}

type ImageCoverageFlags = { analysis: boolean; figure: boolean }
type NotesCoverageFlags = { has: boolean; none: boolean }

/** Default: both off → problems missing both image types. */
const DEFAULT_IMAGE_COVERAGE: ImageCoverageFlags = { analysis: false, figure: false }
const DEFAULT_NOTES_COVERAGE: NotesCoverageFlags = { has: false, none: false }

const ALL_IMAGE_COVERAGE: ImageCoverageFlags = { analysis: true, figure: true }
const ALL_NOTES_COVERAGE: NotesCoverageFlags = { has: true, none: true }

type FindImageFn = (
  problemId: string,
  kind: MathImageKind,
) => { storagePath: string } | undefined

/** Matches list badges: cloud upload and/or static analysisImg / figureNode. */
function matchesImageCoverage(
  problem: Problem,
  coverage: ImageCoverageFlags,
  findImage: FindImageFn,
): boolean {
  const hasAnalysis = Boolean(problem.analysisImg) || Boolean(findImage(problem.id, 'analysis'))
  const hasFigure = Boolean(problem.figureNode) || Boolean(findImage(problem.id, 'figure'))

  const { analysis, figure } = coverage
  if (analysis && figure) return true
  if (!analysis && !figure) return !hasAnalysis && !hasFigure
  if (analysis) return hasAnalysis
  return hasFigure
}

function matchesNotesCoverage(
  problemId: string,
  coverage: NotesCoverageFlags,
  noteCount: number,
): boolean {
  const hasNotes = noteCount > 0
  const { has, none } = coverage
  if (has && none) return true
  if (!has && !none) return true
  if (has) return hasNotes
  return !hasNotes
}

export default function MathImageManagerPage({ user }: Props) {
  const [mode, setMode] = useState<AdminMode>('single')
  const lessonFilter = useMathLessonFilter()
  const {
    grades,
    selectedGrade,
    selectedLessons,
    selectedLessonsKey,
    selectedLessonSet,
    gradeLessonIds,
    sourceFilter,
    typeFilter,
    selectGrade,
    toggleLesson,
    toggleAllLessonsInGrade,
    toggleFilter,
    toggleAllFilters,
  } = lessonFilter

  const summaryLessonIds = selectedLessons

  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null)
  const [imageKind, setImageKind] = useState<MathImageKind>(() => readPersistedImageKind())
  const [flash, setFlash] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [imageCoverage, setImageCoverage] = useState<ImageCoverageFlags>(DEFAULT_IMAGE_COVERAGE)
  const [notesCoverage, setNotesCoverage] = useState<NotesCoverageFlags>(DEFAULT_NOTES_COVERAGE)
  const [detailTab, setDetailTab] = useState<DetailTab>('image')
  const [isDragOver, setIsDragOver] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const admin = useMathProblemImagesAdmin(user, selectedLessons)
  const notesAdmin = useMathProblemNotesAdmin(user, selectedLessons)

  const cloudAnalysisIds = useMemo(() => {
    const ids = new Set<string>()
    for (const row of admin.images) {
      if (row.imageKind === 'analysis') ids.add(row.problemId)
    }
    return ids
  }, [admin.images])

  const listTitle = useMemo(() => {
    if (selectedLessons.length === 0) return '请选择讲次'
    if (selectedLessons.length === 1) {
      const lesson = findSeaLesson(selectedLessons[0])
      return lesson?.title ?? `第 ${selectedLessons[0]} 讲`
    }
    return `已选 ${selectedLessons.length} 讲`
  }, [selectedLessons, selectedLessonsKey])

  const summaryCount = useMemo(
    () =>
      selectedLessons.filter((id) =>
        notesAdmin
          .getNotes(lessonSummaryProblemId(id))
          .some((n) => !isRichBodyEmpty(n.bodyHtml)),
      ).length,
    [selectedLessons, selectedLessonsKey, notesAdmin],
  )

  const hasSummary = summaryCount > 0

  useEffect(() => {
    setImageCoverage(DEFAULT_IMAGE_COVERAGE)
    setNotesCoverage(DEFAULT_NOTES_COVERAGE)
  }, [selectedLessonsKey])

  const { findImage } = admin

  const problemItems = useMemo(() => {
    if (selectedLessons.length === 0) return []
    const pool = filterProblemPool(buildProblemPool(selectedLessons), sourceFilter, typeFilter)
    const q = filter.trim().toLowerCase()
    return pool.filter(
      (item) =>
        matchesImageCoverage(item.problem, imageCoverage, findImage) &&
        matchesNotesCoverage(item.problem.id, notesCoverage, notesAdmin.counts.get(item.problem.id) ?? 0) &&
        (!q ||
          item.problem.id.toLowerCase().includes(q) ||
          item.problem.title.toLowerCase().includes(q) ||
          item.sectionLabel.includes(q) ||
          item.problem.tagLabel.toLowerCase().includes(q)),
    )
  }, [
    selectedLessons,
    selectedLessonsKey,
    sourceFilter,
    typeFilter,
    imageCoverage,
    notesCoverage,
    notesAdmin.counts,
    findImage,
    filter,
  ])

  useEffect(() => {
    if (selectedProblem && !problemItems.some((item) => item.problem.id === selectedProblem.id)) {
      setSelectedProblem(null)
    }
  }, [problemItems, selectedProblem])

  function toggleImageCoverage(key: ImageCoverageKey) {
    setImageCoverage((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleNotesCoverage(key: NotesCoverageKey) {
    setNotesCoverage((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleAllImageCoverage() {
    const allSelected = imageCoverage.analysis && imageCoverage.figure
    setImageCoverage(allSelected ? DEFAULT_IMAGE_COVERAGE : ALL_IMAGE_COVERAGE)
  }

  function toggleAllNotesCoverage() {
    const allSelected = notesCoverage.has && notesCoverage.none
    setNotesCoverage(allSelected ? DEFAULT_NOTES_COVERAGE : ALL_NOTES_COVERAGE)
  }

  const allImageCoverageSelected = imageCoverage.analysis && imageCoverage.figure
  const allNotesCoverageSelected = notesCoverage.has && notesCoverage.none
  const filterBtnBase =
    'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition active:scale-95'
  const filterBtnOn = 'border-teal-600 bg-teal-600 text-white'
  const filterBtnOff = 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100'

  const showFlash = useCallback((msg: string) => {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 2200)
  }, [])

  const uploadFile = useCallback(
    async (file: File) => {
      if (!selectedProblem || admin.isUploading) return
      if (!isAcceptedImage(file)) {
        showFlash('仅支持 PNG / JPG / WEBP / GIF')
        return
      }
      if (file.size > MAX_FILE_BYTES) {
        showFlash(`文件过大（最大 ${MAX_FILE_MB} MB）`)
        return
      }

      const { error } = await admin.uploadImage(selectedProblem.id, imageKind, file)
      if (error) showFlash(`上传失败：${error}`)
      else showFlash('上传成功')
    },
    [selectedProblem, imageKind, admin, showFlash],
  )

  useEffect(() => {
    if (!selectedProblem || detailTab !== 'image') return

    function onPaste(e: ClipboardEvent) {
      const target = e.target
      if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]')) {
        return
      }
      const file = e.clipboardData ? pickImageFromClipboard(e.clipboardData) : null
      if (!file) return
      e.preventDefault()
      void uploadFile(file)
    }

    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [selectedProblem, detailTab, uploadFile])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) await uploadFile(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (selectedProblem && !admin.isUploading) setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (!selectedProblem || admin.isUploading) return
    const file = pickImageFile(e.dataTransfer.files)
    if (!file) {
      showFlash('请拖入图片文件')
      return
    }
    void uploadFile(file)
  }

  async function handleMoveKind(targetKind: MathImageKind) {
    if (!selectedProblem || !currentImage || imageKind === targetKind) return
    if (
      !window.confirm(
        `将此图从「${MATH_IMAGE_KIND_LABEL[imageKind]}」改为「${MATH_IMAGE_KIND_LABEL[targetKind]}」？\n${MATH_IMAGE_KIND_HINT[targetKind]}`,
      )
    ) {
      return
    }
    const { error } = await admin.moveImageKind(currentImage, targetKind)
    if (error) showFlash(`更正失败：${error}`)
    else {
      setImageKind(targetKind)
      persistImageKind(targetKind)
      showFlash(`已改为${MATH_IMAGE_KIND_LABEL[targetKind]}`)
    }
  }

  async function handleDelete() {
    if (!selectedProblem) return
    const row = admin.findImage(selectedProblem.id, imageKind)
    if (!row) return
    if (!window.confirm(`确定删除 ${selectedProblem.id} 的${MATH_IMAGE_KIND_LABEL[imageKind]}？`)) return

    const { error } = await admin.removeImage(row)
    if (error) showFlash(`删除失败：${error}`)
    else showFlash('已删除')
  }

  const currentImage = selectedProblem ? admin.findImage(selectedProblem.id, imageKind) : undefined
  const currentUrl = currentImage ? admin.getImageUrl(currentImage.storagePath) : null
  const staticAnalysis = selectedProblem?.analysisImg ?? null

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <div className="text-4xl opacity-30">🔐</div>
        <div className="text-sm text-slate-500">请先登录</div>
        <Link
          href="/auth"
          className="rounded-full px-4 py-2 text-[13px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#0d9488,#0f766e)' }}
        >
          去登录
        </Link>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen pb-16"
      style={{ background: 'linear-gradient(160deg,#ecfdf5 0%,#f0fdfa 40%,#eff6ff 100%)' }}
    >
      <header
        className="sticky top-0 z-30 backdrop-blur"
        style={{
          background: 'rgba(255,255,255,0.9)',
          borderBottom: '1px solid rgba(13,148,136,0.15)',
          boxShadow: '0 1px 12px rgba(0,0,0,0.04)',
        }}
      >
        <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-3 px-4">
          <Link
            href="/admin"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-teal-700 transition hover:scale-110"
            style={{ background: 'rgba(13,148,136,0.10)', border: '1.5px solid rgba(13,148,136,0.25)' }}
            aria-label="返回管理后台"
          >
            ←
          </Link>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-extrabold text-teal-900">📐 数学题管理</div>
            <div className="truncate text-[11px] text-slate-500">题图上传 · 笔记编辑 · 素材分片</div>
          </div>
          <div className="flex shrink-0 gap-1 rounded-xl bg-teal-50 p-1">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={clsx(
                'rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition',
                mode === 'single' ? 'bg-white text-teal-800 shadow-sm' : 'text-teal-600',
              )}
            >
              单题上传
            </button>
            <button
              type="button"
              onClick={() => setMode('pdf-slice')}
              className={clsx(
                'rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition',
                mode === 'pdf-slice' ? 'bg-white text-teal-800 shadow-sm' : 'text-teal-600',
              )}
            >
              素材分片
            </button>
          </div>
        </div>
      </header>

      {flash && (
        <div className="pointer-events-none fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-full bg-teal-800 px-4 py-2 text-[13px] font-semibold text-white shadow-lg">
          {flash}
        </div>
      )}

      <main className="mx-auto max-w-[1200px] px-4 py-5">
        {mode === 'pdf-slice' ? (
          <MathPdfSliceMatcher user={user} lessonFilter={lessonFilter} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[260px_1fr_300px]">
        <div className="space-y-3">
          <MathLessonFilterPanel
            grades={grades}
            selectedGrade={selectedGrade}
            gradeLessonIds={gradeLessonIds}
            selectedLessonSet={selectedLessonSet}
            sourceBtns={lessonFilter.sourceBtns}
            typeBtns={lessonFilter.typeBtns}
            sourceFilter={sourceFilter}
            typeFilter={typeFilter}
            onSelectGrade={selectGrade}
            onToggleLesson={(id) => {
              toggleLesson(id)
              setSelectedProblem(null)
              setDetailTab('image')
              setIsDragOver(false)
            }}
            onToggleAllLessons={() => {
              toggleAllLessonsInGrade()
              setSelectedProblem(null)
            }}
            onToggleFilter={toggleFilter}
            onToggleAllFilters={toggleAllFilters}
          />

          <section className="rounded-2xl border border-teal-100 bg-white/90 p-3 shadow-sm">
            <div className="mb-2 text-[12px] font-bold text-slate-500">筛选题目</div>
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="搜索题号、标题…"
              className="mb-2.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-[12px] outline-none focus:border-teal-400"
            />

            <div className="space-y-2 rounded-xl border border-teal-100 bg-teal-50/40 p-2.5">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-teal-800">🖼️ 题图</span>
                  <button
                    type="button"
                    onClick={toggleAllImageCoverage}
                    className="text-[10px] text-teal-600 transition hover:text-teal-800"
                  >
                    {allImageCoverageSelected ? '清除' : '全选'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {IMAGE_COVERAGE_BTNS.map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => toggleImageCoverage(b.key)}
                      className={`${filterBtnBase} ${imageCoverage[b.key] ? filterBtnOn : filterBtnOff}`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-teal-800">📝 笔记</span>
                  <button
                    type="button"
                    onClick={toggleAllNotesCoverage}
                    className="text-[10px] text-teal-600 transition hover:text-teal-800"
                  >
                    {allNotesCoverageSelected ? '清除' : '全选'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {NOTES_COVERAGE_BTNS.map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => toggleNotesCoverage(b.key)}
                      className={`${filterBtnBase} ${notesCoverage[b.key] ? filterBtnOn : filterBtnOff}`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Problem list */}
        <section className="rounded-2xl border border-teal-100 bg-white/90 p-3 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-extrabold text-slate-800">{listTitle}</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
              {problemItems.length} 题
            </span>
            {hasSummary && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                {selectedLessons.length > 1
                  ? `${summaryCount}/${selectedLessons.length} 讲有总结`
                  : '已有总结'}
              </span>
            )}
          </div>

          {admin.isLoading || notesAdmin.isLoading ? (
            <div className="flex items-center justify-center py-16 text-[13px] text-slate-400">加载中…</div>
          ) : (
            <ul className="max-h-[84vh] space-y-1 overflow-y-auto">
              {problemItems.map((item) => {
                const p = item.problem
                const status = imageStatus(p.id, admin.findImage)
                const hasAnalysis = problemHasAnalysisImage(p, cloudAnalysisIds)
                const noteCount = notesAdmin.counts.get(p.id) ?? 0
                const active = selectedProblem?.id === p.id
                return (
                  <li key={`${item.lessonId}-${p.id}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProblem(p)
                        setDetailTab('image')
                        setIsDragOver(false)
                      }}
                      className={`flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left transition ${
                        active ? 'bg-teal-50 ring-1 ring-teal-300' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[11px] font-bold text-teal-700">{p.id}</span>
                          {selectedLessons.length > 1 && (
                            <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] text-teal-700">
                              {item.lessonTitle}
                            </span>
                          )}
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                            {item.sectionLabel}
                          </span>
                          <AnalysisGuideBadge hasImage={hasAnalysis} showMissing size="sm" />
                        </div>
                        <div className="truncate text-[12px] text-slate-700">{p.title}</div>
                      </div>
                      <div className="flex shrink-0 gap-1 pt-0.5">
                        <span
                          title="题解图"
                          className={`rounded px-1 text-[10px] font-bold ${
                            status.analysis || p.analysisImg
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          解
                        </span>
                        <span
                          title="题面图"
                          className={`rounded px-1 text-[10px] font-bold ${
                            status.figure || p.figureNode
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          面
                        </span>
                        <span
                          title="笔记"
                          className={`rounded px-1 text-[10px] font-bold ${
                            noteCount > 0 ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          记{noteCount > 0 ? noteCount : ''}
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Detail panel */}
        <aside className="rounded-2xl border border-teal-100 bg-white/90 p-4 shadow-sm">
          <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
            {(
              [
                { key: 'image' as const, label: '图片' },
                { key: 'notes' as const, label: '笔记' },
                { key: 'summary' as const, label: '总结' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setDetailTab(tab.key)}
                className={`flex-1 rounded-lg py-2 text-[12px] font-bold transition ${
                  detailTab === tab.key ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {detailTab === 'summary' ? (
            <MathLessonSummariesPanel
              lessonIds={summaryLessonIds}
              admin={notesAdmin}
              onFlash={showFlash}
            />
          ) : !selectedProblem ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <div className="text-3xl opacity-40">👈</div>
              <div className="text-[13px] text-slate-500">从中间列表选择一道题</div>
              <div className="text-[11px] text-slate-400">或切换到「总结」编辑本讲要点</div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="font-mono text-[12px] font-bold text-teal-700">{selectedProblem.id}</div>
                <div className="text-[13px] font-semibold text-slate-800">{selectedProblem.title}</div>
              </div>

              {detailTab === 'notes' ? (
                <MathProblemNotesPanel problem={selectedProblem} admin={notesAdmin} onFlash={showFlash} />
              ) : (
                <>
              <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                {(['analysis', 'figure'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      setImageKind(kind)
                      persistImageKind(kind)
                      setIsDragOver(false)
                    }}
                    className={`flex-1 rounded-lg py-2 text-[12px] font-bold transition ${
                      imageKind === kind ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    {MATH_IMAGE_KIND_LABEL[kind]}
                  </button>
                ))}
              </div>

              <p className="text-[11px] leading-relaxed text-teal-700">
                {MATH_IMAGE_KIND_HINT[imageKind]}
              </p>

              <div
                className={`relative rounded-xl border border-dashed p-3 transition ${
                  isDragOver
                    ? 'border-teal-500 bg-teal-100/80 ring-2 ring-teal-300'
                    : 'border-teal-200 bg-teal-50/50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {currentUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentUrl}
                    alt={selectedProblem.title}
                    className="mx-auto max-h-48 w-full rounded-lg object-contain"
                  />
                ) : imageKind === 'analysis' && staticAnalysis ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={staticAnalysis}
                    alt={selectedProblem.title}
                    className="mx-auto max-h-48 w-full rounded-lg object-contain opacity-80"
                  />
                ) : (
                  <div className="py-10 text-center text-[12px] text-slate-400">
                    暂无图片
                    <div className="mt-1 text-[10px]">拖入图片或粘贴（⌘V / Ctrl+V）</div>
                  </div>
                )}

                {imageKind === 'analysis' && !currentUrl && staticAnalysis && (
                  <p className="mt-2 text-center text-[10px] text-amber-600">
                    当前使用代码内置路径（上传后将覆盖）
                  </p>
                )}

                {isDragOver && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-teal-100/90 text-[12px] font-semibold text-teal-800">
                    松开上传图片
                  </div>
                )}
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleFile}
              />

              <button
                type="button"
                disabled={admin.isUploading}
                onClick={() => inputRef.current?.click()}
                className="w-full rounded-xl bg-teal-600 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60"
              >
                {admin.isUploading ? '上传中…' : currentUrl ? '替换图片' : '上传图片'}
              </button>

              {currentUrl && (
                <>
                  {imageKind === 'analysis' && (
                    <button
                      type="button"
                      onClick={() => void handleMoveKind('figure')}
                      className="w-full rounded-xl border border-sky-200 py-2 text-[12px] font-semibold text-sky-700 transition hover:bg-sky-50"
                    >
                      更正为题面图（移到题干下方）
                    </button>
                  )}
                  {imageKind === 'figure' && (
                    <button
                      type="button"
                      onClick={() => void handleMoveKind('analysis')}
                      className="w-full rounded-xl border border-amber-200 py-2 text-[12px] font-semibold text-amber-700 transition hover:bg-amber-50"
                    >
                      更正为题解图（移到解析里）
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    className="w-full rounded-xl border border-red-200 py-2 text-[12px] font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    删除云端图片
                  </button>
                </>
              )}

              <p className="text-[10px] leading-relaxed text-slate-400">
                题解图显示在「查看题解」面板内；题面图显示在题目文字下方。上传前请确认上方标签；误传可用「更正」按钮调整，无需重新划片。
              </p>
                </>
              )}
            </div>
          )}
        </aside>
          </div>
        )}
      </main>
    </div>
  )
}
