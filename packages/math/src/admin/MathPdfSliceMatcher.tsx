'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import clsx from 'clsx'
import {
  GRADE_LABEL,
  gradesInOrder,
  lessonDisplayLabel,
  lessonsForGrade,
} from '@rosie/math/utils/lesson-grade'
import {
  MATH_IMAGE_KIND_LABEL,
  MATH_IMAGE_KIND_HINT,
  readPersistedImageKind,
  persistImageKind,
  type MathImageKind,
  lessonIdFromProblemId,
} from '@rosie/math/constants'
import { cropImageBlob, rectIoU, type NormalizedRect } from '@rosie/math/utils/crop-image-blob'
import { renderPdfFilesToPageUrls, revokePageUrls, type PdfPageMeta } from '@rosie/math/utils/math-pdf'
import {
  buildProblemPool,
  filterProblemPool,
  aggregateSourceButtons,
  aggregateTypeButtons,
  searchProblems,
  type SearchableProblem,
} from '@rosie/math/utils/math-problem-search'
import { problemHasAnalysisImage } from '@rosie/math/utils/problem-analysis-image'
import AnalysisGuideBadge from '@rosie/math/components/shared/AnalysisGuideBadge'
import {
  fetchLessonProblemImages,
  getMathImagePublicUrl,
  uploadMathProblemImage,
  invalidateLessonImageCache,
  type MathProblemImage,
} from '@rosie/math/hooks/useMathProblemImages'

type Props = { user: User }

type PdfSlice = {
  id: string
  pageIndex: number
  rect: NormalizedRect
  cropUrl: string
  cropBlob: Blob
  imageKind: MathImageKind
  lessonId: string | null
  problemId: string | null
}

type OverlapPrompt = {
  newRect: NormalizedRect
  pageIndex: number
  newCropUrl: string
  newCropBlob: Blob
  existingSlice: PdfSlice
}

type CloudOverwritePrompt = {
  slice: PdfSlice
  candidate: SearchableProblem
  existingUrl: string
}

const MIN_SLICE_PX = 24
const OVERLAP_IOU = 0.25
const MAX_PDF_MB = 40

const FILTER_BTN_BASE =
  'rounded-full border px-2 py-0.5 text-[10px] font-semibold transition active:scale-95'
const FILTER_BTN_ON = 'border-teal-600 bg-teal-600 text-white'
const FILTER_BTN_OFF = 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100'

