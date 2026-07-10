'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@rosie/core'
import { useMathSolved } from '@rosie/math/hooks/useMathSolved'
import { useMathWrong } from '@rosie/math/hooks/useMathWrong'
import { useProblemMastery } from '@rosie/math/hooks/useProblemMastery'
import { useMathQuiz, type QuizBatch, type QuizPaper } from '@rosie/math/hooks/useMathQuiz'
import {
  gradeOf,
  GRADE_LABEL,
  gradesInOrder,
  lessonDisplayLabel,
} from '@rosie/math/utils/lesson-grade'
import {
  allocateAppendLessons,
  allocateInitialBatch,
  computeQuizPoolStats,
  entriesToProblemItems,
  pickByPriority,
  quizBatchVolumeTitle,
  quizTodayDateStr,
} from '@rosie/math/utils/quiz-allocate'
import {
  ALL_QUIZ_SECTIONS,
  buildQuizPool,
  QUIZ_ALL_ENTRIES_MAP,
  QUIZ_LESSON_META,
  QUIZ_SECTION_INFO,
  type QuizEntry,
  type QuizSection,
} from '@rosie/math/utils/quiz-lesson-meta'
import type { QuizProblemItem } from '@rosie/math/hooks/useMathQuiz'

// ── Types ─────────────────────────────────────────────────────────────────────

type Section = QuizSection

type QuizItem = {
  uid: string
  lessonId: string
  sections: Section[]
  types: string[]
  problemId: string
  origin: 'random' | 'precise'
}

let uidCounter = 0

function makeUid() {
  uidCounter += 1
  return `q${Date.now().toString(36)}${uidCounter.toString(36)}`
}

const ALL_SECTIONS = ALL_QUIZ_SECTIONS
const SECTION_INFO = QUIZ_SECTION_INFO
const LESSON_META = QUIZ_LESSON_META
const ALL_ENTRIES_MAP = QUIZ_ALL_ENTRIES_MAP
const buildPool = buildQuizPool

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, '')
}

