'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@rosie/core'
import { useMathSolved } from '@rosie/math/hooks/useMathSolved'
import { useMathQuiz } from '@rosie/math/hooks/useMathQuiz'
import { PROBLEMS as P12, PROBLEM_TYPES as PT12 } from '@rosie/math/utils/lesson12-data'
import { PROBLEMS as P13, PROBLEM_TYPES as PT13 } from '@rosie/math/utils/lesson13-data'
import { PROBLEMS as P15, PROBLEM_TYPES as PT15 } from '@rosie/math/utils/lesson15-data'
import { PROBLEMS as P18, PROBLEM_TYPES as PT18 } from '@rosie/math/utils/lesson18-data'
import { PROBLEMS as P23, PROBLEM_TYPES as PT23 } from '@rosie/math/utils/lesson23-data'
import { PROBLEMS as P29, PROBLEM_TYPES as PT29 } from '@rosie/math/utils/lesson29-data'
import { PROBLEMS as P30, PROBLEM_TYPES as PT30 } from '@rosie/math/utils/lesson30-data'
import { PROBLEMS as P34, PROBLEM_TYPES as PT34 } from '@rosie/math/utils/lesson34-data'
import { PROBLEMS as P35, PROBLEM_TYPES as PT35 } from '@rosie/math/utils/lesson35-data'
import { PROBLEMS as P36, PROBLEM_TYPES as PT36 } from '@rosie/math/utils/lesson36-data'
import { PROBLEMS as P37, PROBLEM_TYPES as PT37 } from '@rosie/math/utils/lesson37-data'
import { PROBLEMS as P38, PROBLEM_TYPES as PT38 } from '@rosie/math/utils/lesson38-data'
import { PROBLEMS as P39, PROBLEM_TYPES as PT39 } from '@rosie/math/utils/lesson39-data'
import { PROBLEMS as P40, PROBLEM_TYPES as PT40 } from '@rosie/math/utils/lesson40-data'
import { PROBLEMS as P41, PROBLEM_TYPES as PT41 } from '@rosie/math/utils/lesson41-data'
import { PROBLEMS as P42, PROBLEM_TYPES as PT42 } from '@rosie/math/utils/lesson42-data'
import { PROBLEMS as P43, PROBLEM_TYPES as PT43 } from '@rosie/math/utils/lesson43-data'
import { PROBLEMS as P44, PROBLEM_TYPES as PT44 } from '@rosie/math/utils/lesson44-data'
import { PROBLEMS as P46, PROBLEM_TYPES as PT46 } from '@rosie/math/utils/lesson46-data'
import { PROBLEMS as P47, PROBLEM_TYPES as PT47 } from '@rosie/math/utils/lesson47-data'
import type { Problem, ProblemSet } from '@rosie/core'
import type { QuizProblemItem } from '@rosie/math/hooks/useMathQuiz'

// ── Types ─────────────────────────────────────────────────────────────────────

type Section = 'pretest' | 'lesson' | 'homework' | 'workbook' | 'supplement'

type QuizEntry = { problem: Problem; lessonId: string; section: Section }

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

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_SECTIONS: Section[] = ['lesson', 'homework', 'workbook', 'supplement', 'pretest']

const SECTION_INFO: Record<Section, { label: string; icon: string }> = {
  lesson: { label: '课堂讲解', icon: '📖' },
  homework: { label: '课后巩固', icon: '✏️' },
  workbook: { label: '拓展练习', icon: '📚' },
  supplement: { label: '附加题', icon: '📒' },
  pretest: { label: '课前测', icon: '📝' },
}

const LESSON_META: Array<{
  id: string
  name: string
  data: ProblemSet
  types: Array<{ tag: string; label: string }>
}> = [
  { id: '12', name: '巧算加减法进阶', data: P12, types: PT12 },
  { id: '13', name: '植树问题', data: P13, types: PT13 },
  { id: '15', name: '和差问题', data: P15, types: PT15 },
  { id: '18', name: '和差倍初步', data: P18, types: PT18 },
  { id: '23', name: '逻辑推理', data: P23, types: PT23 },
  { id: '29', name: '算符大作战', data: P29, types: PT29 },
  { id: '30', name: '和差倍进阶', data: P30, types: PT30 },
  { id: '34', name: '乘法分配律', data: P34, types: PT34 },
  { id: '35', name: '归一问题', data: P35, types: PT35 },
  { id: '36', name: '星期几问题', data: P36, types: PT36 },
  { id: '37', name: '鸡兔同笼', data: P37, types: PT37 },
  { id: '38', name: '一笔画', data: P38, types: PT38 },
  { id: '39', name: '盈亏问题', data: P39, types: PT39 },
  { id: '40', name: '周长问题', data: P40, types: PT40 },
  { id: '41', name: '间隔趣题', data: P41, types: PT41 },
  { id: '42', name: '生活智力题', data: P42, types: PT42 },
  { id: '43', name: '等差数列初识', data: P43, types: PT43 },
  { id: '44', name: '统筹优化', data: P44, types: PT44 },
  { id: '46', name: '抽屉原理与最不利', data: P46, types: PT46 },
  { id: '47', name: '方格中的秘密', data: P47, types: PT47 },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPool(lessonId: string, sections: Section[], types: string[]): QuizEntry[] {
  const meta = LESSON_META.find((l) => l.id === lessonId)
  if (!meta) return []
  const activeSections = sections.length > 0 ? sections : ALL_SECTIONS
  const entries: QuizEntry[] = []
  for (const section of activeSections) {
    const problems = meta.data[section]
    if (!problems) continue
    for (const problem of problems) {
      if (types.length > 0 && !types.includes(problem.tag)) continue
      entries.push({ problem, lessonId, section })
    }
  }
  return entries
}

function pickRandom(pool: QuizEntry[], exclude: Set<string>): QuizEntry | null {
  const candidates = pool.filter((e) => !exclude.has(e.problem.id))
  if (candidates.length === 0) return null
  return candidates[Math.floor(Math.random() * candidates.length)]
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, '')
}

