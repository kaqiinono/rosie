'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import type { Problem } from '@rosie/core'
import clsx from 'clsx'
import {
  GRADE_LABEL,
  gradesInOrder,
  lessonDisplayLabel,
  lessonsForGrade,
} from '@rosie/math/utils/lesson-grade'
import { SEA_LESSONS } from '@rosie/math/utils/sea-data'
import {
  enumerateProblemSet,
  problemSectionLabel,
  problemSetSourceButtons,
} from '@rosie/math/utils/problem-set-helpers'
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
import AnalysisGuideBadge from '@rosie/math/components/shared/AnalysisGuideBadge'
import { problemHasAnalysisImage } from '@rosie/math/utils/problem-analysis-image'

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
  const grades = gradesInOrder()
  const defaultLesson = lessonsForGrade(grades[grades.length - 1] ?? 2)[0] ?? '55'

  const [selectedLesson, setSelectedLesson] = useState(defaultLesson)
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null)
  const [imageKind, setImageKind] = useState<MathImageKind>(() => readPersistedImageKind())
  const [flash, setFlash] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState<Set<string>>(new Set())
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set())
  const [imageCoverage, setImageCoverage] = useState<ImageCoverageFlags>(DEFAULT_IMAGE_COVERAGE)
  const [notesCoverage, setNotesCoverage] = useState<NotesCoverageFlags>(DEFAULT_NOTES_COVERAGE)
  const [detailTab, setDetailTab] = useState<DetailTab>('image')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isSummaryDragOver, setIsSummaryDragOver] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const summaryInputRef = useRef<HTMLInputElement>(null)
  const admin = useMathProblemImagesAdmin(user, selectedLesson)
  const notesAdmin = useMathProblemNotesAdmin(user, selectedLesson)

  const cloudAnalysisIds = useMemo(() => {
    const ids = new Set<string>()
    for (const row of admin.images) {
      if (row.imageKind === 'analysis') ids.add(row.problemId)
    }
    return ids
  }, [admin.images])

  const lessonMeta = useMemo(
    () => SEA_LESSONS.find((l) => l.id === selectedLesson),
    [selectedLesson],
  )

  const sourceBtns = useMemo(
    () => (lessonMeta ? problemSetSourceButtons(lessonMeta.problems, selectedLesson) : []),
    [lessonMeta, selectedLesson],
  )

  const typeBtns = useMemo(
    () => (lessonMeta ? lessonMeta.types.map((t) => ({ key: t.tag, label: t.label })) : []),
    [lessonMeta],
  )

  useEffect(() => {
    setSourceFilter(new Set(sourceBtns.map((b) => b.key)))
    setTypeFilter(new Set(typeBtns.map((b) => b.key)))
  }, [selectedLesson, sourceBtns, typeBtns])

  useEffect(() => {
    setImageCoverage(DEFAULT_IMAGE_COVERAGE)
    setNotesCoverage(DEFAULT_NOTES_COVERAGE)
  }, [selectedLesson])

  const { findImage } = admin

  const problems = useMemo(() => {
    if (!lessonMeta) return []
    const q = filter.trim().toLowerCase()
    return enumerateProblemSet(lessonMeta.problems)
      .filter(
        ({ problem: p, setName }) =>
          sourceFilter.has(setName) &&
          typeFilter.has(p.tag) &&
          matchesImageCoverage(p, imageCoverage, findImage) &&
          matchesNotesCoverage(p.id, notesCoverage, notesAdmin.counts.get(p.id) ?? 0) &&
          (!q ||
            p.id.toLowerCase().includes(q) ||
            p.title.toLowerCase().includes(q) ||
            problemSectionLabel(p.id, selectedLesson).includes(q) ||
            p.tagLabel.toLowerCase().includes(q)),
      )
      .map(({ problem }) => problem)
  }, [
    lessonMeta,
    filter,
    sourceFilter,
    typeFilter,
    imageCoverage,
    notesCoverage,
    notesAdmin.counts,
    findImage,
    selectedLesson,
  ])

  useEffect(() => {
    if (selectedProblem && !problems.some((p) => p.id === selectedProblem.id)) {
      setSelectedProblem(null)
    }
  }, [problems, selectedProblem])

  function toggleFilter(axis: 'source' | 'type' | 'image' | 'notes', value: string) {
    if (axis === 'source') {
      setSourceFilter((prev) => {
        const next = new Set(prev)
        if (next.has(value)) next.delete(value)
        else next.add(value)
        return next
      })
      return
    }
    if (axis === 'type') {
      setTypeFilter((prev) => {
        const next = new Set(prev)
        if (next.has(value)) next.delete(value)
        else next.add(value)
        return next
      })
      return
    }
    if (axis === 'image') {
      const key = value as ImageCoverageKey
      setImageCoverage((prev) => ({ ...prev, [key]: !prev[key] }))
      return
    }
    toggleNotesFilter(value as NotesCoverageKey)
  }

  function toggleNotesFilter(key: NotesCoverageKey) {
    setNotesCoverage((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleAll(axis: 'source' | 'type' | 'image' | 'notes') {
    if (axis === 'source') {
      const allSelected = sourceBtns.every((b) => sourceFilter.has(b.key))
      setSourceFilter(allSelected ? new Set() : new Set(sourceBtns.map((b) => b.key)))
      return
    }
    if (axis === 'type') {
      const allSelected = typeBtns.every((b) => typeFilter.has(b.key))
      setTypeFilter(allSelected ? new Set() : new Set(typeBtns.map((b) => b.key)))
      return
    }
    if (axis === 'image') {
      const allSelected = imageCoverage.analysis && imageCoverage.figure
      setImageCoverage(allSelected ? DEFAULT_IMAGE_COVERAGE : ALL_IMAGE_COVERAGE)
      return
    }
    const allNotesSelected = notesCoverage.has && notesCoverage.none
    setNotesCoverage(allNotesSelected ? DEFAULT_NOTES_COVERAGE : ALL_NOTES_COVERAGE)
  }

  const allSourceSelected = sourceBtns.length > 0 && sourceBtns.every((b) => sourceFilter.has(b.key))
  const allTypeSelected = typeBtns.length > 0 && typeBtns.every((b) => typeFilter.has(b.key))
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

  const uploadSummaryFile = useCallback(
    async (file: File) => {
      if (admin.isUploading) return
      if (!isAcceptedImage(file)) {
        showFlash('仅支持 PNG / JPG / WEBP / GIF')
        return
      }
      if (file.size > MAX_FILE_BYTES) {
        showFlash(`文件过大（最大 ${MAX_FILE_MB} MB）`)
        return
      }

      const problemId = lessonSummaryProblemId(selectedLesson)
      const { error } = await admin.uploadImage(problemId, 'summary', file)
      if (error) {
        showFlash(
          error.includes('row-level security') || error.includes('Unauthorized')
            ? `上传失败：数据库权限未放行总结图，请在 Supabase 执行 docs/sql/math-lesson-summary-rls.sql`
            : `上传失败：${error}`,
        )
      } else showFlash('总结图上传成功')
    },
    [admin, selectedLesson, showFlash],
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

  const summaryProblemId = lessonSummaryProblemId(selectedLesson)
  const summaryImage = admin.findImage(summaryProblemId, 'summary')
  const summaryUrl = summaryImage ? admin.getImageUrl(summaryImage.storagePath) : null

  async function handleSummaryFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) await uploadSummaryFile(file)
  }

  function handleSummaryDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!admin.isUploading) setIsSummaryDragOver(true)
  }

  function handleSummaryDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsSummaryDragOver(false)
  }

  function handleSummaryDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsSummaryDragOver(false)
    if (admin.isUploading) return
    const file = pickImageFile(e.dataTransfer.files)
    if (!file) {
      showFlash('请拖入图片文件')
      return
    }
    void uploadSummaryFile(file)
  }

  async function handleDeleteSummary() {
    if (!summaryImage) return
    if (!window.confirm(`确定删除第 ${selectedLesson} 讲的内容总结图？`)) return
    const { error } = await admin.removeImage(summaryImage)
    if (error) showFlash(`删除失败：${error}`)
    else showFlash('总结图已删除')
  }

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
            <div className="truncate text-[11px] text-slate-500">题图上传 · 笔记编辑 · PDF 分片</div>
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
              PDF 分片
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
          <MathPdfSliceMatcher user={user} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[280px_1fr_320px]">
        {/* Lesson picker + filters */}
        <aside className="rounded-2xl border border-teal-100 bg-white/90 p-3 shadow-sm">
          <div className="mb-2 text-[12px] font-bold text-slate-500">选择讲次</div>
          <div className="mb-3 max-h-[36vh] space-y-3 overflow-y-auto">
            {grades.map((grade) => (
              <div key={grade}>
                <div className="mb-1 px-1 text-[11px] font-bold text-teal-700">{GRADE_LABEL[grade]}</div>
                <div className="flex flex-wrap gap-1.5">
                  {lessonsForGrade(grade).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setSelectedLesson(id)
                        setSelectedProblem(null)
                        setDetailTab('image')
                        setIsDragOver(false)
                      }}
                      className={`rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition ${
                        selectedLesson === id
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
                      }`}
                    >
                      {lessonDisplayLabel(id, true)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-teal-100 pt-3">
            <div className="mb-2 text-[12px] font-bold text-slate-500">筛选题目</div>
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="搜索题号、标题…"
              className="mb-2.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-[12px] outline-none focus:border-teal-400"
            />

            <div className="max-h-[42vh] space-y-2 overflow-y-auto rounded-xl border border-teal-100 bg-teal-50/40 p-2.5">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-teal-800">📂 来源</span>
                  {sourceBtns.length > 1 && (
                    <button
                      type="button"
                      onClick={() => toggleAll('source')}
                      className="text-[10px] text-teal-600 transition hover:text-teal-800"
                    >
                      {allSourceSelected ? '全不选' : '全选'}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sourceBtns.map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => toggleFilter('source', b.key)}
                      className={`${filterBtnBase} ${sourceFilter.has(b.key) ? filterBtnOn : filterBtnOff}`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-teal-800">🏷️ 题型</span>
                  {typeBtns.length > 1 && (
                    <button
                      type="button"
                      onClick={() => toggleAll('type')}
                      className="text-[10px] text-teal-600 transition hover:text-teal-800"
                    >
                      {allTypeSelected ? '全不选' : '全选'}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {typeBtns.map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => toggleFilter('type', b.key)}
                      className={`${filterBtnBase} ${typeFilter.has(b.key) ? filterBtnOn : filterBtnOff}`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-teal-800">🖼️ 题图</span>
                  <button
                    type="button"
                    onClick={() => toggleAll('image')}
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
                      onClick={() => toggleFilter('image', b.key)}
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
                    onClick={() => toggleAll('notes')}
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
                      onClick={() => toggleFilter('notes', b.key)}
                      className={`${filterBtnBase} ${notesCoverage[b.key] ? filterBtnOn : filterBtnOff}`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Problem list */}
        <section className="rounded-2xl border border-teal-100 bg-white/90 p-3 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-extrabold text-slate-800">
              {lessonMeta?.title ?? `第 ${selectedLesson} 讲`}
            </h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
              {problems.length} 题
            </span>
            {summaryUrl && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                已有总结图
              </span>
            )}
          </div>

          {admin.isLoading || notesAdmin.isLoading ? (
            <div className="flex items-center justify-center py-16 text-[13px] text-slate-400">加载中…</div>
          ) : (
            <ul className="max-h-[84vh] space-y-1 overflow-y-auto">
              {problems.map((p) => {
                const status = imageStatus(p.id, admin.findImage)
                const hasAnalysis = problemHasAnalysisImage(p, cloudAnalysisIds)
                const noteCount = notesAdmin.counts.get(p.id) ?? 0
                const active = selectedProblem?.id === p.id
                return (
                  <li key={p.id}>
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
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                            {problemSectionLabel(p.id, selectedLesson)}
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
            <div className="space-y-4">
              <div>
                <div className="text-[12px] font-bold text-violet-900">第 {selectedLesson} 讲 · 内容总结图</div>
                <p className="mt-1 text-[11px] leading-relaxed text-violet-700">{MATH_IMAGE_KIND_HINT.summary}</p>
                <p className="mt-0.5 text-[10px] text-violet-600/75">
                  若报 403 RLS，在 Supabase SQL Editor 执行{' '}
                  <code className="text-[9px]">docs/sql/math-lesson-summary-rls.sql</code>
                </p>
              </div>

              <input
                ref={summaryInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleSummaryFile}
              />

              <div
                className={`relative rounded-xl border border-dashed p-3 transition ${
                  isSummaryDragOver
                    ? 'border-violet-500 bg-violet-100/80 ring-2 ring-violet-300'
                    : 'border-violet-200 bg-violet-50/50'
                }`}
                onDragOver={handleSummaryDragOver}
                onDragLeave={handleSummaryDragLeave}
                onDrop={handleSummaryDrop}
              >
                {summaryUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={summaryUrl}
                    alt={`第 ${selectedLesson} 讲内容总结`}
                    className="mx-auto max-h-56 w-full rounded-lg object-contain"
                  />
                ) : (
                  <div className="flex min-h-[120px] flex-col items-center justify-center gap-1 text-center text-[12px] text-violet-600/80">
                    <span>拖入图片或点击下方上传</span>
                    <span className="text-[10px] opacity-70">PNG / JPG / WEBP / GIF · 最大 {MAX_FILE_MB} MB</span>
                  </div>
                )}
                {isSummaryDragOver && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-violet-100/90 text-[12px] font-semibold text-violet-800">
                    松开上传总结图
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={admin.isUploading}
                onClick={() => summaryInputRef.current?.click()}
                className="w-full rounded-xl bg-violet-600 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
              >
                {admin.isUploading ? '上传中…' : summaryUrl ? '替换总结图' : '上传总结图'}
              </button>

              {summaryUrl && (
                <button
                  type="button"
                  onClick={() => void handleDeleteSummary()}
                  disabled={admin.isUploading}
                  className="w-full rounded-xl border border-red-200 py-2 text-[12px] font-semibold text-red-600 transition hover:bg-red-50"
                >
                  删除总结图
                </button>
              )}
            </div>
          ) : !selectedProblem ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <div className="text-3xl opacity-40">👈</div>
              <div className="text-[13px] text-slate-500">从中间列表选择一道题</div>
              <div className="text-[11px] text-slate-400">或切换到「总结」管理本讲内容图</div>
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