function newSliceId(): string {
  return `slice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function clientRectToNormalized(
  left: number,
  top: number,
  width: number,
  height: number,
  containerW: number,
  containerH: number,
): NormalizedRect {
  return {
    x: Math.max(0, Math.min(1, left / containerW)),
    y: Math.max(0, Math.min(1, top / containerH)),
    w: Math.max(0, Math.min(1 - left / containerW, width / containerW)),
    h: Math.max(0, Math.min(1 - top / containerH, height / containerH)),
  }
}

function problemPreviewText(problem: SearchableProblem['problem']): string {
  const text = problem.text?.trim()
  if (text) return text.length > 200 ? `${text.slice(0, 200)}…` : text
  return problem.title
}

export default function MathPdfSliceMatcher({ user }: Props) {
  const grades = gradesInOrder()
  const defaultGrade = grades[grades.length - 1] ?? 2

  const [selectedGrade, setSelectedGrade] = useState(defaultGrade)
  const [selectedLessons, setSelectedLessons] = useState<string[]>(() =>
    lessonsForGrade(defaultGrade),
  )
  const [sourceFilter, setSourceFilter] = useState<Set<string>>(() => new Set())
  const [typeFilter, setTypeFilter] = useState<Set<string>>(() => new Set())
  const [defaultKind, setDefaultKind] = useState<MathImageKind>(() => readPersistedImageKind())
  const [pageUrls, setPageUrls] = useState<string[]>([])
  const [pageMeta, setPageMeta] = useState<PdfPageMeta[]>([])
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfProgress, setPdfProgress] = useState<{
    fileIndex: number
    fileCount: number
    pageInFile: number
    pagesInFile: number
    pageGlobal: number
  } | null>(null)
  const [slices, setSlices] = useState<PdfSlice[]>([])
  const [activeSliceId, setActiveSliceId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [existingImages, setExistingImages] = useState<Map<string, MathProblemImage>>(new Map())
  const [overlapPrompt, setOverlapPrompt] = useState<OverlapPrompt | null>(null)
  const [cloudOverwrite, setCloudOverwrite] = useState<CloudOverwritePrompt | null>(null)
  const [onlyMissingAnalysis, setOnlyMissingAnalysis] = useState(true)

  const pdfInputRef = useRef<HTMLInputElement>(null)
  const drawState = useRef<{
    pageIndex: number
    startX: number
    startY: number
    containerW: number
    containerH: number
  } | null>(null)
  const [draftRect, setDraftRect] = useState<{ pageIndex: number; rect: NormalizedRect } | null>(
    null,
  )

  const gradeLessonIds = useMemo(() => lessonsForGrade(selectedGrade), [selectedGrade])

  const selectedLessonsKey = useMemo(
    () => [...selectedLessons].sort((a, b) => Number(a) - Number(b)).join(','),
    [selectedLessons],
  )

  const sourceFilterKey = useMemo(() => [...sourceFilter].sort().join(','), [sourceFilter])

  const typeFilterKey = useMemo(() => [...typeFilter].sort().join(','), [typeFilter])

  const selectedLessonSet = useMemo(
    () => new Set(selectedLessons),
    [selectedLessonsKey, selectedLessons],
  )

  const sourceBtns = useMemo(
    () => aggregateSourceButtons(selectedLessons),
    [selectedLessonsKey, selectedLessons],
  )

  const typeBtns = useMemo(
    () => aggregateTypeButtons(selectedLessons),
    [selectedLessonsKey, selectedLessons],
  )

  useEffect(() => {
    setSourceFilter(new Set(sourceBtns.map((b) => b.key)))
    setTypeFilter(new Set(typeBtns.map((b) => b.key)))
  }, [selectedLessonsKey, sourceBtns, typeBtns])

  const problemPool = useMemo(() => {
    const raw = buildProblemPool(selectedLessons)
    return filterProblemPool(raw, sourceFilter, typeFilter)
  }, [
    selectedLessonsKey,
    selectedLessons,
    sourceFilterKey,
    typeFilterKey,
    sourceFilter,
    typeFilter,
  ])

  const dbAnalysisIds = useMemo(() => {
    const ids = new Set<string>()
    for (const key of existingImages.keys()) {
      if (key.endsWith(':analysis')) ids.add(key.slice(0, -':analysis'.length))
    }
    return ids
  }, [existingImages])

  const sessionMatchedAnalysisIds = useMemo(() => {
    const ids = new Set<string>()
    for (const slice of slices) {
      if (slice.problemId && slice.imageKind === 'analysis') {
        ids.add(slice.problemId)
      }
    }
    return ids
  }, [slices])

  const searchResults = useMemo(() => {
    const base = searchProblems(problemPool, searchQuery)
    if (!onlyMissingAnalysis) return base
    return base.filter(
      (item) =>
        !problemHasAnalysisImage(item.problem, dbAnalysisIds) &&
        !sessionMatchedAnalysisIds.has(item.problem.id),
    )
  }, [problemPool, searchQuery, onlyMissingAnalysis, dbAnalysisIds, sessionMatchedAnalysisIds])

  const activeSlice = useMemo(
    () => slices.find((s) => s.id === activeSliceId) ?? null,
    [slices, activeSliceId],
  )

  const matchedCount = slices.filter((s) => s.problemId).length
  const allMatched = slices.length > 0 && matchedCount === slices.length
  const canSlice = selectedLessons.length > 0 && pageUrls.length > 0

  const showFlash = useCallback((msg: string) => {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 2600)
  }, [])

  /** Keep default + localStorage in sync so the next划片 inherits the same kind. */
  const applySessionImageKind = useCallback((kind: MathImageKind) => {
    setDefaultKind(kind)
    persistImageKind(kind)
  }, [])

  const setSliceImageKind = useCallback(
    (sliceId: string, kind: MathImageKind) => {
      applySessionImageKind(kind)
      setSlices((prev) =>
        prev.map((s) => (s.id === sliceId ? { ...s, imageKind: kind } : s)),
      )
    },
    [applySessionImageKind],
  )

  useEffect(() => {
    if (selectedLessons.length === 0) {
      setExistingImages(new Map())
      return
    }
    let cancelled = false
    void (async () => {
      const rows = await Promise.all(selectedLessons.map(fetchLessonProblemImages))
      if (cancelled) return
      const map = new Map<string, MathProblemImage>()
      for (const list of rows) {
        for (const row of list) {
          map.set(`${row.problemId}:${row.imageKind}`, row)
        }
      }
      setExistingImages(map)
    })()
    return () => {
      cancelled = true
    }
  }, [selectedLessonsKey, selectedLessons])

  useEffect(() => {
    return () => {
      revokePageUrls(pageUrls)
      for (const s of slices) URL.revokeObjectURL(s.cropUrl)
      if (overlapPrompt) URL.revokeObjectURL(overlapPrompt.newCropUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup on unmount only
  }, [])

  function selectGrade(grade: number) {
    if (grade === selectedGrade) return
    setSelectedGrade(grade)
    setSelectedLessons(lessonsForGrade(grade))
  }

  function toggleLesson(id: string) {
    setSelectedLessons((prev) =>
      prev.includes(id) ? prev.filter((lessonId) => lessonId !== id) : [...prev, id],
    )
  }

  function toggleAllLessonsInGrade() {
    const allOn = gradeLessonIds.every((id) => selectedLessonSet.has(id))
    setSelectedLessons(allOn ? [] : [...gradeLessonIds])
  }

  function toggleFilter(axis: 'source' | 'type', value: string) {
    const setter = axis === 'source' ? setSourceFilter : setTypeFilter
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  function toggleAllFilters(axis: 'source' | 'type') {
    const btns = axis === 'source' ? sourceBtns : typeBtns
    const setter = axis === 'source' ? setSourceFilter : setTypeFilter
    const current = axis === 'source' ? sourceFilter : typeFilter
    const allSelected = btns.length > 0 && btns.every((b) => current.has(b.key))
    setter(allSelected ? new Set() : new Set(btns.map((b) => b.key)))
  }

  async function handlePdfUpload(files: File[]) {
    const pdfs = files.filter((f) => f.name.toLowerCase().endsWith('.pdf'))
    if (pdfs.length === 0) {
      showFlash('请选择 PDF 文件')
      return
    }
    if (pdfs.length < files.length) {
      showFlash(`已忽略 ${files.length - pdfs.length} 个非 PDF 文件`)
    }
    const tooLarge = pdfs.find((f) => f.size > MAX_PDF_MB * 1024 * 1024)
    if (tooLarge) {
      showFlash(`${tooLarge.name} 过大（最大 ${MAX_PDF_MB} MB）`)
      return
    }

    revokePageUrls(pageUrls)
    for (const s of slices) URL.revokeObjectURL(s.cropUrl)
    setPageUrls([])
    setPageMeta([])
    setSlices([])
    setActiveSliceId(null)
    setPdfLoading(true)
    setPdfProgress(null)

    try {
      const { urls, meta } = await renderPdfFilesToPageUrls(pdfs, {
        scale: 2,
        onPageRendered: (info) => setPdfProgress(info),
      })
      setPageUrls(urls)
      setPageMeta(meta)
      showFlash(
        pdfs.length === 1
          ? `已加载 ${urls.length} 页`
          : `已加载 ${pdfs.length} 个 PDF，共 ${urls.length} 页`,
      )
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'PDF 解析失败')
    } finally {
      setPdfLoading(false)
      setPdfProgress(null)
    }
  }

  const finalizeSlice = useCallback(
    async (pageIndex: number, rect: NormalizedRect) => {
      const pageUrl = pageUrls[pageIndex]
      if (!pageUrl) return

      const { blob, url } = await cropImageBlob(pageUrl, rect)

      const overlapping = slices.find(
        (s) => s.pageIndex === pageIndex && s.problemId && rectIoU(s.rect, rect) >= OVERLAP_IOU,
      )

      if (overlapping) {
        setOverlapPrompt({
          newRect: rect,
          pageIndex,
          newCropUrl: url,
          newCropBlob: blob,
          existingSlice: overlapping,
        })
        return
      }

      const slice: PdfSlice = {
        id: newSliceId(),
        pageIndex,
        rect,
        cropUrl: url,
        cropBlob: blob,
        imageKind: defaultKind,
        lessonId: null,
        problemId: null,
      }
      setSlices((prev) => [...prev, slice])
      setActiveSliceId(slice.id)
      setSearchQuery('')
    },
    [pageUrls, slices, defaultKind],
  )

  function confirmOverlapReplace() {
    if (!overlapPrompt) return
    const { existingSlice, newRect, pageIndex, newCropUrl, newCropBlob } = overlapPrompt
    URL.revokeObjectURL(existingSlice.cropUrl)

    const slice: PdfSlice = {
      id: newSliceId(),
      pageIndex,
      rect: newRect,
      cropUrl: newCropUrl,
      cropBlob: newCropBlob,
      imageKind: existingSlice.imageKind,
      lessonId: null,
      problemId: null,
    }

    setSlices((prev) => prev.filter((s) => s.id !== existingSlice.id).concat(slice))
    setActiveSliceId(slice.id)
    setSearchQuery('')
    setOverlapPrompt(null)
  }

  function cancelOverlapReplace() {
    if (overlapPrompt) URL.revokeObjectURL(overlapPrompt.newCropUrl)
    setOverlapPrompt(null)
  }

  function removeSlice(id: string) {
    setSlices((prev) => {
      const target = prev.find((s) => s.id === id)
      if (target) URL.revokeObjectURL(target.cropUrl)
      return prev.filter((s) => s.id !== id)
    })
    if (activeSliceId === id) setActiveSliceId(null)
  }

  function applyMatch(sliceId: string, candidate: SearchableProblem, force = false) {
    const slice = slices.find((s) => s.id === sliceId)
    if (!slice) return

    const key = `${candidate.problem.id}:${slice.imageKind}`
    const existing = existingImages.get(key)
    if (existing && !force) {
      setCloudOverwrite({
        slice,
        candidate,
        existingUrl: getMathImagePublicUrl(existing.storagePath),
      })
      return
    }

    setSlices((prev) =>
      prev.map((s) =>
        s.id === sliceId
          ? {
              ...s,
              lessonId: candidate.lessonId,
              problemId: candidate.problem.id,
            }
          : s,
      ),
    )
    setCloudOverwrite(null)
    showFlash(`已匹配 ${candidate.problem.id}`)
  }

  async function handleSubmit() {
    if (!user || !allMatched) return
    setSubmitting(true)
    let ok = 0
    let fail = 0

    for (const slice of slices) {
      if (!slice.problemId || !slice.lessonId) continue
      const ext = 'png'
      const file = new File([slice.cropBlob], `${slice.problemId}.${ext}`, {
        type: 'image/png',
      })
      const { error } = await uploadMathProblemImage(
        user.id,
        slice.lessonId,
        slice.problemId,
        slice.imageKind,
        file,
      )
      if (error) fail++
      else {
        ok++
        invalidateLessonImageCache(slice.lessonId)
      }
    }

    setSubmitting(false)
    if (fail === 0) {
      showFlash(`全部上传成功（${ok} 张）`)
      revokePageUrls(pageUrls)
      for (const s of slices) URL.revokeObjectURL(s.cropUrl)
      setPageUrls([])
      setPageMeta([])
      setSlices([])
      setActiveSliceId(null)
    } else {
      showFlash(`成功 ${ok}，失败 ${fail}`)
    }
  }

  function onPagePointerDown(e: React.PointerEvent<HTMLDivElement>, pageIndex: number) {
    if (!canSlice || e.button !== 0) return
    const target = e.currentTarget
    const rect = target.getBoundingClientRect()
    drawState.current = {
      pageIndex,
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      containerW: rect.width,
      containerH: rect.height,
    }
    target.setPointerCapture(e.pointerId)
    setDraftRect({
      pageIndex,
      rect: { x: 0, y: 0, w: 0, h: 0 },
    })
  }

  function onPagePointerMove(e: React.PointerEvent<HTMLDivElement>, pageIndex: number) {
    const st = drawState.current
    if (!st || st.pageIndex !== pageIndex) return
    const target = e.currentTarget
    const rect = target.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const left = Math.min(st.startX, x)
    const top = Math.min(st.startY, y)
    const width = Math.abs(x - st.startX)
    const height = Math.abs(y - st.startY)
    setDraftRect({
      pageIndex: st.pageIndex,
      rect: clientRectToNormalized(left, top, width, height, st.containerW, st.containerH),
    })
  }

  function onPagePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const st = drawState.current
    if (!st) return
    drawState.current = null
    setDraftRect(null)

    const target = e.currentTarget
    const rect = target.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const width = Math.abs(x - st.startX)
    const height = Math.abs(y - st.startY)

    if (width < MIN_SLICE_PX || height < MIN_SLICE_PX) return

    const normalized = clientRectToNormalized(
      Math.min(st.startX, x),
      Math.min(st.startY, y),
      width,
      height,
      st.containerW,
      st.containerH,
    )
    void finalizeSlice(st.pageIndex, normalized)
  }

  return (
    <div className="space-y-4">
      {flash && (
        <div className="pointer-events-none fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-full bg-teal-800 px-4 py-2 text-[13px] font-semibold text-white shadow-lg">
          {flash}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr_300px]">
        {/* Left: grade + lessons + filters + upload + slice list */}
        <aside className="space-y-3">
          <section className="rounded-2xl border border-teal-100 bg-white/90 p-3 shadow-sm">
            <div className="mb-2 text-[12px] font-bold text-slate-500">年级（单选）</div>
            <div className="flex flex-wrap gap-1.5">
              {grades.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => selectGrade(grade)}
                  className={clsx(
                    'rounded-lg px-3 py-1.5 text-[11px] font-semibold transition',
                    selectedGrade === grade
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-teal-50 text-teal-800 hover:bg-teal-100',
                  )}
                >
                  {GRADE_LABEL[grade]}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-teal-100 bg-white/90 p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[12px] font-bold text-slate-500">
                {GRADE_LABEL[selectedGrade]}讲次（可多选）
              </div>
              <button
                type="button"
                onClick={toggleAllLessonsInGrade}
                className="text-[10px] font-semibold text-teal-600 hover:text-teal-800"
              >
                {gradeLessonIds.every((id) => selectedLessonSet.has(id)) ? '全不选' : '全选'}
              </button>
            </div>
            <div className="flex max-h-[22vh] flex-wrap gap-1 overflow-y-auto">
              {gradeLessonIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleLesson(id)}
                  className={clsx(
                    'rounded-lg px-2 py-1 text-[11px] font-semibold transition',
                    selectedLessonSet.has(id)
                      ? 'bg-teal-600 text-white'
                      : 'bg-teal-50 text-teal-800 hover:bg-teal-100',
                  )}
                >
                  {lessonDisplayLabel(id, true)}
                </button>
              ))}
            </div>
            {selectedLessons.length === 0 && (
              <p className="mt-2 text-[10px] text-amber-600">请至少选择一个讲次</p>
            )}
          </section>

          <section className="rounded-2xl border border-teal-100 bg-teal-50/40 p-2.5 shadow-sm">
            <div className="mb-2 space-y-2">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-teal-800">📂 来源</span>
                  {sourceBtns.length > 1 && (
                    <button
                      type="button"
                      onClick={() => toggleAllFilters('source')}
                      className="text-[10px] text-teal-600 hover:text-teal-800"
                    >
                      {sourceBtns.every((b) => sourceFilter.has(b.key)) ? '全不选' : '全选'}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {sourceBtns.map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => toggleFilter('source', b.key)}
                      className={clsx(
                        FILTER_BTN_BASE,
                        sourceFilter.has(b.key) ? FILTER_BTN_ON : FILTER_BTN_OFF,
                      )}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-teal-800">🏷️ 题型</span>
                  {typeBtns.length > 1 && (
                    <button
                      type="button"
                      onClick={() => toggleAllFilters('type')}
                      className="text-[10px] text-teal-600 hover:text-teal-800"
                    >
                      {typeBtns.every((b) => typeFilter.has(b.key)) ? '全不选' : '全选'}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {typeBtns.map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => toggleFilter('type', b.key)}
                      className={clsx(
                        FILTER_BTN_BASE,
                        typeFilter.has(b.key) ? FILTER_BTN_ON : FILTER_BTN_OFF,
                      )}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-teal-100 bg-white/90 p-3 shadow-sm">
            <div className="mb-2 text-[12px] font-bold text-slate-500">默认图片类型（新划片沿用）</div>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {(['analysis', 'figure'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    if (activeSliceId) setSliceImageKind(activeSliceId, kind)
                    else applySessionImageKind(kind)
                  }}
                  className={clsx(
                    'flex-1 rounded-lg py-1.5 text-[11px] font-bold transition',
                    defaultKind === kind ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500',
                  )}
                >
                  {MATH_IMAGE_KIND_LABEL[kind]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-teal-700">
              {MATH_IMAGE_KIND_HINT[defaultKind]}。教材原题截图请选「题面图」，手写解析请选「题解图」。
            </p>
          </section>

          <section className="rounded-2xl border border-teal-100 bg-white/90 p-3 shadow-sm">
            <div className="mb-2 text-[12px] font-bold text-slate-500">上传 PDF</div>
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? [])
                e.target.value = ''
                if (picked.length > 0) void handlePdfUpload(picked)
              }}
            />
            <button
              type="button"
              disabled={pdfLoading}
              onClick={() => pdfInputRef.current?.click()}
              className="w-full rounded-xl bg-teal-600 py-2 text-[12px] font-bold text-white disabled:opacity-60"
            >
              {pdfLoading
                ? pdfProgress
                  ? pdfProgress.fileCount > 1
                    ? `解析中 ${pdfProgress.fileIndex}/${pdfProgress.fileCount} · ${pdfProgress.pageInFile}/${pdfProgress.pagesInFile} 页`
                    : `解析中 ${pdfProgress.pageInFile}/${pdfProgress.pagesInFile} 页`
                  : '解析中…'
                : pageUrls.length > 0
                  ? '更换 PDF（可多选）'
                  : '选择 PDF（可多选）'}
            </button>
            {!canSlice && selectedLessons.length > 0 && pageUrls.length === 0 && (
              <p className="mt-2 text-[10px] text-slate-400">上传 PDF 后即可在页面上划片</p>
            )}
            {selectedLessons.length === 0 && (
              <p className="mt-2 text-[10px] text-amber-600">请先选择至少一个讲次</p>
            )}
          </section>

          <section className="rounded-2xl border border-teal-100 bg-white/90 p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[12px] font-bold text-slate-500">划片列表</div>
              <span className="text-[10px] text-slate-400">
                {matchedCount}/{slices.length}
              </span>
            </div>
            {slices.length === 0 ? (
              <p className="py-4 text-center text-[11px] text-slate-400">在 PDF 页面上拖拽框选</p>
            ) : (
              <ul className="max-h-[28vh] space-y-1 overflow-y-auto">
                {slices.map((s, i) => (
                  <li key={s.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setActiveSliceId(s.id)
                        setSearchQuery('')
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setActiveSliceId(s.id)
                          setSearchQuery('')
                        }
                      }}
                      className={clsx(
                        'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition',
                        activeSliceId === s.id
                          ? 'bg-teal-50 ring-1 ring-teal-300'
                          : 'hover:bg-slate-50',
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.cropUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-slate-400">
                          #{i + 1} · 第 {s.pageIndex + 1} 页 · {MATH_IMAGE_KIND_LABEL[s.imageKind]}
                        </div>
                        <div className="truncate font-mono text-[11px] font-bold text-teal-700">
                          {s.problemId ?? '未匹配'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeSlice(s.id)
                        }}
                        className="shrink-0 rounded px-1 text-[10px] text-red-500 hover:bg-red-50"
                      >
                        删
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {slices.length > 0 && (
              <button
                type="button"
                disabled={!allMatched || submitting}
                onClick={() => void handleSubmit()}
                className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-[12px] font-bold text-white disabled:opacity-50"
              >
                {submitting
                  ? '提交中…'
                  : allMatched
                    ? `提交全部（${slices.length} 张）`
                    : `还有 ${slices.length - matchedCount} 个未匹配`}
              </button>
            )}
          </section>
        </aside>

        {/* Center: PDF pages */}
        <section className="rounded-2xl border border-teal-100 bg-white/90 p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[14px] font-extrabold text-slate-800">PDF 预览</h2>
            {pageUrls.length > 0 && (
              <span className="text-[11px] text-slate-400">
                {pageUrls.length} 页 · 拖拽框选区域
              </span>
            )}
          </div>

          {pageUrls.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
              <div className="text-4xl opacity-30">📄</div>
              <p className="text-[13px] text-slate-500">上传 PDF 后在此预览并划片</p>
            </div>
          ) : (
            <div className="max-h-[89vh] space-y-4 overflow-y-auto pr-1">
              {pageUrls.map((url, pageIndex) => {
                const meta = pageMeta[pageIndex]
                return (
                <div key={url} className="relative">
                  <div className="mb-1 text-[10px] font-bold text-slate-400">
                    第 {pageIndex + 1} 页
                    {meta && (
                      <span className="font-normal text-slate-400">
                        {' '}
                        · {meta.fileName} 第 {meta.pageInFile} 页
                      </span>
                    )}
                  </div>
                  <div
                    data-page-index={pageIndex}
                    className={clsx(
                      'relative overflow-hidden rounded-lg border border-slate-200 select-none',
                      canSlice ? 'cursor-crosshair' : 'cursor-not-allowed opacity-80',
                    )}
                    onPointerDown={(e) => onPagePointerDown(e, pageIndex)}
                    onPointerMove={(e) => onPagePointerMove(e, pageIndex)}
                    onPointerUp={onPagePointerUp}
                    onPointerCancel={onPagePointerUp}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`PDF 第 ${pageIndex + 1} 页`}
                      className="block w-full"
                      draggable={false}
                    />

                    {slices
                      .filter((s) => s.pageIndex === pageIndex)
                      .map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveSliceId(s.id)
                            setSearchQuery('')
                          }}
                          className={clsx(
                            'absolute border-2 transition',
                            activeSliceId === s.id
                              ? 'border-teal-500 bg-teal-400/20'
                              : s.problemId
                                ? 'border-emerald-500 bg-emerald-400/15'
                                : 'border-amber-500 bg-amber-400/15',
                          )}
                          style={{
                            left: `${s.rect.x * 100}%`,
                            top: `${s.rect.y * 100}%`,
                            width: `${s.rect.w * 100}%`,
                            height: `${s.rect.h * 100}%`,
                          }}
                          title={s.problemId ?? '未匹配'}
                        >
                          {s.problemId && (
                            <span className="absolute -top-5 left-0 rounded bg-emerald-600 px-1 py-0.5 font-mono text-[9px] text-white">
                              {s.problemId}
                            </span>
                          )}
                        </button>
                      ))}

                    {draftRect?.pageIndex === pageIndex && (
                      <div
                        className="pointer-events-none absolute border-2 border-dashed border-teal-500 bg-teal-300/20"
                        style={{
                          left: `${draftRect.rect.x * 100}%`,
                          top: `${draftRect.rect.y * 100}%`,
                          width: `${draftRect.rect.w * 100}%`,
                          height: `${draftRect.rect.h * 100}%`,
                        }}
                      />
                    )}
                  </div>
                </div>
              )})}
            </div>
          )}
        </section>

        {/* Right: match panel */}
        <aside className="rounded-2xl border border-teal-100 bg-white/90 p-3 shadow-sm">
          {!activeSlice ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
              <div className="text-3xl opacity-40">✂️</div>
              <p className="text-[12px] text-slate-500">框选区域后在此匹配题目</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-[11px] font-bold text-slate-500">当前划片</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeSlice.cropUrl}
                  alt="划片预览"
                  className="w-full rounded-lg border border-slate-200 object-contain"
                />
              </div>

              <div>
                <div className="mb-1 text-[11px] font-bold text-slate-500">图片类型</div>
                <p className="mb-1.5 text-[10px] leading-relaxed text-teal-700">
                  {MATH_IMAGE_KIND_HINT[activeSlice.imageKind]}
                </p>
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                  {(['analysis', 'figure'] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setSliceImageKind(activeSlice.id, kind)}
                      className={clsx(
                        'flex-1 rounded-lg py-1.5 text-[11px] font-bold transition',
                        activeSlice.imageKind === kind
                          ? 'bg-white text-teal-800 shadow-sm'
                          : 'text-slate-500',
                      )}
                    >
                      {MATH_IMAGE_KIND_LABEL[kind]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-[11px] font-bold text-slate-500">
                    搜索题目
                    <span className="ml-1.5 font-normal text-slate-400">
                      （{searchResults.length}
                      {onlyMissingAnalysis ? ` / ${problemPool.length}` : ''} 题）
                    </span>
                  </div>
                  <label className="flex cursor-pointer items-center gap-1 text-[10px] text-slate-500">
                    <input
                      type="checkbox"
                      checked={onlyMissingAnalysis}
                      onChange={(e) => setOnlyMissingAnalysis(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    仅无题解图
                  </label>
                </div>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="题号 / 标题 / 题干模糊搜索…"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[12px] outline-none focus:border-teal-400"
                />
              </div>

              <ul
                key={`${selectedLessonsKey}:${sourceFilterKey}:${typeFilterKey}`}
                className="max-h-[32vh] space-y-1 overflow-y-auto"
              >
                {searchResults.length === 0 ? (
                  <li className="py-6 text-center text-[11px] text-slate-400">
                    {problemPool.length === 0
                      ? '请先选择讲次'
                      : onlyMissingAnalysis
                        ? '暂无待补题解图的题目'
                        : '无匹配题目，试试其他关键词'}
                  </li>
                ) : (
                  searchResults.map((item) => {
                    const matched = activeSlice.problemId === item.problem.id
                    const hasAnalysis = problemHasAnalysisImage(item.problem, dbAnalysisIds)
                    return (
                      <li key={`${item.lessonId}-${item.problem.id}`}>
                        <button
                          type="button"
                          onClick={() => applyMatch(activeSlice.id, item)}
                          className={clsx(
                            'w-full rounded-xl px-2.5 py-2 text-left transition',
                            matched ? 'bg-teal-50 ring-1 ring-teal-300' : 'hover:bg-slate-50',
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="font-mono text-[10px] font-bold text-teal-700">
                              {item.problem.id}
                            </span>
                            <span className="rounded bg-slate-100 px-1 text-[9px] text-slate-500">
                              {item.lessonTitle} · {item.sectionLabel}
                            </span>
                            <AnalysisGuideBadge hasImage={hasAnalysis} showMissing size="sm" />
                          </div>
                          <div className="line-clamp-2 text-[11px] text-slate-700">
                            {item.problem.title}
                          </div>
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>

              {activeSlice.problemId && (
                <ComparisonPanel
                  slice={activeSlice}
                  pool={problemPool}
                  existingImages={existingImages}
                  onClear={() =>
                    setSlices((prev) =>
                      prev.map((s) =>
                        s.id === activeSlice.id ? { ...s, problemId: null, lessonId: null } : s,
                      ),
                    )
                  }
                />
              )}
            </div>
          )}
        </aside>
      </div>

      {overlapPrompt && (
        <OverlapDialog
          prompt={overlapPrompt}
          onConfirm={confirmOverlapReplace}
          onCancel={cancelOverlapReplace}
        />
      )}

      {cloudOverwrite && (
        <CloudOverwriteDialog
          prompt={cloudOverwrite}
          onConfirm={() => applyMatch(cloudOverwrite.slice.id, cloudOverwrite.candidate, true)}
          onCancel={() => setCloudOverwrite(null)}
        />
      )}
    </div>
  )
}

function ComparisonPanel({
  slice,
  pool,
  existingImages,
  onClear,
}: {
  slice: PdfSlice
  pool: SearchableProblem[]
  existingImages: Map<string, MathProblemImage>
  onClear: () => void
}) {
  const item = pool.find((p) => p.problem.id === slice.problemId)
  if (!item) return null

  const cloudKey = `${slice.problemId}:${slice.imageKind}`
  const cloudRow = existingImages.get(cloudKey)
  const cloudUrl = cloudRow ? getMathImagePublicUrl(cloudRow.storagePath) : null
  const staticImg = item.problem.analysisImg

  return (
    <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold text-teal-800">比对</span>
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] text-red-500 hover:underline"
        >
          取消匹配
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="mb-1 text-[10px] font-semibold text-slate-500">划片</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slice.cropUrl} alt="划片" className="max-h-28 w-full rounded object-contain" />
        </div>
        <div>
          <div className="mb-1 text-[10px] font-semibold text-slate-500">题目</div>
          <div className="max-h-28 overflow-y-auto rounded bg-white p-1.5 text-[10px] leading-relaxed text-slate-700">
            <div className="font-mono font-bold text-teal-700">{item.problem.id}</div>
            <div className="font-semibold">{item.problem.title}</div>
            <div className="mt-1 whitespace-pre-wrap">{problemPreviewText(item.problem)}</div>
          </div>
        </div>
      </div>
      {(cloudUrl || (slice.imageKind === 'analysis' && staticImg)) && (
        <div className="mt-2 border-t border-teal-100 pt-2">
          <div className="mb-1 text-[10px] font-semibold text-amber-700">
            线上已有图片（提交将覆盖）
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cloudUrl ?? staticImg ?? ''}
            alt="已有"
            className="max-h-24 w-full rounded object-contain opacity-80"
          />
        </div>
      )}
    </div>
  )
}

function OverlapDialog({
  prompt,
  onConfirm,
  onCancel,
}: {
  prompt: OverlapPrompt
  onConfirm: () => void
  onCancel: () => void
}) {
  const { existingSlice, newCropUrl } = prompt
  const lessonId = existingSlice.lessonId ?? lessonIdFromProblemId(existingSlice.problemId ?? '')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
    >
      <div className="max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="mb-1 text-[15px] font-extrabold text-slate-800">区域重叠 — 是否覆盖？</h3>
        <p className="mb-4 text-[12px] text-slate-500">
          新划片与已匹配题目{' '}
          <span className="font-mono font-bold text-teal-700">{existingSlice.problemId}</span>{' '}
          的区域重叠，覆盖后将清除原匹配。
        </p>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 text-[11px] font-bold text-slate-500">覆盖前</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={existingSlice.cropUrl}
              alt="原划片"
              className="w-full rounded-lg border border-slate-200 object-contain"
            />
            <div className="mt-1 text-center font-mono text-[10px] text-teal-700">
              {existingSlice.problemId} · 第 {lessonId} 讲
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-bold text-slate-500">覆盖后（新划片）</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={newCropUrl}
              alt="新划片"
              className="w-full rounded-lg border border-teal-300 object-contain"
            />
            <div className="mt-1 text-center text-[10px] text-slate-400">需重新匹配题目</div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-600"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-teal-600 px-4 py-2 text-[12px] font-bold text-white"
          >
            覆盖并重新匹配
          </button>
        </div>
      </div>
    </div>
  )
}

function CloudOverwriteDialog({
  prompt,
  onConfirm,
  onCancel,
}: {
  prompt: CloudOverwritePrompt
  onConfirm: () => void
  onCancel: () => void
}) {
  const { slice, candidate, existingUrl } = prompt
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
    >
      <div className="max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="mb-1 text-[15px] font-extrabold text-slate-800">
          题目已有图片 — 是否覆盖？
        </h3>
        <p className="mb-4 text-[12px] text-slate-500">
          <span className="font-mono font-bold text-teal-700">{candidate.problem.id}</span> 的
          {MATH_IMAGE_KIND_LABEL[slice.imageKind]}已存在，提交后将替换。
        </p>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 text-[11px] font-bold text-slate-500">线上现有</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={existingUrl}
              alt="现有"
              className="w-full rounded-lg border border-slate-200 object-contain"
            />
          </div>
          <div>
            <div className="mb-1 text-[11px] font-bold text-slate-500">新划片</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slice.cropUrl}
              alt="新划片"
              className="w-full rounded-lg border border-teal-300 object-contain"
            />
          </div>
        </div>
        <div className="mb-3 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
          <div className="font-semibold">{candidate.problem.title}</div>
          <div className="mt-1 line-clamp-3">{problemPreviewText(candidate.problem)}</div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-600"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-teal-600 px-4 py-2 text-[12px] font-bold text-white"
          >
            确认匹配
          </button>
        </div>
      </div>
    </div>
  )
}
