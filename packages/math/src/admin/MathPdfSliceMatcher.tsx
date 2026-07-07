'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import clsx from 'clsx'
import {
  PDF_SLICE_KIND_LABEL,
  PDF_SLICE_KIND_HINT,
  PDF_SLICE_KINDS,
  readPersistedPdfSliceKind,
  persistPdfSliceKind,
  isProblemBoundSliceKind,
  lessonSummaryProblemId,
  type PdfSliceKind,
} from '@rosie/math/constants'
import { SEA_LESSONS } from '@rosie/math/utils/sea-data'
import { cropImageBlob, rectIoU, type NormalizedRect } from '@rosie/math/utils/crop-image-blob'
import { revokePageUrls, type PdfPageMeta } from '@rosie/math/utils/math-pdf'
import {
  isPdfMaterialFile,
  isRasterImageMaterialFile,
  loadMaterialFilesToPageUrls,
} from '@rosie/math/utils/math-material'
import { submitArchivedPaperScratchDraft } from '@rosie/math/utils/paper-scratch'
import {
  buildProblemPool,
  filterProblemPool,
  searchProblems,
  type SearchableProblem,
} from '@rosie/math/utils/math-problem-search'
import { lessonDisplayLabel } from '@rosie/math/utils/lesson-grade'
import MathLessonFilterPanel from '@rosie/math/admin/MathLessonFilterPanel'
import { useMathLessonFilter } from '@rosie/math/admin/useMathLessonFilter'
import { problemHasAnalysisImage } from '@rosie/math/utils/problem-analysis-image'
import AnalysisGuideBadge from '@rosie/math/components/shared/AnalysisGuideBadge'
import {
  fetchLessonProblemImages,
  getMathImagePublicUrl,
  uploadMathProblemImage,
  uploadProblemNoteContentImage,
  uploadLessonSummaryContentImage,
  invalidateLessonImageCache,
  type MathProblemImage,
} from '@rosie/math/hooks/useMathProblemImages'
import {
  createMathProblemNote,
  loadLessonNotes,
  notesForProblem,
  updateMathProblemNote,
  invalidateLessonNotesCache,
  type MathProblemNote,
} from '@rosie/math/hooks/useMathProblemNotes'
import { appendRichInlineImage, richInlineImageHtml, sanitizeRichHtml } from '@rosie/math/utils/sanitize-summary-html'

type Props = { user: User; lessonFilter: ReturnType<typeof useMathLessonFilter> }

type PdfSlice = {
  id: string
  pageIndex: number
  rect: NormalizedRect
  cropUrl: string
  cropBlob: Blob
  sliceKind: PdfSliceKind
  lessonId: string | null
  problemId: string | null
  /** Required before submit when `sliceKind === 'draft'`. */
  draftCorrect: boolean | null
}

type SearchableLesson = {
  lessonId: string
  title: string
  displayLabel: string
}

type CloudOverwritePrompt = {
  slice: PdfSlice
  candidate: SearchableProblem | null
  lesson: SearchableLesson | null
  existingUrl: string | null
  existingNotePreview: string | null
}

const MIN_SLICE_PX = 24
const OVERLAP_IOU = 0.25
const MAX_PDF_MB = 40

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

type OverlapPrompt = {
  newRect: NormalizedRect
  pageIndex: number
  newCropUrl: string
  newCropBlob: Blob
  existingSlice: PdfSlice
}

function sliceMatchLabel(slice: PdfSlice, lessonTitle?: string): string {
  if (slice.sliceKind === 'summary') {
    return lessonTitle ?? (slice.lessonId ? `第 ${slice.lessonId} 讲` : '未匹配')
  }
  return slice.problemId ?? '未匹配'
}

function sliceIsMatched(slice: PdfSlice): boolean {
  if (slice.sliceKind === 'summary') return Boolean(slice.lessonId)
  return Boolean(slice.problemId && slice.lessonId)
}

function draftSlicesFullyMarked(slices: PdfSlice[]): boolean {
  return slices.every((s) => s.sliceKind !== 'draft' || s.draftCorrect !== null)
}

function problemPreviewText(problem: SearchableProblem['problem']): string {
  const text = problem.text?.trim()
  if (text) return text.length > 200 ? `${text.slice(0, 200)}…` : text
  return problem.title
}