function todayDateStr() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

const ALL_ENTRIES_MAP = (() => {
  const map = new Map<string, QuizEntry>()
  for (const { id, data } of LESSON_META) {
    for (const section of ALL_SECTIONS) {
      const problems = data[section]
      if (!problems) continue
      for (const p of problems) map.set(p.id, { problem: p, lessonId: id, section })
    }
  }
  return map
})()

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

// ── Main component ────────────────────────────────────────────────────────────

export default function QuizPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { solveCount } = useMathSolved(user)
  const { papers, savePaper, deletePaper, renamePaper } = useMathQuiz(user)

  // Builder state
  const [quizItems, setQuizItems] = useState<QuizItem[]>([])
  const [draftTitle, setDraftTitle] = useState('')
  const [saving, setSaving] = useState(false)

  // Inline rename state for saved papers
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'random' | 'precise'>('random')
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

  // Lessons that can be picked in the current modal mode. In random mode lessons
  // already in the draft are excluded; in precise mode every lesson is selectable
  // because individual problems are de-duplicated against the draft.
  const selectableLessons = useMemo(
    () => (modalMode === 'random' ? LESSON_META.filter((l) => !existingIds.has(l.id)) : LESSON_META),
    [modalMode, existingIds],
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
    () => (swapUid ? quizItems.find((i) => i.uid === swapUid) ?? null : null),
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

  // ── Modal handlers ────────────────────────────────────────────────────────

  function openModal(mode: 'random' | 'precise') {
    setModalMode(mode)
    setPreciseStep(1)
    setPreciseSelected(new Set())
    setModalLessons(LESSON_META.filter((l) => !existingIds.has(l.id)).map((l) => l.id))
    setModalSections([])
    setModalTypes({})
    setModalCounts({})
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

  // Random mode: pick N distinct problems per lesson at random from the filtered pool.
  function handleRandomConfirm() {
    const newItems: QuizItem[] = []
    for (const lessonId of modalLessons) {
      if (existingIds.has(lessonId)) continue
      const types = modalTypes[lessonId] ?? []
      const pool = buildPool(lessonId, modalSections, types)
      const count = Math.max(1, modalCounts[lessonId] ?? 1)
      const chosen = new Set<string>()
      for (let k = 0; k < count; k++) {
        const picked = pickRandom(pool, chosen)
        if (!picked) break // pool exhausted — fewer distinct problems than requested
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
    // Avoid duplicating any problem already in the draft (including this one).
    const used = new Set(quizItems.map((i) => i.problemId))
    const picked = pickRandom(pool, used) ?? pickRandom(pool, new Set([item.problemId]))
    if (!picked) return
    setQuizItems((prev) =>
      prev.map((i) => (i.uid === uid ? { ...i, problemId: picked.problem.id } : i)),
    )
  }

  function handleSwapPick(problemId: string) {
    if (!swapUid) return
    setQuizItems((prev) =>
      prev.map((i) => (i.uid === swapUid ? { ...i, problemId } : i)),
    )
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
                className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-indigo-400 focus:bg-white"
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
                <p className="mt-1 text-xs text-slate-400">点击「随机出题」或「精准出题」开始组卷</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {papers.map((paper) => (
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
                        <span className="text-slate-400">{paper.problems.length} 题</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-400">{formatDate(paper.createdAt)}</span>
                        <span className="text-slate-300">·</span>
                        {paper.completedAt ? (
                          <span className="font-semibold text-emerald-600">
                            {paper.score ?? 0}/{paper.totalScore} 分
                          </span>
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
                        window.open(`/math/ny/quiz/${paper.id}/print`, '_blank')
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
                ))}
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
                    {selectableLessons.every((l) => modalLessons.includes(l.id)) ? '取消全选' : '全选'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {LESSON_META.map(({ id, name }) => {
                    const alreadyIn = modalMode === 'random' && existingIds.has(id)
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
                        第{id}讲 · {name}
                        {alreadyIn ? ' ✓' : ''}
                      </button>
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
                    {modalMode === 'random' ? '数量与题型' : '题型筛选'}{' '}
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
                            {modalMode === 'random' && (
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
                                <span className="w-5 text-center text-xs font-bold tabular-nums text-slate-700">
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
                </>
              )}
            </div>

            <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-slate-100 bg-white px-5 py-4">
              {modalMode === 'random' ? (
                <>
                  <span className="text-xs text-slate-400">
                    已选 {modalLessons.length} 个课题 · 共 {modalTotal} 题
                  </span>
                  <button
                    disabled={modalLessons.length === 0}
                    onClick={handleRandomConfirm}
                    className="rounded-full bg-indigo-500 px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    确认组卷
                  </button>
                </>
              ) : preciseStep === 1 ? (
                <>
                  <span className="text-xs text-slate-400">
                    已选 {modalLessons.length} 个课题
                  </span>
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
              <h2 className="font-black text-slate-800">
                换题 · 第{swapItem.lessonId}讲
              </h2>
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
                  const usedElsewhere =
                    !isCurrent && draftProblemIds.has(entry.problem.id)
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