function todayDateStr() {
  return quizTodayDateStr()
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

// ── Main component ────────────────────────────────────────────────────────────

export default function QuizPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { solveCount } = useMathSolved(user)
  const { wrongIds } = useMathWrong(user)
  const { masteryMap } = useProblemMastery(user)
  const { papers, batches, savePaper, createBatch, appendToBatch, deletePaper, renamePaper, renameBatch, deleteBatch } =
    useMathQuiz(user)

  const allocationCtx = useMemo(
    () => ({ wrongIds, solveCount, masteryMap }),
    [wrongIds, solveCount, masteryMap],
  )

  // Builder state
  const [quizItems, setQuizItems] = useState<QuizItem[]>([])
  const [draftTitle, setDraftTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [batchSaving, setBatchSaving] = useState(false)

  // Inline rename state for saved papers
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null)
  const [editingBatchTitle, setEditingBatchTitle] = useState('')
  const [batchBusyId, setBatchBusyId] = useState<string | null>(null)
  /** Expanded batch cards; default collapsed */
  const [expandedBatchIds, setExpandedBatchIds] = useState<Set<string>>(new Set())

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'random' | 'precise' | 'append'>('random')
  const [appendBatchId, setAppendBatchId] = useState<string | null>(null)
  const [modalTitle, setModalTitle] = useState('')
  const [preciseStep, setPreciseStep] = useState<1 | 2>(1)
  // When set, the draft is swapping the problem of this precise item via a picker.
  const [swapUid, setSwapUid] = useState<string | null>(null)
  const [preciseSelected, setPreciseSelected] = useState<Set<string>>(new Set())
  const [modalLessons, setModalLessons] = useState<string[]>([])
  const [modalSections, setModalSections] = useState<Section[]>([])
  const [modalTypes, setModalTypes] = useState<Record<string, string[]>>({})
  const [modalCounts, setModalCounts] = useState<Record<string, number>>({})

  const existingIds = useMemo(() => new Set(quizItems.map((i) => i.lessonId)), [quizItems])
  const draftProblemIds = useMemo(() => new Set(quizItems.map((i) => i.problemId)), [quizItems])

  const modalTotal = useMemo(
    () => modalLessons.reduce((sum, id) => sum + Math.max(1, modalCounts[id] ?? 1), 0),
    [modalLessons, modalCounts],
  )

  const modalPoolStats = useMemo(() => {
    if (modalLessons.length === 0) {
      return { totalPool: 0, perVolume: 0, volumeCount: 0, lessonPoolSizes: {} as Record<string, number> }
    }
    return computeQuizPoolStats(
      modalLessons,
      modalSections,
      modalTypes,
      modalCounts,
      draftProblemIds,
    )
  }, [modalLessons, modalSections, modalTypes, modalCounts, draftProblemIds])

  const appendBatch = useMemo(
    () => (appendBatchId ? batches.find((b) => b.id === appendBatchId) ?? null : null),
    [appendBatchId, batches],
  )

  const batchLessonIds = useMemo(
    () => new Set(Object.keys(appendBatch?.config.lessons ?? {})),
    [appendBatch],
  )

  // Lessons that can be picked in the current modal mode. In random mode lessons
  // already in the draft are excluded; in precise mode every lesson is selectable
  // because individual problems are de-duplicated against the draft.
  const selectableLessons = useMemo(
    () => {
      if (modalMode === 'append') {
        return LESSON_META.filter((l) => !batchLessonIds.has(l.id))
      }
      return modalMode === 'random'
        ? LESSON_META.filter((l) => !existingIds.has(l.id))
        : LESSON_META
    },
    [modalMode, existingIds, batchLessonIds],
  )

  // Step 2 of precise mode: filtered problems grouped per lesson.
  const preciseGroups = useMemo(() => {
    if (modalMode !== 'precise') return []
    return modalLessons
      .map((lessonId) => {
        const meta = LESSON_META.find((l) => l.id === lessonId)
        const types = modalTypes[lessonId] ?? []
        const entries = buildPool(lessonId, modalSections, types)
        return { lessonId, name: meta?.name ?? '', entries }
      })
      .filter((g) => g.entries.length > 0)
  }, [modalMode, modalLessons, modalSections, modalTypes])

  // The precise item currently being swapped, plus its filtered candidate pool.
  const swapItem = useMemo(
    () => (swapUid ? (quizItems.find((i) => i.uid === swapUid) ?? null) : null),
    [swapUid, quizItems],
  )
  const swapPool = useMemo(
    () => (swapItem ? buildPool(swapItem.lessonId, swapItem.sections, swapItem.types) : []),
    [swapItem],
  )

  const quizEntries = useMemo(
    () => quizItems.map((item) => ({ item, entry: ALL_ENTRIES_MAP.get(item.problemId) })),
    [quizItems],
  )

  const batchUsedIds = useMemo(() => {
    if (!appendBatch) return new Set<string>()
    return new Set(
      papers
        .filter((p) => p.batchId === appendBatch.id)
        .flatMap((p) => p.problems.map((x) => x.problemId)),
    )
  }, [appendBatch, papers])

  const appendPoolStats = useMemo(() => {
    if (modalMode !== 'append' || modalLessons.length === 0) {
      return { totalPool: 0, perVolume: 0, volumeCount: 0, lessonPoolSizes: {} as Record<string, number> }
    }
    const sections =
      modalSections.length > 0 ? modalSections : appendBatch?.config.sections ?? []
    return computeQuizPoolStats(
      modalLessons,
      sections,
      modalTypes,
      modalCounts,
      batchUsedIds,
    )
  }, [modalMode, modalLessons, modalSections, modalTypes, modalCounts, batchUsedIds, appendBatch])

  const groupedRecords = useMemo(() => {
    const batchGroups = batches.map((batch) => ({
      batch,
      papers: papers
        .filter((p) => p.batchId === batch.id)
        .sort((a, b) => (a.batchIndex ?? 0) - (b.batchIndex ?? 0)),
    }))
    const orphanPapers = papers.filter((p) => !p.batchId)
    return { batchGroups, orphanPapers }
  }, [batches, papers])

  // ── Modal handlers ────────────────────────────────────────────────────────

  function openModal(mode: 'random' | 'precise') {
    setModalMode(mode)
    setAppendBatchId(null)
    setPreciseStep(1)
    setPreciseSelected(new Set())
    setModalLessons(LESSON_META.filter((l) => !existingIds.has(l.id)).map((l) => l.id))
    setModalSections([])
    setModalTypes({})
    setModalCounts({})
    setModalTitle(draftTitle)
    setModalOpen(true)
  }

  function openAppendModal(batch: QuizBatch) {
    setModalMode('append')
    setAppendBatchId(batch.id)
    setPreciseStep(1)
    setPreciseSelected(new Set())
    const inBatch = new Set(Object.keys(batch.config.lessons))
    setModalLessons(LESSON_META.filter((l) => !inBatch.has(l.id)).map((l) => l.id))
    setModalSections(batch.config.sections)
    setModalTypes({})
    setModalCounts({})
    setModalTitle(batch.titleBase)
    setModalOpen(true)
  }

  function toggleModalLesson(id: string) {
    setModalLessons((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setModalTypes((prev) => {
      if (prev[id]) {
        const n = { ...prev }
        delete n[id]
        return n
      }
      return prev
    })
    setModalCounts((prev) => {
      if (prev[id]) {
        const n = { ...prev }
        delete n[id]
        return n
      }
      return prev
    })
  }

  function toggleGradeGroup(gradeLessons: typeof LESSON_META, on: boolean) {
    const ids = gradeLessons
      .filter((l) => {
        if (modalMode === 'append') return !batchLessonIds.has(l.id)
        return modalMode !== 'random' || !existingIds.has(l.id)
      })
      .map((l) => l.id)
    if (on) {
      setModalLessons((prev) => [...new Set([...prev, ...ids])])
    } else {
      setModalLessons((prev) => prev.filter((id) => !ids.includes(id)))
      setModalTypes((prev) => {
        const next = { ...prev }
        for (const id of ids) delete next[id]
        return next
      })
      setModalCounts((prev) => {
        const next = { ...prev }
        for (const id of ids) delete next[id]
        return next
      })
    }
  }

  const lessonsByGrade = useMemo(
    () =>
      gradesInOrder()
        .map((g) => ({
          grade: g,
          label: GRADE_LABEL[g] ?? `${g} 年级`,
          lessons: LESSON_META.filter((l) => gradeOf(l.id) === g),
        }))
        .filter((grp) => grp.lessons.length > 0),
    [],
  )

  function setModalCount(lessonId: string, n: number) {
    setModalCounts((prev) => ({ ...prev, [lessonId]: Math.max(1, n) }))
  }

  function toggleModalSection(s: Section) {
    setModalSections((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  function toggleModalType(lessonId: string, tag: string) {
    setModalTypes((prev) => {
      const cur = prev[lessonId] ?? []
      const next = cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]
      return { ...prev, [lessonId]: next }
    })
  }

  // Random mode: pick N distinct problems per lesson by priority from the filtered pool.
  function handleRandomConfirm() {
    const newItems: QuizItem[] = []
    for (const lessonId of modalLessons) {
      if (existingIds.has(lessonId)) continue
      const types = modalTypes[lessonId] ?? []
      const pool = buildPool(lessonId, modalSections, types)
      const count = Math.max(1, modalCounts[lessonId] ?? 1)
      const chosen = new Set<string>()
      for (let k = 0; k < count; k++) {
        const picked = pickByPriority(pool, chosen, allocationCtx)
        if (!picked) break
        chosen.add(picked.problem.id)
        newItems.push({
          uid: makeUid(),
          lessonId,
          sections: modalSections,
          types,
          problemId: picked.problem.id,
          origin: 'random',
        })
      }
    }
    setQuizItems((prev) => [...prev, ...newItems])
    setModalOpen(false)
  }

  async function handleBatchCreate() {
    if (!user || modalLessons.length === 0 || modalPoolStats.volumeCount === 0) return
    setBatchSaving(true)
    const titleBase = modalTitle.trim() || draftTitle.trim() || `综合测试卷${todayDateStr()}`
    const { volumes, config } = allocateInitialBatch(
      modalLessons,
      modalSections,
      modalTypes,
      modalCounts,
      allocationCtx,
      draftProblemIds,
    )
    const inserts = volumes.map((vol) => ({
      batchIndex: vol.batchIndex,
      title: quizBatchVolumeTitle(titleBase, vol.batchIndex, volumes.length),
      problems: entriesToProblemItems(vol.entries, modalSections, modalTypes),
    }))
    const batchId = await createBatch(titleBase, inserts, config)
    setBatchSaving(false)
    setModalOpen(false)
    if (batchId) {
      setModalTitle('')
    }
  }

  async function handleAppendConfirm() {
    if (!user || !appendBatch || modalLessons.length === 0) return
    setBatchSaving(true)
    const titleBase = appendBatch.titleBase
    const batchPapers = papers
      .filter((p) => p.batchId === appendBatch.id)
      .sort((a, b) => (a.batchIndex ?? 0) - (b.batchIndex ?? 0))

    const countsWithDefaults = { ...modalCounts }
    const defaultCount =
      Object.values(appendBatch.config.lessons)[0]?.countPerVolume ?? 1
    for (const lessonId of modalLessons) {
      if (!countsWithDefaults[lessonId]) {
        countsWithDefaults[lessonId] = defaultCount
      }
    }

    const plan = allocateAppendLessons(
      modalLessons,
      modalSections.length > 0 ? modalSections : appendBatch.config.sections,
      modalTypes,
      countsWithDefaults,
      batchPapers.map((p) => ({
        id: p.id,
        batchIndex: p.batchIndex,
        completedAt: p.completedAt,
        problems: p.problems,
      })),
      appendBatch.config,
      allocationCtx,
    )

    const sections =
      modalSections.length > 0 ? modalSections : appendBatch.config.sections

    const updates = plan.updates.map((u) => {
      const paper = batchPapers.find((p) => p.id === u.paperId)!
      const appended = entriesToProblemItems(u.appendEntries, sections, modalTypes)
      return { paperId: u.paperId, problems: [...paper.problems, ...appended] }
    })

    const maxExisting = batchPapers.reduce((m, p) => Math.max(m, p.batchIndex ?? 0), 0)
    const maxNew = plan.newVolumes.reduce((m, v) => Math.max(m, v.batchIndex), 0)
    const totalVolumes = Math.max(maxExisting, maxNew, appendBatch.volumeCount)

    const newVolumes = plan.newVolumes.map((vol) => ({
      batchIndex: vol.batchIndex,
      title: quizBatchVolumeTitle(titleBase, vol.batchIndex, totalVolumes),
      problems: entriesToProblemItems(vol.entries, sections, modalTypes),
    }))

    const ok = await appendToBatch(appendBatch.id, titleBase, updates, newVolumes, plan.config)
    setBatchSaving(false)
    setModalOpen(false)
    setAppendBatchId(null)
    if (!ok) {
      window.alert('追加失败，请确认已执行 docs/sql/math-quiz-batches.sql 迁移')
    }
  }

  // Precise mode: add exactly the manually selected problems (skipping any already in the draft).
  function handlePreciseConfirm() {
    const newItems: QuizItem[] = []
    for (const group of preciseGroups) {
      const types = modalTypes[group.lessonId] ?? []
      for (const entry of group.entries) {
        if (!preciseSelected.has(entry.problem.id)) continue
        if (draftProblemIds.has(entry.problem.id)) continue
        newItems.push({
          uid: makeUid(),
          lessonId: group.lessonId,
          sections: modalSections,
          types,
          problemId: entry.problem.id,
          origin: 'precise',
        })
      }
    }
    setQuizItems((prev) => [...prev, ...newItems])
    setModalOpen(false)
  }

  function togglePrecise(problemId: string) {
    setPreciseSelected((prev) => {
      const n = new Set(prev)
      if (n.has(problemId)) n.delete(problemId)
      else n.add(problemId)
      return n
    })
  }

  function toggleGroupAll(entries: QuizEntry[]) {
    setPreciseSelected((prev) => {
      const n = new Set(prev)
      const selectable = entries.filter((e) => !draftProblemIds.has(e.problem.id))
      const allSel = selectable.length > 0 && selectable.every((e) => n.has(e.problem.id))
      if (allSel) selectable.forEach((e) => n.delete(e.problem.id))
      else selectable.forEach((e) => n.add(e.problem.id))
      return n
    })
  }

  // ── Quiz builder handlers ─────────────────────────────────────────────────

  function handleSwap(uid: string) {
    const item = quizItems.find((i) => i.uid === uid)
    if (!item) return
    // Precise items: let the user pick the replacement from the filtered list.
    if (item.origin === 'precise') {
      setSwapUid(uid)
      return
    }
    const pool = buildPool(item.lessonId, item.sections, item.types)
    const used = new Set(quizItems.map((i) => i.problemId))
    const picked =
      pickByPriority(pool, used, allocationCtx) ??
      pickByPriority(pool, new Set([item.problemId]), allocationCtx)
    if (!picked) return
    setQuizItems((prev) =>
      prev.map((i) => (i.uid === uid ? { ...i, problemId: picked.problem.id } : i)),
    )
  }

  function handleSwapPick(problemId: string) {
    if (!swapUid) return
    setQuizItems((prev) => prev.map((i) => (i.uid === swapUid ? { ...i, problemId } : i)))
    setSwapUid(null)
  }

  function handleRemove(uid: string) {
    setQuizItems((prev) => prev.filter((i) => i.uid !== uid))
  }

  async function handleSave() {
    if (quizItems.length === 0 || !user) return
    setSaving(true)
    const title = draftTitle.trim() || `综合测试卷${todayDateStr()}`
    const problems: QuizProblemItem[] = quizItems.map((item) => ({
      lessonId: item.lessonId,
      section: ALL_ENTRIES_MAP.get(item.problemId)?.section ?? '',
      problemId: item.problemId,
      sections: item.sections,
      types: item.types,
    }))
    const id = await savePaper(problems, title)
    setSaving(false)
    if (id) {
      setQuizItems([])
      setDraftTitle('')
      router.push(`/math/ny/quiz/${id}`)
    }
  }

  function startRename(id: string, title: string) {
    setEditingId(id)
    setEditingTitle(title)
  }

  async function commitRename() {
    if (!editingId) return
    const id = editingId
    const title = editingTitle
    setEditingId(null)
    await renamePaper(id, title)
  }

  function startBatchRename(batch: QuizBatch) {
    setEditingBatchId(batch.id)
    setEditingBatchTitle(batch.titleBase)
  }

  async function commitBatchRename() {
    if (!editingBatchId) return
    const id = editingBatchId
    const title = editingBatchTitle
    setEditingBatchId(null)
    setBatchBusyId(id)
    const ok = await renameBatch(id, title)
    setBatchBusyId(null)
    if (!ok) window.alert('修改批次标题失败')
  }

  async function handleDeleteBatch(batch: QuizBatch, paperCount: number) {
    const okConfirm = window.confirm(
      `确定删除批次「${batch.titleBase}」？将同时删除其中 ${paperCount} 卷试卷，且不可恢复。`,
    )
    if (!okConfirm) return
    setBatchBusyId(batch.id)
    const ok = await deleteBatch(batch.id)
    setBatchBusyId(null)
    if (!ok) window.alert('删除批次失败')
  }

  function toggleBatchExpanded(batchId: string) {
    setExpandedBatchIds((prev) => {
      const next = new Set(prev)
      if (next.has(batchId)) next.delete(batchId)
      else next.add(batchId)
      return next
    })
  }

  function renderPaperRow(paper: QuizPaper) {
    return (
      <div
        key={paper.id}
        className="flex cursor-pointer items-center gap-2 rounded-2xl bg-white py-3 pr-2 pl-4 transition-all hover:shadow-md"
        style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 6px rgba(0,0,0,.04)' }}
        onClick={() => router.push(`/math/ny/quiz/${paper.id}`)}
      >
        <div className="min-w-0 flex-1">
          {editingId === paper.id ? (
            <input
              autoFocus
              type="text"
              value={editingTitle}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setEditingTitle(e.target.value)}
              onBlur={() => void commitRename()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void commitRename()
                else if (e.key === 'Escape') setEditingId(null)
              }}
              className="w-full rounded-lg border border-indigo-300 bg-white px-2 py-1 text-sm font-bold text-slate-800 outline-none"
              aria-label="修改试卷标题"
            />
          ) : (
            <p className="truncate text-sm font-bold text-slate-800">{paper.title}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            {paper.batchIndex != null && (
              <>
                <span className="text-indigo-500">第{paper.batchIndex}卷</span>
                <span className="text-slate-300">·</span>
              </>
            )}
            <span className="text-slate-400">{paper.problems.length} 题</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400">{formatDate(paper.createdAt)}</span>
            <span className="text-slate-300">·</span>
            {paper.completedAt ? (
              <span className="font-semibold text-emerald-600">
                {paper.score ?? 0}/{paper.totalScore} 分
                {paper.batchId ? ' · 已提交' : ''}
              </span>
            ) : paper.answers && Object.keys(paper.answers).length > 0 ? (
              <span className="font-semibold text-indigo-500">作答中</span>
            ) : (
              <span className="font-semibold text-amber-500">未作答</span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            startRename(paper.id, paper.title)
          }}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-500"
          title="重命名"
          aria-label="重命名试卷"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            window.open(
              `/math/ny/quiz/${paper.id}/print${paper.completedAt ? '?mode=complete' : ''}`,
              '_blank',
            )
          }}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-500"
          title="打印"
          aria-label="打印试卷"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            void deletePaper(paper.id)
          }}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
          title="删除"
          aria-label="删除试卷"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="min-h-screen bg-slate-50">
        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur-sm">
          <div className="mx-auto max-w-2xl">
            {/* Row 1: back + title (right padding reserves room for AccountBar on mobile) */}
            <div className="flex h-12 items-center justify-between pr-[168px] pl-4 lg:h-14 lg:pr-4">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  href="/math"
                  className="flex shrink-0 items-center gap-1.5 text-sm text-slate-400 no-underline transition-colors hover:text-slate-600"
                  aria-label="返回数学首页"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M10 12L6 8l4-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  返回
                </Link>
                <h1 className="truncate text-sm font-bold text-slate-800">综合组卷</h1>
              </div>
              {/* Inline actions on lg+ where AccountBar floats outside container */}
              <div className="hidden shrink-0 items-center gap-2 lg:flex">
                <Link
                  href="/math/mistakes"
                  className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-500 no-underline transition-colors hover:bg-rose-100"
                >
                  错题本
                </Link>
                <button
                  onClick={() => openModal('precise')}
                  className="cursor-pointer rounded-full bg-violet-100 px-3.5 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-200"
                >
                  精准出题
                </button>
                <button
                  onClick={() => openModal('random')}
                  className="cursor-pointer rounded-full bg-indigo-500 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-600"
                >
                  随机出题
                </button>
              </div>
            </div>

            {/* Row 2: actions on < lg, full-width for thumb reach */}
            <div className="flex items-center justify-between gap-2 px-4 pb-3 lg:hidden">
              <Link
                href="/math/mistakes"
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-500 no-underline transition-colors hover:bg-rose-100"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                错题本
              </Link>
              <div className="flex flex-1 items-center justify-end gap-2">
                <button
                  onClick={() => openModal('precise')}
                  className="flex cursor-pointer items-center justify-center gap-1.5 rounded-full bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-200"
                >
                  精准出题
                </button>
                <button
                  onClick={() => openModal('random')}
                  className="flex cursor-pointer items-center justify-center gap-1.5 rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-600"
                  style={{ boxShadow: '0 4px 12px rgba(99,102,241,.25)' }}
                >
                  随机出题
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-2xl px-4 py-5">
          {/* Builder section */}
          {quizItems.length > 0 && (
            <div
              className="mb-6 rounded-2xl bg-white p-4"
              style={{
                border: '1.5px solid rgba(99,102,241,.2)',
                boxShadow: '0 4px 16px rgba(99,102,241,.08)',
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-700">
                  当前试卷草稿 · {quizItems.length} 题
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setQuizItems([])}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-200"
                  >
                    清空
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {saving ? '保存中…' : '保存试卷'}
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder={`综合测试卷${todayDateStr()}`}
                className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors outline-none focus:border-indigo-400 focus:bg-white"
                aria-label="试卷标题"
              />

              <div className="flex flex-col gap-2">
                {quizEntries.map(({ item, entry }, i) => {
                  if (!entry) return null
                  const { problem, section } = entry
                  const count = solveCount[problem.id] ?? 0
                  const countCls =
                    count === 0
                      ? 'bg-slate-100 text-slate-500'
                      : count <= 2
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'

                  return (
                    <div
                      key={item.uid}
                      className="flex items-start gap-3 rounded-xl bg-slate-50 p-3"
                    >
                      <span className="mt-0.5 w-4 shrink-0 text-xs font-bold text-slate-400">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-1">
                          <span className="text-[11px] font-semibold text-indigo-600">
                            第{item.lessonId}讲
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {SECTION_INFO[section].icon}
                            {SECTION_INFO[section].label}
                          </span>
                          <span className="text-[11px] text-slate-400">{problem.tagLabel}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${countCls}`}
                          >
                            {count === 0 ? '未练习' : `练${count}次`}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-xs text-slate-600">
                          {stripHtml(problem.text)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          onClick={() => handleSwap(item.uid)}
                          className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-200"
                        >
                          换题
                        </button>
                        <button
                          onClick={() => handleRemove(item.uid)}
                          className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] text-rose-500 hover:bg-rose-100"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Records list */}
          <div>
            <p className="mb-3 text-xs font-bold tracking-widest text-slate-400 uppercase">
              试卷记录
            </p>
            {papers.length === 0 ? (
              <div
                className="rounded-2xl bg-white px-6 py-12 text-center"
                style={{ border: '1px dashed #cbd5e1' }}
              >
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#818cf8"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-500">还没有保存过试卷</p>
                <p className="mt-1 text-xs text-slate-400">
                  点击「随机出题」或「精准出题」开始组卷
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {groupedRecords.batchGroups.map(({ batch, papers: batchPapers }) => {
                  const expanded = expandedBatchIds.has(batch.id)
                  const completedCount = batchPapers.filter((p) => p.completedAt).length
                  const totalCount = batchPapers.length
                  const progressDone = totalCount > 0 && completedCount === totalCount
                  return (
                    <div
                      key={batch.id}
                      className="rounded-2xl bg-white p-3"
                      style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 6px rgba(0,0,0,.04)' }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleBatchExpanded(batch.id)}
                          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl px-1 py-0.5 text-left transition-colors hover:bg-slate-50"
                          aria-expanded={expanded}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            className={`shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
                            aria-hidden="true"
                          >
                            <path
                              d="M6 4l4 4-4 4"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <div className="min-w-0 flex-1">
                            {editingBatchId === batch.id ? (
                              <input
                                autoFocus
                                type="text"
                                value={editingBatchTitle}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setEditingBatchTitle(e.target.value)}
                                onBlur={() => void commitBatchRename()}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void commitBatchRename()
                                  else if (e.key === 'Escape') setEditingBatchId(null)
                                }}
                                className="w-full max-w-xs rounded-lg border border-indigo-300 bg-white px-2 py-1 text-sm font-bold text-slate-800 outline-none"
                                aria-label="修改批次标题"
                              />
                            ) : (
                              <p className="truncate text-sm font-bold text-slate-700">{batch.titleBase}</p>
                            )}
                            <p className="mt-0.5 text-[11px] text-slate-400">
                              <span
                                className={
                                  progressDone
                                    ? 'font-semibold text-emerald-600'
                                    : completedCount > 0
                                      ? 'font-semibold text-indigo-500'
                                      : 'font-semibold text-amber-500'
                                }
                              >
                                {completedCount}/{totalCount}
                              </span>
                              <span className="text-slate-300"> · </span>
                              {totalCount} 卷 ·{' '}
                              {batchPapers.reduce((n, p) => n + p.problems.length, 0)} 题
                            </p>
                          </div>
                        </button>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            disabled={batchBusyId === batch.id}
                            onClick={() => startBatchRename(batch)}
                            className="cursor-pointer rounded-full bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
                            title="修改批次标题"
                          >
                            改名
                          </button>
                          <button
                            type="button"
                            disabled={batchBusyId === batch.id || batchPapers.length === 0}
                            onClick={() => {
                              window.open(`/math/ny/quiz/batch/${batch.id}/print`, '_blank')
                            }}
                            className="cursor-pointer rounded-full bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-100 disabled:opacity-50"
                            title="按批次打印全部试卷"
                          >
                            打印
                          </button>
                          <button
                            type="button"
                            disabled={batchBusyId === batch.id}
                            onClick={() => openAppendModal(batch)}
                            className="cursor-pointer rounded-full bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-200 disabled:opacity-50"
                          >
                            追加讲次
                          </button>
                          <button
                            type="button"
                            disabled={batchBusyId === batch.id}
                            onClick={() => void handleDeleteBatch(batch, batchPapers.length)}
                            className="cursor-pointer rounded-full bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-500 transition-colors hover:bg-rose-100 disabled:opacity-50"
                            title="删除整批"
                          >
                            {batchBusyId === batch.id ? '…' : '删除'}
                          </button>
                        </div>
                      </div>
                      {expanded && (
                        <div className="mt-3 flex flex-col gap-2">{batchPapers.map(renderPaperRow)}</div>
                      )}
                    </div>
                  )
                })}
                {groupedRecords.orphanPapers.length > 0 && (
                  <div>
                    {groupedRecords.batchGroups.length > 0 && (
                      <p className="mb-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
                        单卷记录
                      </p>
                    )}
                    <div className="flex flex-col gap-2">
                      {groupedRecords.orphanPapers.map(renderPaperRow)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal ────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          style={{ background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false)
          }}
        >
          <div
            className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white sm:max-w-[560px] sm:rounded-2xl"
            style={{ boxShadow: '0 24px 60px rgba(0,0,0,.2)' }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <h2 className="font-black text-slate-800">
                {modalMode === 'random'
                  ? '随机出题'
                  : modalMode === 'append'
                    ? `追加讲次 · ${appendBatch?.titleBase ?? ''}`
                    : preciseStep === 1
                      ? '精准出题 · 筛选'
                      : '精准出题 · 选题'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-lg leading-none text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-5 px-5 py-4">
              {modalMode === 'precise' && preciseStep === 2 ? (
                /* ── Precise step 2: per-lesson problem picker ───────────────── */
                <section className="flex flex-col gap-4">
                  {preciseGroups.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-400">
                      没有符合筛选条件的题目
                    </p>
                  ) : (
                    preciseGroups.map((group) => {
                      const selectable = group.entries.filter(
                        (e) => !draftProblemIds.has(e.problem.id),
                      )
                      const allSel =
                        selectable.length > 0 &&
                        selectable.every((e) => preciseSelected.has(e.problem.id))
                      return (
                        <div key={group.lessonId}>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-xs font-bold text-slate-600">
                              第{group.lessonId}讲 · {group.name}
                              <span className="ml-1 font-normal text-slate-400">
                                ({group.entries.length})
                              </span>
                            </p>
                            <button
                              onClick={() => toggleGroupAll(group.entries)}
                              disabled={selectable.length === 0}
                              className="shrink-0 text-[11px] text-indigo-500 hover:text-indigo-700 disabled:opacity-40"
                            >
                              {allSel ? '取消全选' : '全选'}
                            </button>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {group.entries.map((entry) => {
                              const inDraft = draftProblemIds.has(entry.problem.id)
                              const sel = preciseSelected.has(entry.problem.id)
                              return (
                                <button
                                  key={entry.problem.id}
                                  disabled={inDraft}
                                  onClick={() => togglePrecise(entry.problem.id)}
                                  className={`flex items-start gap-2.5 rounded-xl p-2.5 text-left transition-all ${
                                    inDraft
                                      ? 'cursor-not-allowed bg-slate-50 opacity-60'
                                      : sel
                                        ? 'bg-indigo-50'
                                        : 'bg-slate-50 hover:bg-slate-100'
                                  }`}
                                  style={
                                    sel && !inDraft
                                      ? { boxShadow: 'inset 0 0 0 1.5px rgb(165 180 252)' }
                                      : undefined
                                  }
                                >
                                  <span
                                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                                      sel
                                        ? 'border-indigo-500 bg-indigo-500 text-white'
                                        : 'border-slate-300 bg-white text-transparent'
                                    }`}
                                  >
                                    ✓
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="mb-1 flex flex-wrap items-center gap-1">
                                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                                        {SECTION_INFO[entry.section].icon}
                                        {SECTION_INFO[entry.section].label}
                                      </span>
                                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                        {entry.problem.tagLabel}
                                      </span>
                                      {inDraft && (
                                        <span className="text-[10px] font-semibold text-emerald-600">
                                          已在试卷
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs leading-relaxed text-slate-700">
                                      {stripHtml(entry.problem.text)}
                                    </p>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })
                  )}
                </section>
              ) : (
                <>
                  {/* Lesson selector */}
                  <section>
                    <div className="mb-2.5 flex items-center gap-2">
                      <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                        选择课题
                      </p>
                      <button
                        onClick={() => {
                          const allSel = selectableLessons.every((l) => modalLessons.includes(l.id))
                          if (allSel) {
                            setModalLessons([])
                            setModalTypes({})
                          } else {
                            setModalLessons(selectableLessons.map((l) => l.id))
                            setModalTypes({})
                          }
                        }}
                        className="text-[11px] text-indigo-500 hover:text-indigo-700"
                      >
                        {selectableLessons.every((l) => modalLessons.includes(l.id))
                          ? '取消全选'
                          : '全选'}
                      </button>
                    </div>
                    <div className="space-y-4">
                      {lessonsByGrade.map((grp) => {
                        const selectable = grp.lessons.filter((l) => {
                          if (modalMode === 'append') return !batchLessonIds.has(l.id)
                          return modalMode !== 'random' || !existingIds.has(l.id)
                        })
                        const allSel =
                          selectable.length > 0 &&
                          selectable.every((l) => modalLessons.includes(l.id))
                        return (
                          <div key={grp.grade}>
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-[11px] font-bold text-slate-500">{grp.label}</p>
                              <button
                                onClick={() => toggleGradeGroup(grp.lessons, !allSel)}
                                className="text-[11px] text-indigo-500 hover:text-indigo-700"
                              >
                                {allSel ? '取消全选' : '全选'}
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {grp.lessons.map(({ id, name }) => {
                                const alreadyIn =
                                  (modalMode === 'random' && existingIds.has(id)) ||
                                  (modalMode === 'append' && batchLessonIds.has(id))
                                const selected = modalLessons.includes(id)
                                return (
                                  <button
                                    key={id}
                                    disabled={alreadyIn}
                                    onClick={() => toggleModalLesson(id)}
                                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                                      alreadyIn
                                        ? 'cursor-not-allowed bg-slate-50 text-slate-300'
                                        : selected
                                          ? 'bg-indigo-500 text-white shadow-sm'
                                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    {lessonDisplayLabel(id, true)} · {name}
                                    {alreadyIn ? ' ✓' : ''}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>

                  {/* Section filter */}
                  <section>
                    <div className="mb-2.5 flex items-center gap-2">
                      <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                        学习模块
                      </p>
                      <button
                        onClick={() =>
                          setModalSections((prev) =>
                            prev.length === ALL_SECTIONS.length ? [] : [...ALL_SECTIONS],
                          )
                        }
                        className="text-[11px] text-indigo-500 hover:text-indigo-700"
                      >
                        {modalSections.length === ALL_SECTIONS.length ? '取消全选' : '综合题库'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ALL_SECTIONS.map((s) => {
                        const { label, icon } = SECTION_INFO[s]
                        const sel = modalSections.includes(s)
                        return (
                          <button
                            key={s}
                            onClick={() => toggleModalSection(s)}
                            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                              sel
                                ? 'bg-violet-500 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <span>{icon}</span>
                            {label}
                          </button>
                        )
                      })}
                    </div>
                    {modalSections.length === 0 && (
                      <p className="mt-1.5 text-[11px] text-slate-400">未选择则包含所有模块</p>
                    )}
                  </section>

                  {/* Per-lesson type filter */}
                  {modalLessons.length > 0 && (
                    <section>
                      <p className="mb-2.5 text-xs font-bold tracking-wider text-slate-400 uppercase">
                        {modalMode === 'random' || modalMode === 'append' ? '数量与题型' : '题型筛选'}{' '}
                        <span className="font-normal normal-case">(题型可选)</span>
                      </p>
                      <div className="flex flex-col gap-3">
                        {modalLessons.map((lessonId) => {
                          const meta = LESSON_META.find((l) => l.id === lessonId)
                          if (!meta) return null
                          const selectedTypes = modalTypes[lessonId] ?? []
                          const count = Math.max(1, modalCounts[lessonId] ?? 1)
                          return (
                            <div key={lessonId} className="rounded-xl bg-slate-50 p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="min-w-0 truncate text-xs font-semibold text-slate-600">
                                  第{lessonId}讲 · {meta.name}
                                </p>
                                {(modalMode === 'random' || modalMode === 'append') && (
                                  <div className="flex shrink-0 items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setModalCount(lessonId, count - 1)}
                                      disabled={count <= 1}
                                      aria-label="减少数量"
                                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      −
                                    </button>
                                    <span className="w-5 text-center text-xs font-bold text-slate-700 tabular-nums">
                                      {count}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setModalCount(lessonId, count + 1)}
                                      aria-label="增加数量"
                                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100"
                                    >
                                      +
                                    </button>
                                    <span className="ml-0.5 text-[11px] text-slate-400">道</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {meta.types.map(({ tag, label }) => {
                                  const sel = selectedTypes.includes(tag)
                                  return (
                                    <button
                                      key={tag}
                                      onClick={() => toggleModalType(lessonId, tag)}
                                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${
                                        sel
                                          ? 'bg-indigo-500 text-white'
                                          : 'border border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  )}
                  {(modalMode === 'random' || modalMode === 'append') && modalLessons.length > 0 && (
                    <section>
                      <p className="mb-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
                        试卷标题
                      </p>
                      <input
                        type="text"
                        value={modalTitle}
                        onChange={(e) => setModalTitle(e.target.value)}
                        readOnly={modalMode === 'append'}
                        placeholder={`综合测试卷${todayDateStr()}`}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none read-only:cursor-default read-only:opacity-80 focus:border-indigo-400 focus:bg-white"
                        aria-label="试卷标题"
                      />
                      {modalMode === 'append' && (
                        <p className="mt-1.5 text-[11px] text-slate-400">
                          追加卷将沿用批次标题并自动续卷号
                        </p>
                      )}
                    </section>
                  )}
                </>
              )}
            </div>

            <div className="sticky bottom-0 flex flex-col gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              {modalMode === 'random' ? (
                <>
                  <span className="text-xs text-slate-400">
                    已选 {modalLessons.length} 个课题 · 每卷 {modalTotal} 题 · 题库{' '}
                    {modalPoolStats.totalPool} 题 · 可出 {modalPoolStats.volumeCount} 卷
                    <span className="mt-0.5 block text-[11px] text-slate-300">
                      某讲次题不够时，后续卷自动复用该讲次题目
                    </span>
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      disabled={modalLessons.length === 0}
                      onClick={handleRandomConfirm}
                      className="rounded-full bg-slate-100 px-5 py-2 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      确认组卷
                    </button>
                    <button
                      disabled={
                        modalLessons.length === 0 ||
                        modalPoolStats.volumeCount === 0 ||
                        batchSaving
                      }
                      onClick={() => void handleBatchCreate()}
                      className="rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {batchSaving ? '生成中…' : `批量出卷 (${modalPoolStats.volumeCount})`}
                    </button>
                  </div>
                </>
              ) : modalMode === 'append' ? (
                <>
                  <span className="text-xs text-slate-400">
                    新增 {modalLessons.length} 个讲次 · 每卷 {modalTotal} 题 · 题库{' '}
                    {appendPoolStats.totalPool} 题 · 预计新卷 {appendPoolStats.volumeCount} 卷
                    <span className="mt-0.5 block text-[11px] text-slate-300">
                      某讲次题不够时，后续卷自动复用该讲次题目
                    </span>
                  </span>
                  <button
                    disabled={modalLessons.length === 0 || appendPoolStats.totalPool === 0 || batchSaving}
                    onClick={() => void handleAppendConfirm()}
                    className="rounded-full bg-indigo-500 px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {batchSaving ? '追加中…' : '确认追加'}
                  </button>
                </>
              ) : preciseStep === 1 ? (
                <>
                  <span className="text-xs text-slate-400">已选 {modalLessons.length} 个课题</span>
                  <button
                    disabled={modalLessons.length === 0}
                    onClick={() => setPreciseStep(2)}
                    className="rounded-full bg-indigo-500 px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    下一步
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setPreciseStep(1)}
                    className="rounded-full bg-slate-100 px-5 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-200"
                  >
                    上一步
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">已选 {preciseSelected.size} 题</span>
                    <button
                      disabled={preciseSelected.size === 0}
                      onClick={handlePreciseConfirm}
                      className="rounded-full bg-emerald-500 px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      完成出卷
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Swap picker (precise items) ───────────────────────────────────── */}
      {swapItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          style={{ background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSwapUid(null)
          }}
        >
          <div
            className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white sm:max-w-[560px] sm:rounded-2xl"
            style={{ boxShadow: '0 24px 60px rgba(0,0,0,.2)' }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <h2 className="font-black text-slate-800">换题 · 第{swapItem.lessonId}讲</h2>
              <button
                onClick={() => setSwapUid(null)}
                className="text-lg leading-none text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-1.5 px-5 py-4">
              {swapPool.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">没有可选题目</p>
              ) : (
                swapPool.map((entry) => {
                  const isCurrent = entry.problem.id === swapItem.problemId
                  // Disable problems already used by other draft items.
                  const usedElsewhere = !isCurrent && draftProblemIds.has(entry.problem.id)
                  return (
                    <button
                      key={entry.problem.id}
                      disabled={usedElsewhere}
                      onClick={() => handleSwapPick(entry.problem.id)}
                      className={`flex items-start gap-2.5 rounded-xl p-2.5 text-left transition-all ${
                        usedElsewhere
                          ? 'cursor-not-allowed bg-slate-50 opacity-60'
                          : isCurrent
                            ? 'bg-indigo-50'
                            : 'bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-1">
                          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                            {SECTION_INFO[entry.section].icon}
                            {SECTION_INFO[entry.section].label}
                          </span>
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            {entry.problem.tagLabel}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] font-semibold text-indigo-600">当前</span>
                          )}
                          {usedElsewhere && (
                            <span className="text-[10px] font-semibold text-emerald-600">
                              已选用
                            </span>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed text-slate-700">
                          {stripHtml(entry.problem.text)}
                        </p>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