export default function MathPdfSliceMatcher({ user, lessonFilter }: Props) {
  const {
    grades,
    selectedGrade,
    selectedLessons,
    selectedLessonsKey,
    selectedLessonSet,
    gradeLessonIds,
    sourceFilter,
    typeFilter,
    sourceFilterKey,
    typeFilterKey,
    selectGrade,
    toggleLesson,
    toggleAllLessonsInGrade,
    toggleFilter,
    toggleAllFilters,
  } = lessonFilter

  const [defaultKind, setDefaultKind] = useState<PdfSliceKind>(() => readPersistedPdfSliceKind())
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
  const [existingNotes, setExistingNotes] = useState<Map<string, MathProblemNote[]>>(new Map())
  const [overlapPrompt, setOverlapPrompt] = useState<OverlapPrompt | null>(null)
  const [cloudOverwrite, setCloudOverwrite] = useState<CloudOverwritePrompt | null>(null)
  const [onlyMissingAnalysis, setOnlyMissingAnalysis] = useState(true)

  const materialInputRef = useRef<HTMLInputElement>(null)
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

  const lessonPool = useMemo((): SearchableLesson[] => {
    const q = searchQuery.trim().toLowerCase()
    return selectedLessons
      .map((id) => {
        const meta = SEA_LESSONS.find((l) => l.id === id)
        if (!meta) return null
        return {
          lessonId: meta.id,
          title: meta.title,
          displayLabel: lessonDisplayLabel(meta.id, false),
        }
      })
      .filter((item): item is SearchableLesson => item !== null)
      .filter((item) => {
        if (!q) return true
        return (
          item.lessonId.includes(q) ||
          item.title.toLowerCase().includes(q) ||
          item.displayLabel.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => Number(a.lessonId) - Number(b.lessonId))
  }, [selectedLessonsKey, selectedLessons, searchQuery])

  const sessionMatchedAnalysisIds = useMemo(() => {
    const ids = new Set<string>()
    for (const slice of slices) {
      if (slice.problemId && slice.sliceKind === 'analysis') {
        ids.add(slice.problemId)
      }
    }
    return ids
  }, [slices])

  const activeSlice = useMemo(
    () => slices.find((s) => s.id === activeSliceId) ?? null,
    [slices, activeSliceId],
  )

  const searchResults = useMemo(() => {
    const base = searchProblems(problemPool, searchQuery)
    if (!onlyMissingAnalysis || activeSlice?.sliceKind !== 'analysis') return base
    return base.filter(
      (item) =>
        !problemHasAnalysisImage(item.problem, dbAnalysisIds) &&
        !sessionMatchedAnalysisIds.has(item.problem.id),
    )
  }, [
    problemPool,
    searchQuery,
    onlyMissingAnalysis,
    activeSlice?.sliceKind,
    dbAnalysisIds,
    sessionMatchedAnalysisIds,
  ])

  const matchedCount = slices.filter((s) => sliceIsMatched(s)).length
  const allMatched = slices.length > 0 && matchedCount === slices.length
  const draftsMarked = draftSlicesFullyMarked(slices)
  const canSubmit = allMatched && draftsMarked
  const canSlice = selectedLessons.length > 0 && pageUrls.length > 0
  const activeIsSummary = activeSlice?.sliceKind === 'summary'

  const showFlash = useCallback((msg: string) => {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 2600)
  }, [])

  /** Keep default + localStorage in sync so the next划片 inherits the same kind. */
  const applySessionSliceKind = useCallback((kind: PdfSliceKind) => {
    setDefaultKind(kind)
    persistPdfSliceKind(kind)
  }, [])

  const setSliceKind = useCallback(
    (sliceId: string, kind: PdfSliceKind) => {
      applySessionSliceKind(kind)
      setSlices((prev) =>
        prev.map((s) => {
          if (s.id !== sliceId) return s
          const crossingSummaryBoundary =
            (kind === 'summary' && s.sliceKind !== 'summary') ||
            (kind !== 'summary' && s.sliceKind === 'summary')
          if (crossingSummaryBoundary) {
            return {
              ...s,
              sliceKind: kind,
              lessonId: null,
              problemId: null,
              draftCorrect: kind === 'draft' ? null : s.draftCorrect,
            }
          }
          if (kind === 'summary' && s.lessonId) {
            return {
              ...s,
              sliceKind: kind,
              problemId: lessonSummaryProblemId(s.lessonId),
              draftCorrect: null,
            }
          }
          return {
            ...s,
            sliceKind: kind,
            draftCorrect: kind === 'draft' ? (s.sliceKind === 'draft' ? s.draftCorrect : null) : null,
          }
        }),
      )
    },
    [applySessionSliceKind],
  )

  const setDraftSliceCorrect = useCallback((sliceId: string, correct: boolean) => {
    setSlices((prev) =>
      prev.map((s) => (s.id === sliceId ? { ...s, draftCorrect: correct } : s)),
    )
  }, [])

  useEffect(() => {
    if (selectedLessons.length === 0) {
      setExistingImages(new Map())
      setExistingNotes(new Map())
      return
    }
    let cancelled = false
    void (async () => {
      const [imageRows, noteRows] = await Promise.all([
        Promise.all(selectedLessons.map(fetchLessonProblemImages)),
        Promise.all(selectedLessons.map(loadLessonNotes)),
      ])
      if (cancelled) return
      const imageMap = new Map<string, MathProblemImage>()
      for (const list of imageRows) {
        for (const row of list) {
          imageMap.set(`${row.problemId}:${row.imageKind}`, row)
        }
      }
      const noteMap = new Map<string, MathProblemNote[]>()
      for (const list of noteRows) {
        for (const note of list) {
          const arr = noteMap.get(note.problemId) ?? []
          arr.push(note)
          noteMap.set(note.problemId, arr)
        }
      }
      setExistingImages(imageMap)
      setExistingNotes(noteMap)
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

  async function handleMaterialUpload(files: File[]) {
    const supported = files.filter((f) => isPdfMaterialFile(f) || isRasterImageMaterialFile(f))
    if (supported.length === 0) {
      showFlash('请选择 PDF 或图片文件')
      return
    }
    if (supported.length < files.length) {
      showFlash(`已忽略 ${files.length - supported.length} 个不支持的文件`)
    }
    const pdfs = supported.filter(isPdfMaterialFile)
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
      const { urls, meta } = await loadMaterialFilesToPageUrls(supported, {
        scale: 2,
        onPageRendered: (info) => setPdfProgress(info),
      })
      setPageUrls(urls)
      setPageMeta(meta)
      const pdfCount = pdfs.length
      const imageCount = supported.length - pdfCount
      showFlash(
        pdfCount > 0 && imageCount > 0
          ? `已加载 ${pdfCount} 个 PDF + ${imageCount} 张图片，共 ${urls.length} 页`
          : pdfCount > 0
            ? pdfCount === 1
              ? `已加载 PDF，共 ${urls.length} 页`
              : `已加载 ${pdfCount} 个 PDF，共 ${urls.length} 页`
            : `已加载 ${imageCount} 张图片`,
      )
    } catch (err) {
      showFlash(err instanceof Error ? err.message : '素材加载失败')
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
        (s) =>
          s.pageIndex === pageIndex && sliceIsMatched(s) && rectIoU(s.rect, rect) >= OVERLAP_IOU,
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
        sliceKind: defaultKind,
        lessonId: null,
        problemId: null,
        draftCorrect: defaultKind === 'draft' ? null : null,
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
      sliceKind: existingSlice.sliceKind,
      lessonId: null,
      problemId: null,
      draftCorrect: existingSlice.sliceKind === 'draft' ? null : null,
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

  function applyProblemMatch(sliceId: string, candidate: SearchableProblem, force = false) {
    const slice = slices.find((s) => s.id === sliceId)
    if (!slice || !isProblemBoundSliceKind(slice.sliceKind)) return

    if (slice.sliceKind === 'analysis' || slice.sliceKind === 'figure') {
      const key = `${candidate.problem.id}:${slice.sliceKind}`
      const existing = existingImages.get(key)
      if (existing && !force) {
        setCloudOverwrite({
          slice,
          candidate,
          lesson: null,
          existingUrl: getMathImagePublicUrl(existing.storagePath),
          existingNotePreview: null,
        })
        return
      }
    } else if (slice.sliceKind === 'note') {
      const existing = existingNotes.get(candidate.problem.id)
      if (existing && existing.length > 0 && !force) {
        setCloudOverwrite({
          slice,
          candidate,
          lesson: null,
          existingUrl: null,
          existingNotePreview: existing[existing.length - 1]!.bodyHtml,
        })
        return
      }
    } else if (slice.sliceKind === 'draft') {
      // Paper draft archives append-only; no overwrite prompt.
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

  function applyLessonMatch(sliceId: string, lesson: SearchableLesson, force = false) {
    const slice = slices.find((s) => s.id === sliceId)
    if (!slice || slice.sliceKind !== 'summary') return

    const summaryId = lessonSummaryProblemId(lesson.lessonId)
    const existing = existingNotes.get(summaryId)?.[0]
    if (existing && !force) {
      setCloudOverwrite({
        slice,
        candidate: null,
        lesson,
        existingUrl: null,
        existingNotePreview: existing.bodyHtml,
      })
      return
    }

    setSlices((prev) =>
      prev.map((s) =>
        s.id === sliceId
          ? {
              ...s,
              lessonId: lesson.lessonId,
              problemId: summaryId,
            }
          : s,
      ),
    )
    setCloudOverwrite(null)
    showFlash(`已匹配 ${lesson.displayLabel} · ${lesson.title}`)
  }

  async function handleSubmit() {
    if (!user || !canSubmit) return
    if (!draftSlicesFullyMarked(slices)) {
      showFlash('请为每条草稿划片标记做对或做错')
      return
    }
    setSubmitting(true)
    let ok = 0
    let fail = 0

    for (const slice of slices) {
      if (!sliceIsMatched(slice) || !slice.lessonId) continue

      let error: string | null = null

      if (slice.sliceKind === 'analysis' || slice.sliceKind === 'figure') {
        if (!slice.problemId) continue
        const file = new File([slice.cropBlob], `${slice.problemId}.png`, { type: 'image/png' })
        const result = await uploadMathProblemImage(
          user.id,
          slice.lessonId,
          slice.problemId,
          slice.sliceKind,
          file,
        )
        error = result.error
        if (!error) invalidateLessonImageCache(slice.lessonId)
      } else if (slice.sliceKind === 'note') {
        if (!slice.problemId) continue
        error = await submitNoteSlice(user.id, slice.lessonId, slice.problemId, slice.cropBlob)
      } else if (slice.sliceKind === 'draft') {
        if (!slice.problemId || slice.draftCorrect === null) continue
        const result = await submitArchivedPaperScratchDraft({
          userId: user.id,
          problemId: slice.problemId,
          blob: slice.cropBlob,
          correct: slice.draftCorrect,
          section: 'paper',
        })
        error = result.error
      } else if (slice.sliceKind === 'summary') {
        error = await submitSummarySlice(user.id, slice.lessonId, slice.cropBlob)
      }

      if (error) fail++
      else ok++
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
      invalidateLessonNotesCache()
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
            onToggleLesson={toggleLesson}
            onToggleAllLessons={toggleAllLessonsInGrade}
            onToggleFilter={toggleFilter}
            onToggleAllFilters={toggleAllFilters}
          />

          <section className="rounded-2xl border border-teal-100 bg-white/90 p-3 shadow-sm">
            <div className="mb-2 text-[12px] font-bold text-slate-500">默认类型（新划片沿用）</div>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
              {PDF_SLICE_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    if (activeSliceId) setSliceKind(activeSliceId, kind)
                    else applySessionSliceKind(kind)
                  }}
                  className={clsx(
                    'rounded-lg py-1.5 text-[11px] font-bold transition',
                    defaultKind === kind ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500',
                  )}
                >
                  {PDF_SLICE_KIND_LABEL[kind]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-teal-700">
              {PDF_SLICE_KIND_HINT[defaultKind]}
              {defaultKind === 'figure' || defaultKind === 'analysis'
                ? '。教材原题截图请选「题面图」，手写解析请选「题解图」。'
                : defaultKind === 'draft'
                  ? '。补录纸上练习时选「草稿」，匹配题目后须标记做对/做错。'
                  : null}
            </p>
          </section>

          <section className="rounded-2xl border border-teal-100 bg-white/90 p-3 shadow-sm">
            <div className="mb-2 text-[12px] font-bold text-slate-500">上传素材</div>
            <input
              ref={materialInputRef}
              type="file"
              accept="application/pdf,image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? [])
                e.target.value = ''
                if (picked.length > 0) void handleMaterialUpload(picked)
              }}
            />
            <button
              type="button"
              disabled={pdfLoading}
              onClick={() => materialInputRef.current?.click()}
              className="w-full rounded-xl bg-teal-600 py-2 text-[12px] font-bold text-white disabled:opacity-60"
            >
              {pdfLoading
                ? pdfProgress
                  ? pdfProgress.fileCount > 1
                    ? `解析中 ${pdfProgress.fileIndex}/${pdfProgress.fileCount} · ${pdfProgress.pageInFile}/${pdfProgress.pagesInFile} 页`
                    : `解析中 ${pdfProgress.pageInFile}/${pdfProgress.pagesInFile} 页`
                  : '解析中…'
                : pageUrls.length > 0
                  ? '更换素材（PDF / 图片）'
                  : '选择 PDF 或图片（可多选）'}
            </button>
            {!canSlice && selectedLessons.length > 0 && pageUrls.length === 0 && (
              <p className="mt-2 text-[10px] text-slate-400">上传 PDF 或图片后即可划片</p>
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
              <p className="py-4 text-center text-[11px] text-slate-400">在素材页面上拖拽框选</p>
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
                          #{i + 1} · 第 {s.pageIndex + 1} 页 · {PDF_SLICE_KIND_LABEL[s.sliceKind]}
                        </div>
                        <div className="truncate text-[11px] font-bold text-teal-700">
                          {sliceMatchLabel(
                            s,
                            s.lessonId
                              ? SEA_LESSONS.find((l) => l.id === s.lessonId)?.title
                              : undefined,
                          )}
                        </div>
                        {s.sliceKind === 'draft' && (
                          <div className="mt-1 flex gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDraftSliceCorrect(s.id, true)
                              }}
                              className={clsx(
                                'rounded px-1.5 py-0.5 text-[9px] font-bold',
                                s.draftCorrect === true
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-100 text-slate-500',
                              )}
                            >
                              做对
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDraftSliceCorrect(s.id, false)
                              }}
                              className={clsx(
                                'rounded px-1.5 py-0.5 text-[9px] font-bold',
                                s.draftCorrect === false
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-slate-100 text-slate-500',
                              )}
                            >
                              做错
                            </button>
                          </div>
                        )}
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
                disabled={!canSubmit || submitting}
                onClick={() => void handleSubmit()}
                className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-[12px] font-bold text-white disabled:opacity-50"
              >
                {submitting
                  ? '提交中…'
                  : canSubmit
                    ? `提交全部（${slices.length} 张）`
                    : allMatched
                      ? '请标记每条草稿的对错'
                      : `还有 ${slices.length - matchedCount} 个未匹配`}
              </button>
            )}
          </section>
        </div>

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
                              : sliceIsMatched(s)
                                ? 'border-emerald-500 bg-emerald-400/15'
                                : 'border-amber-500 bg-amber-400/15',
                          )}
                          style={{
                            left: `${s.rect.x * 100}%`,
                            top: `${s.rect.y * 100}%`,
                            width: `${s.rect.w * 100}%`,
                            height: `${s.rect.h * 100}%`,
                          }}
                          title={sliceMatchLabel(
                            s,
                            s.lessonId
                              ? SEA_LESSONS.find((l) => l.id === s.lessonId)?.title
                              : undefined,
                          )}
                        >
                          {sliceIsMatched(s) && (
                            <span className="absolute -top-5 left-0 max-w-[120px] truncate rounded bg-emerald-600 px-1 py-0.5 text-[9px] text-white">
                              {sliceMatchLabel(
                                s,
                                s.lessonId
                                  ? SEA_LESSONS.find((l) => l.id === s.lessonId)?.title
                                  : undefined,
                              )}
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
              <p className="text-[12px] text-slate-500">
                框选区域后在此匹配{activeIsSummary ? '讲次' : '题目'}
              </p>
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
                <div className="mb-1 text-[11px] font-bold text-slate-500">类型</div>
                <p className="mb-1.5 text-[10px] leading-relaxed text-teal-700">
                  {PDF_SLICE_KIND_HINT[activeSlice.sliceKind]}
                </p>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
                  {PDF_SLICE_KINDS.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setSliceKind(activeSlice.id, kind)}
                      className={clsx(
                        'rounded-lg py-1.5 text-[11px] font-bold transition',
                        activeSlice.sliceKind === kind
                          ? 'bg-white text-teal-800 shadow-sm'
                          : 'text-slate-500',
                      )}
                    >
                      {PDF_SLICE_KIND_LABEL[kind]}
                    </button>
                  ))}
                </div>
              </div>

              {activeSlice.sliceKind === 'draft' && (
                <div>
                  <div className="mb-1 text-[11px] font-bold text-slate-500">练习结果（必填）</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDraftSliceCorrect(activeSlice.id, true)}
                      className={clsx(
                        'rounded-xl border py-2.5 text-[12px] font-bold transition',
                        activeSlice.draftCorrect === true
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-white text-slate-500',
                      )}
                    >
                      ✅ 做对了
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftSliceCorrect(activeSlice.id, false)}
                      className={clsx(
                        'rounded-xl border py-2.5 text-[12px] font-bold transition',
                        activeSlice.draftCorrect === false
                          ? 'border-rose-300 bg-rose-50 text-rose-800'
                          : 'border-slate-200 bg-white text-slate-500',
                      )}
                    >
                      ❌ 做错了
                    </button>
                  </div>
                </div>
              )}

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-[11px] font-bold text-slate-500">
                    {activeIsSummary ? '选择讲次' : '搜索题目'}
                    <span className="ml-1.5 font-normal text-slate-400">
                      （
                      {activeIsSummary ? lessonPool.length : searchResults.length}
                      {!activeIsSummary && onlyMissingAnalysis && activeSlice.sliceKind === 'analysis'
                        ? ` / ${problemPool.length}`
                        : ''}
                      {activeIsSummary ? ' 讲' : ' 题'}）
                    </span>
                  </div>
                  {!activeIsSummary && activeSlice.sliceKind === 'analysis' && (
                    <label className="flex cursor-pointer items-center gap-1 text-[10px] text-slate-500">
                      <input
                        type="checkbox"
                        checked={onlyMissingAnalysis}
                        onChange={(e) => setOnlyMissingAnalysis(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      仅无题解图
                    </label>
                  )}
                </div>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeIsSummary ? '讲次号 / 标题搜索…' : '题号 / 标题 / 题干模糊搜索…'
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[12px] outline-none focus:border-teal-400"
                />
              </div>

              {activeIsSummary ? (
                <ul
                  key={selectedLessonsKey}
                  className="max-h-[32vh] space-y-1 overflow-y-auto"
                >
                  {lessonPool.length === 0 ? (
                    <li className="py-6 text-center text-[11px] text-slate-400">
                      {selectedLessons.length === 0 ? '请先选择讲次' : '无匹配讲次，试试其他关键词'}
                    </li>
                  ) : (
                    lessonPool.map((lesson) => {
                      const matched = activeSlice.lessonId === lesson.lessonId
                      const hasSummary = Boolean(
                        existingNotes.get(lessonSummaryProblemId(lesson.lessonId))?.[0],
                      )
                      return (
                        <li key={lesson.lessonId}>
                          <button
                            type="button"
                            onClick={() => applyLessonMatch(activeSlice.id, lesson)}
                            className={clsx(
                              'w-full rounded-xl px-2.5 py-2 text-left transition',
                              matched ? 'bg-teal-50 ring-1 ring-teal-300' : 'hover:bg-slate-50',
                            )}
                          >
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-[10px] font-bold text-teal-700">
                                {lesson.displayLabel}
                              </span>
                              {hasSummary && (
                                <span className="rounded bg-violet-100 px-1 text-[9px] text-violet-700">
                                  已有总结
                                </span>
                              )}
                            </div>
                            <div className="line-clamp-2 text-[11px] text-slate-700">{lesson.title}</div>
                          </button>
                        </li>
                      )
                    })
                  )}
                </ul>
              ) : (
                <ul
                  key={`${selectedLessonsKey}:${sourceFilterKey}:${typeFilterKey}`}
                  className="max-h-[32vh] space-y-1 overflow-y-auto"
                >
                  {searchResults.length === 0 ? (
                    <li className="py-6 text-center text-[11px] text-slate-400">
                      {problemPool.length === 0
                        ? '请先选择讲次'
                        : onlyMissingAnalysis && activeSlice.sliceKind === 'analysis'
                          ? '暂无待补题解图的题目'
                          : '无匹配题目，试试其他关键词'}
                    </li>
                  ) : (
                    searchResults.map((item) => {
                      const matched = activeSlice.problemId === item.problem.id
                      const hasAnalysis = problemHasAnalysisImage(item.problem, dbAnalysisIds)
                      const noteCount = existingNotes.get(item.problem.id)?.length ?? 0
                      return (
                        <li key={`${item.lessonId}-${item.problem.id}`}>
                          <button
                            type="button"
                            onClick={() => applyProblemMatch(activeSlice.id, item)}
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
                              {activeSlice.sliceKind === 'analysis' && (
                                <AnalysisGuideBadge hasImage={hasAnalysis} showMissing size="sm" />
                              )}
                              {activeSlice.sliceKind === 'note' && noteCount > 0 && (
                                <span className="rounded bg-violet-100 px-1 text-[9px] text-violet-700">
                                  笔记×{noteCount}
                                </span>
                              )}
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
              )}

              {sliceIsMatched(activeSlice) && (
                <ComparisonPanel
                  slice={activeSlice}
                  pool={problemPool}
                  existingImages={existingImages}
                  existingNotes={existingNotes}
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
          onConfirm={() => {
            if (cloudOverwrite.lesson) {
              applyLessonMatch(cloudOverwrite.slice.id, cloudOverwrite.lesson, true)
            } else if (cloudOverwrite.candidate) {
              applyProblemMatch(cloudOverwrite.slice.id, cloudOverwrite.candidate, true)
            }
          }}
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
  existingNotes,
  onClear,
}: {
  slice: PdfSlice
  pool: SearchableProblem[]
  existingImages: Map<string, MathProblemImage>
  existingNotes: Map<string, MathProblemNote[]>
  onClear: () => void
}) {
  if (slice.sliceKind === 'summary') {
    const lessonMeta = slice.lessonId ? SEA_LESSONS.find((l) => l.id === slice.lessonId) : null
    const summaryId = slice.lessonId ? lessonSummaryProblemId(slice.lessonId) : null
    const existingSummary = summaryId ? existingNotes.get(summaryId)?.[0] : null

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
            <div className="mb-1 text-[10px] font-semibold text-slate-500">讲次</div>
            <div className="max-h-28 overflow-y-auto rounded bg-white p-1.5 text-[10px] leading-relaxed text-slate-700">
              <div className="font-bold text-teal-700">
                {lessonMeta ? lessonDisplayLabel(lessonMeta.id, false) : slice.lessonId}
              </div>
              <div className="font-semibold">{lessonMeta?.title ?? '—'}</div>
            </div>
          </div>
        </div>
        {existingSummary && (
          <div className="mt-2 border-t border-teal-100 pt-2">
            <div className="mb-1 text-[10px] font-semibold text-amber-700">
              已有总结（提交将追加图片）
            </div>
            <div
              className="max-h-24 overflow-y-auto rounded bg-white p-1.5 text-[10px] text-slate-600"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(existingSummary.bodyHtml) }}
            />
          </div>
        )}
      </div>
    )
  }

  const item = pool.find((p) => p.problem.id === slice.problemId)
  if (!item) return null

  const cloudKey = `${slice.problemId}:${slice.sliceKind}`
  const cloudRow =
    slice.sliceKind === 'analysis' || slice.sliceKind === 'figure'
      ? existingImages.get(cloudKey)
      : undefined
  const cloudUrl = cloudRow ? getMathImagePublicUrl(cloudRow.storagePath) : null
  const staticImg = slice.sliceKind === 'analysis' ? item.problem.analysisImg : null
  const existingNoteList = slice.problemId ? existingNotes.get(slice.problemId) : undefined

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
      {(cloudUrl || staticImg) && (
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
      {slice.sliceKind === 'note' && existingNoteList && existingNoteList.length > 0 && (
        <div className="mt-2 border-t border-teal-100 pt-2">
          <div className="mb-1 text-[10px] font-semibold text-amber-700">
            已有笔记（提交将新增一条图片笔记）
          </div>
          <div
            className="max-h-24 overflow-y-auto rounded bg-white p-1.5 text-[10px] text-slate-600"
            dangerouslySetInnerHTML={{
              __html: sanitizeRichHtml(existingNoteList[existingNoteList.length - 1]!.bodyHtml),
            }}
          />
        </div>
      )}
      {slice.sliceKind === 'draft' && (
        <div className="mt-2 border-t border-teal-100 pt-2">
          <div className="mb-1 text-[10px] font-semibold text-indigo-700">
            草稿补录（提交后新增练习记录）
          </div>
          <div className="text-[10px] text-slate-500">
            结果：
            {slice.draftCorrect === true
              ? '做对'
              : slice.draftCorrect === false
                ? '做错'
                : '未标记'}
          </div>
        </div>
      )}
    </div>
  )
}

async function submitNoteSlice(
  userId: string,
  lessonId: string,
  problemId: string,
  blob: Blob,
): Promise<string | null> {
  const file = new File([blob], `${problemId}.png`, { type: 'image/png' })
  const { error, url } = await uploadProblemNoteContentImage(lessonId, problemId, file)
  if (error || !url) return error ?? '图片上传失败'

  const { error: noteError } = await createMathProblemNote(userId, lessonId, problemId, {
    bodyHtml: richInlineImageHtml(url),
  })
  if (noteError) return noteError

  invalidateLessonNotesCache(lessonId)
  return null
}

async function submitSummarySlice(
  userId: string,
  lessonId: string,
  blob: Blob,
): Promise<string | null> {
  const problemId = lessonSummaryProblemId(lessonId)
  const file = new File([blob], 'summary.png', { type: 'image/png' })
  const { error, url } = await uploadLessonSummaryContentImage(lessonId, file)
  if (error || !url) return error ?? '图片上传失败'

  const allNotes = await loadLessonNotes(lessonId)
  const existing = notesForProblem(allNotes, problemId)[0]

  if (existing) {
    const { error: updateError } = await updateMathProblemNote(existing, {
      bodyHtml: appendRichInlineImage(existing.bodyHtml, url),
    })
    if (updateError) return updateError
  } else {
    const { error: createError } = await createMathProblemNote(userId, lessonId, problemId, {
      bodyHtml: richInlineImageHtml(url),
    })
    if (createError) return createError
  }

  invalidateLessonNotesCache(lessonId)
  return null
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
  const matchLabel = sliceMatchLabel(
    existingSlice,
    existingSlice.lessonId
      ? SEA_LESSONS.find((l) => l.id === existingSlice.lessonId)?.title
      : undefined,
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
    >
      <div className="max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="mb-1 text-[15px] font-extrabold text-slate-800">区域重叠 — 是否覆盖？</h3>
        <p className="mb-4 text-[12px] text-slate-500">
          新划片与已匹配
          {existingSlice.sliceKind === 'summary' ? '讲次' : '条目'}{' '}
          <span className="font-bold text-teal-700">{matchLabel}</span>{' '}
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
            <div className="mt-1 text-center text-[10px] text-teal-700">{matchLabel}</div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-bold text-slate-500">覆盖后（新划片）</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={newCropUrl}
              alt="新划片"
              className="w-full rounded-lg border border-teal-300 object-contain"
            />
            <div className="mt-1 text-center text-[10px] text-slate-400">
              需重新匹配{existingSlice.sliceKind === 'summary' ? '讲次' : '题目'}
            </div>
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
  const { slice, candidate, lesson, existingUrl, existingNotePreview } = prompt
  const isImageKind = slice.sliceKind === 'analysis' || slice.sliceKind === 'figure'
  const targetLabel = lesson
    ? `${lesson.displayLabel} · ${lesson.title}`
    : candidate
      ? candidate.problem.id
      : '—'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
    >
      <div className="max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="mb-1 text-[15px] font-extrabold text-slate-800">
          {isImageKind ? '已有图片 — 是否覆盖？' : '已有内容 — 是否继续？'}
        </h3>
        <p className="mb-4 text-[12px] text-slate-500">
          <span className="font-bold text-teal-700">{targetLabel}</span> 的
          {PDF_SLICE_KIND_LABEL[slice.sliceKind]}
          {isImageKind ? '已存在，提交后将替换。' : '已有内容，提交后将追加图片。'}
        </p>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 text-[11px] font-bold text-slate-500">线上现有</div>
            {existingUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={existingUrl}
                alt="现有"
                className="w-full rounded-lg border border-slate-200 object-contain"
              />
            ) : existingNotePreview ? (
              <div
                className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600"
                dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(existingNotePreview) }}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-[11px] text-slate-400">
                已有记录
              </div>
            )}
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
        {candidate && (
          <div className="mb-3 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
            <div className="font-semibold">{candidate.problem.title}</div>
            <div className="mt-1 line-clamp-3">{problemPreviewText(candidate.problem)}</div>
          </div>
        )}
        {lesson && (
          <div className="mb-3 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
            <div className="font-semibold">{lesson.displayLabel}</div>
            <div className="mt-1">{lesson.title}</div>
          </div>
        )}
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
