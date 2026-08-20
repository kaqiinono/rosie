'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { OrbBackground, PageBreadcrumb } from '@rosie/ui'
import { useAuth, isAdminUser } from '@rosie/core'
import { useGrammarUnit } from '../hooks/useGrammarUnit'
import { useGrammarUnits } from '../hooks/useGrammarUnits'
import { useGrammarMastery } from '../hooks/useGrammarMastery'
import { useGrammarOverview } from '../hooks/useGrammarOverview'
import { BACKMATTER_ICONS } from '../grammar-toc'
import {
  grammarPageImageUrl,
  type GrammarBookId,
  type GrammarExerciseGroup,
  type GrammarFigure,
  type GrammarLesson,
  type GrammarTableBlock,
  type GrammarUnitDetail,
} from '../types'
import { LessonView } from './LessonView'
import { ExerciseView } from './ExerciseView'
import GrammarToc from './GrammarToc'
import { PagePreviewModal } from './PagePreviewModal'
import { FigureCropModal } from './FigureCropModal'
import { GrammarTableEditorModal } from './GrammarTableEditorModal'
import { GrammarExerciseEditorModal } from './GrammarExerciseEditorModal'
import { GrammarLessonEditorModal } from './GrammarLessonEditorModal'
import {
  saveGroupFigure,
  removeGroupFigure,
  saveSectionFigure,
  removeSectionFigure,
} from '../figure-mutations'
import { saveGrammarTable } from '../grammar-table-mutations'
import { saveGrammarExercises } from '../grammar-exercise-mutations'
import { saveGrammarLesson } from '../grammar-lesson-mutations'

type Tab = 'lesson' | 'exercise' | 'original'

/** 附加区域（补充练习/学习指导）的练习不计入本单元掌握度 */
const NOOP_GROUP_RESULT = () => {}

function BookPagesChip({ pages }: { pages: number[] }) {
  if (pages.length === 0) return null
  const label =
    pages.length >= 2 && pages[1] - pages[0] === pages.length - 1
      ? `p.${pages[0]}–${pages[pages.length - 1]}`
      : pages.map((p) => `p.${p}`).join(' · ')
  return (
    <span className="bg-surface text-text-muted ring-border-light inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ring-1">
      📖 原书 {label}
    </span>
  )
}

/** 以 key={`${book}:${unitNumber}`} 重挂载，目录内切单元时自动重置全部本地状态 */
export default function GrammarUnitPage({
  unitNumber,
  book = 'essential' as GrammarBookId,
}: {
  unitNumber: number
  book?: GrammarBookId
}) {
  return <GrammarUnitPageInner key={`${book}:${unitNumber}`} unitNumber={unitNumber} book={book} />
}

/**
 * 页面外壳：居中容器 + 面包屑 + 目录 + 内容槽位。
 * loading/notFound/正常三个分支共用同一结构（目录始终在居中容器内），
 * 避免加载前后布局跳变导致目录贴左缘的闪动。
 * 面包屑用 inline 变体放在容器内顶部，与内容左缘对齐（fixed 变体会贴视口左缘，
 * 宽屏时落在容器外的留白里）
 */
function UnitPageShell({
  unitNumber,
  book,
  children,
}: {
  unitNumber: number
  book: GrammarBookId
  children: ReactNode
}) {
  return (
    <>
      <OrbBackground variant="home" />
      <div className="relative z-1 mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-4 px-4 pt-5 pb-32 sm:px-6">
        <div className="w-fit">
          <PageBreadcrumb variant="inline" />
        </div>
        <div className="flex flex-1 gap-5">
          <GrammarToc currentUnit={unitNumber} book={book} />
          {children}
        </div>
      </div>
    </>
  )
}

/** 加载骨架屏：尺寸贴近真实 header + tabs + main，减小内容出现时的跳变 */
function UnitPageSkeleton() {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5">
      <div className="flex flex-col items-center gap-3">
        <div className="bg-surface/70 ring-border-light h-6 w-40 animate-pulse rounded-full ring-1" />
        <div className="bg-surface/70 ring-border-light h-8 w-64 max-w-full animate-pulse rounded-lg ring-1" />
      </div>
      <div className="bg-surface/70 ring-border-light mx-auto h-10 w-56 animate-pulse rounded-full ring-1" />
      <div className="bg-surface/70 ring-border-light h-96 animate-pulse rounded-2xl ring-1" />
    </div>
  )
}

function GrammarUnitPageInner({
  unitNumber,
  book,
}: {
  unitNumber: number
  book: GrammarBookId
}) {
  const { user } = useAuth()
  const { unit, isLoading, notFound } = useGrammarUnit(unitNumber, book)
  const { entries: overviewEntries } = useGrammarOverview(user, book)
  const { masteryMap, recordPractice } = useGrammarMastery(user)
  const [tab, setTab] = useState<Tab>('lesson')
  const [previewPage, setPreviewPage] = useState<number | null>(null)

  // 书尾延展位：补充练习/学习指导无讲解内容，加载完成后默认切到练习 tab
  const autoTabRef = useRef(0)
  useEffect(() => {
    if (!unit || autoTabRef.current === unitNumber) return
    autoTabRef.current = unitNumber
    setTab(unit.category === 'supplementary' || unit.category === 'study_guide' ? 'exercise' : 'lesson')
  }, [unit, unitNumber])

  // 锚定到本单元的补充练习/学习指导条目（迁移 0028 未应用时字段缺失，区域自动隐藏）
  const { units: suppUnits } = useGrammarUnits(unit?.suppEntries, book)
  const { units: guideUnits } = useGrammarUnits(unit?.studyGuideUnits, book)

  const isAdmin = isAdminUser(user)
  // admin 插图操作：本地 override 保证保存后立即重渲染（缓存同步由 mutations patch）
  const [unitOverride, setUnitOverride] = useState<GrammarUnitDetail | null>(null)
  // 裁切目标：练习组 or 讲解 Section（replaceIdx 有值 = 重裁替换）
  const [crop, setCrop] = useState<
    | { kind: 'group'; idx: number; url: string }
    | { kind: 'section'; idx: number; replaceIdx?: number; url: string }
    | null
  >(null)
  const [saving, setSaving] = useState(false)
  const [cropError, setCropError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<GrammarFigure | null>(null)
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: 'group'; idx: number }
    | { kind: 'section'; sectionIdx: number; figureIdx: number }
    | null
  >(null)
  const [tableEdit, setTableEdit] = useState<{ sectionIdx: number; blockIdx: number } | null>(null)
  const [lessonEditing, setLessonEditing] = useState(false)
  const [exerciseEditGroup, setExerciseEditGroup] = useState<number | null>(null)
  const [suppExerciseEdit, setSuppExerciseEdit] = useState<{
    unitNumber: number
    groupIndex: number
  } | null>(null)
  const [suppOverrides, setSuppOverrides] = useState<Map<number, GrammarUnitDetail>>(() => new Map())

  const handlePageClick = useCallback((page: number) => {
    setPreviewPage(page)
  }, [])

  const handleClosePreview = useCallback(() => {
    setPreviewPage(null)
  }, [])

  // 聚合各练习组结果：全部组上报后求和写 mastery；summary 带 unitNumber 标记，切单元时自动失效
  const groupResults = useRef<{
    unit: number
    results: Map<number, { correct: number; total: number }>
  }>({
    unit: unitNumber,
    results: new Map(),
  })
  const [summary, setSummary] = useState<{ unit: number; text: string } | null>(null)
  const reportedSummary = summary !== null && summary.unit === unitNumber ? summary.text : null

  const handleGroupResult = useCallback(
    (groupIdx: number, correct: number, total: number) => {
      if (!unit) return
      // 切单元后首次上报时重置旧结果，不在 render 阶段碰 ref
      if (groupResults.current.unit !== unitNumber) {
        groupResults.current = { unit: unitNumber, results: new Map() }
      }
      groupResults.current.results.set(groupIdx, { correct, total })
      if (groupResults.current.results.size < unit.exercises.length) return
      let sumCorrect = 0
      let sumTotal = 0
      for (const r of groupResults.current.results.values()) {
        sumCorrect += r.correct
        sumTotal += r.total
      }
      setSummary({ unit: unitNumber, text: `${sumCorrect}/${sumTotal}` })
      void recordPractice(unitNumber, sumCorrect, sumTotal, book)
    },
    [unit, recordPractice, unitNumber, book],
  )

  const handleStartCrop = useCallback(
    (groupIdx: number) => {
      const d = unitOverride ?? unit
      if (!d) return
      const group = d.exercises[groupIdx]
      const src =
        typeof group?.bookPage === 'number'
          ? d.pageImages.find((img) => img.page === group.bookPage)
          : undefined
      if (!src) return
      setCropError(null)
      // cors=1 区分缓存：同 URL 无 crossOrigin 加载过（预览/原文 tab）时，
      // 浏览器缓存的是非 CORS 响应，anonymous 模式复取会被丢弃导致加载失败
      setCrop({ kind: 'group', idx: groupIdx, url: `${grammarPageImageUrl(src.path)}?cors=1` })
    },
    [unit, unitOverride],
  )

  const handleStartSectionCrop = useCallback(
    (sectionIdx: number, replaceIdx?: number) => {
      const d = unitOverride ?? unit
      if (!d) return
      const section = d.lesson.sections[sectionIdx]
      const src =
        typeof section?.bookPage === 'number'
          ? d.pageImages.find((img) => img.page === section.bookPage)
          : undefined
      if (!src) return
      setCropError(null)
      setCrop({
        kind: 'section',
        idx: sectionIdx,
        ...(typeof replaceIdx === 'number' ? { replaceIdx } : {}),
        url: `${grammarPageImageUrl(src.path)}?cors=1`,
      })
    },
    [unit, unitOverride],
  )

  const handleCropConfirm = useCallback(
    async (blob: Blob) => {
      const d = unitOverride ?? unit
      if (!crop || !d) return
      setSaving(true)
      setCropError(null)
      try {
        const updated =
          crop.kind === 'group'
            ? await saveGroupFigure(d, crop.idx, blob, d.exercises[crop.idx]?.bookPage ?? 0)
            : await saveSectionFigure(
                d,
                crop.idx,
                blob,
                d.lesson.sections[crop.idx]?.bookPage ?? 0,
                crop.replaceIdx,
              )
        setUnitOverride(updated)
        setCrop(null)
      } catch (err) {
        setCropError(err instanceof Error ? err.message : '保存失败，请重试')
      } finally {
        setSaving(false)
      }
    },
    [crop, unit, unitOverride],
  )

  const handleConfirmDelete = useCallback(async () => {
    const d = unitOverride ?? unit
    if (!pendingDelete || !d) return
    const target = pendingDelete
    setPendingDelete(null)
    try {
      const updated =
        target.kind === 'group'
          ? await removeGroupFigure(d, target.idx)
          : await removeSectionFigure(d, target.sectionIdx, target.figureIdx)
      setUnitOverride(updated)
    } catch {
      // DB 清除失败时静默提示：下次进入页面仍显示旧插图，可再次删除
      console.warn('[grammar-figure] remove failed')
    }
  }, [pendingDelete, unit, unitOverride])

  const handleSaveTable = useCallback(
    async (table: GrammarTableBlock) => {
      const d = unitOverride ?? unit
      if (!tableEdit || !d) return
      const updated = await saveGrammarTable(d, tableEdit.sectionIdx, tableEdit.blockIdx, table)
      setUnitOverride(updated)
      setTableEdit(null)
    },
    [tableEdit, unit, unitOverride],
  )

  const handleSaveExercises = useCallback(
    async (exercises: GrammarExerciseGroup[]) => {
      const d = unitOverride ?? unit
      if (!d) return
      const updated = await saveGrammarExercises(d, exercises)
      setUnitOverride(updated)
      setExerciseEditGroup(null)
    },
    [unit, unitOverride],
  )

  const handleSaveLesson = useCallback(
    async (lesson: GrammarLesson) => {
      const d = unitOverride ?? unit
      if (!d) return
      const updated = await saveGrammarLesson(d, lesson)
      setUnitOverride(updated)
      setLessonEditing(false)
    },
    [unit, unitOverride],
  )

  const handleSaveSupplementaryExercises = useCallback(
    async (exercises: GrammarExerciseGroup[]) => {
      if (!suppExerciseEdit) return
      const source =
        suppOverrides.get(suppExerciseEdit.unitNumber) ?? suppUnits.get(suppExerciseEdit.unitNumber)
      if (!source) return
      const updated = await saveGrammarExercises(source, exercises)
      setSuppOverrides((previous) => {
        const next = new Map(previous)
        next.set(updated.unitNumber, updated)
        return next
      })
      setSuppExerciseEdit(null)
    },
    [suppExerciseEdit, suppOverrides, suppUnits],
  )

  if (isLoading) {
    return (
      <UnitPageShell unitNumber={unitNumber} book={book}>
        <UnitPageSkeleton />
      </UnitPageShell>
    )
  }

  if (notFound || !unit) {
    return (
      <UnitPageShell unitNumber={unitNumber} book={book}>
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4 pt-24 text-center">
          <div className="text-5xl">🔒</div>
          <h1 className="text-text-primary text-xl font-black">该单元尚未解锁</h1>
          <p className="text-text-secondary text-sm">内容还在提取中，先去看看其他单元吧</p>
          <Link
            href={`/english/grammar/${book}`}
            className="from-app-blue rounded-full bg-gradient-to-r to-sky-500 px-6 py-2 text-sm font-bold text-white shadow-md shadow-sky-200 transition-transform active:scale-95"
          >
            返回语法地图
          </Link>
        </div>
      </UnitPageShell>
    )
  }

  const detail = unitOverride ?? unit
  const currentRecord = masteryMap[`${detail.book}:${unitNumber}`]
  const availableUnits = overviewEntries
    .filter((entry) => !entry.locked)
    .toSorted((a, b) => a.unitNumber - b.unitNumber)
  const currentUnitIndex = availableUnits.findIndex((entry) => entry.unitNumber === unitNumber)
  const previousUnit = currentUnitIndex > 0 ? availableUnits[currentUnitIndex - 1] : undefined
  const nextUnit =
    currentUnitIndex >= 0 && currentUnitIndex < availableUnits.length - 1
      ? availableUnits[currentUnitIndex + 1]
      : undefined

  return (
    <>
      <UnitPageShell unitNumber={unitNumber} book={book}>
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <header className="text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="bg-app-blue-light text-app-blue-dark inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold">
                {detail.categoryZh || detail.category}
              </span>
              <span className="bg-surface text-text-muted ring-border-light inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1">
                难度 {'⭐'.repeat(detail.difficulty)}
              </span>
              <BookPagesChip pages={detail.bookPages} />
              {currentRecord?.mastered && (
                <span className="bg-app-green-light text-app-green-dark inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold">
                  ⭐ 已掌握
                </span>
              )}
              {(detail.suppEntries?.length ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setTab('exercise')}
                  className="bg-app-purple-light text-app-purple-dark inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-transform active:scale-95"
                  title={`锚定本单元的补充练习（${detail.suppEntries?.length} 条）`}
                >
                  ✏️ 有补充练习
                </button>
              )}
              {(detail.studyGuideUnits?.length ?? 0) > 0 && (
                <Link
                  href={`/english/grammar/${book}/study-guide#guide-${detail.studyGuideUnits?.[0]}`}
                  className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700 transition-colors hover:bg-sky-200"
                  title="跳转学习指导总览并定位到本单元相关内容"
                >
                  🧭 学习指导
                </Link>
              )}
            </div>
            <h1 className="text-text-primary mt-2 text-[clamp(24px,4.5vw,32px)] font-black">
              {/* 书尾延展位条目不显示 "Unit N" 前缀 */}
              {BACKMATTER_ICONS[detail.category] !== undefined
                ? detail.title
                : `Unit ${detail.unitNumber} · ${detail.title}`}
            </h1>
            {detail.titleZh && <p className="text-text-secondary mt-1 text-sm">{detail.titleZh}</p>}
            {/* 补充练习条目页头：对应单元 chips（直达单元页） */}
            {detail.units && detail.units.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                <span className="text-text-muted text-xs font-bold">对应单元</span>
                {detail.units.map((n) => (
                  <Link
                    key={n}
                    href={`/english/grammar/${book}/${n}`}
                    className="bg-surface text-app-blue ring-border-light hover:bg-app-blue-light rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 transition-colors"
                  >
                    Unit {n}
                  </Link>
                ))}
              </div>
            )}
          </header>

          <div className="sticky top-16 z-30 mx-auto flex rounded-full bg-surface/95 p-1 shadow-lg ring-1 ring-border-light backdrop-blur-md sm:top-3">
            {(
              [
                { id: 'lesson', label: '📖 讲解' },
                { id: 'exercise', label: '✏️ 练习' },
                { id: 'original', label: '📄 原文' },
              ] as { id: Tab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-bold transition-all sm:px-6 ${
                  tab === t.id
                    ? 'from-app-blue bg-gradient-to-r to-sky-500 text-white shadow-md shadow-sky-200'
                    : 'text-text-secondary'
                }`}
              >
                {t.label}
              </button>
            ))}
            {isAdmin && tab !== 'original' && (
              <>
                <span className="mx-1 my-1 w-px bg-border-light" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => {
                    if (tab === 'lesson') setLessonEditing(true)
                    if (tab === 'exercise') setExerciseEditGroup(0)
                  }}
                  aria-label={tab === 'lesson' ? '管理讲解' : '管理练习'}
                  className="group flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-black text-app-purple-dark transition-colors hover:bg-app-purple-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-purple sm:px-4 sm:text-sm"
                >
                  <span
                    className="transition-transform group-hover:rotate-45 motion-reduce:transform-none"
                    aria-hidden="true"
                  >
                    ⚙
                  </span>
                  <span>{tab === 'lesson' ? '管理讲解' : '管理练习'}</span>
                </button>
              </>
            )}
          </div>

          <main
            key={tab}
            className="animate-fade-up bg-surface/90 ring-border-light rounded-2xl p-4 shadow-sm ring-1 backdrop-blur-sm sm:p-6"
          >
            {tab === 'lesson' ? (
              <>
                {lessonEditing && (
                  <GrammarLessonEditorModal
                    lesson={detail.lesson}
                    onSave={handleSaveLesson}
                    onClose={() => setLessonEditing(false)}
                  />
                )}
                <LessonView
                  data={detail.lesson}
                  isAdmin={isAdmin}
                  pageImages={detail.pageImages}
                  onPageClick={handlePageClick}
                  onStartCrop={isAdmin ? handleStartSectionCrop : undefined}
                  onPreviewFigure={setLightbox}
                  onRemoveFigure={
                    isAdmin
                      ? (sectionIdx, figureIdx) =>
                          setPendingDelete({ kind: 'section', sectionIdx, figureIdx })
                      : undefined
                  }
                  onEditTable={
                    isAdmin
                      ? (sectionIdx, blockIdx) => setTableEdit({ sectionIdx, blockIdx })
                      : undefined
                  }
                />
              </>
            ) : tab === 'exercise' ? (
              <>
                {exerciseEditGroup != null && (
                  <GrammarExerciseEditorModal
                    groups={detail.exercises}
                    initialGroupIndex={exerciseEditGroup}
                    pageImages={detail.pageImages}
                    onSave={handleSaveExercises}
                    onClose={() => setExerciseEditGroup(null)}
                  />
                )}
                <div className={exerciseEditGroup != null ? 'hidden' : 'contents'}>
                <ExerciseView
                  groups={detail.exercises}
                  isAdmin={isAdmin}
                  pageImages={detail.pageImages}
                  onGroupResult={handleGroupResult}
                  onPageClick={handlePageClick}
                  onStartCrop={isAdmin ? handleStartCrop : undefined}
                  onEditGroup={isAdmin ? setExerciseEditGroup : undefined}
                  onPreviewFigure={setLightbox}
                  onRemoveFigure={
                    isAdmin ? (idx) => setPendingDelete({ kind: 'group', idx }) : undefined
                  }
                />
                {reportedSummary && (
                  <div
                    className={`mt-4 rounded-xl p-3 text-center text-sm font-bold ${
                      reportedSummary.split('/')[0] === reportedSummary.split('/')[1]
                        ? 'bg-app-green-light text-app-green-dark'
                        : 'bg-surface-dim text-text-secondary'
                    }`}
                  >
                    本单元练习 {reportedSummary}
                    {reportedSummary.split('/')[0] === reportedSummary.split('/')[1]
                      ? ' · 全部答对，已标记掌握 🎉'
                      : ' · 加油，再试一次就能全部答对！'}
                  </div>
                )}

                {/* 补充练习区域：仅展示锚定到本单元的条目（最大单元锚定规则在回写侧完成） */}
                {(detail.suppEntries?.length ?? 0) > 0 && (
                  <section className="mt-8 flex flex-col gap-4">
                    <h2 className="text-text-primary flex items-center gap-2 text-base font-black">
                      <span className="inline-block h-4 w-1 rounded-full bg-gradient-to-b from-app-purple to-pink-500" />
                      ✏️ 补充练习
                    </h2>
                    {(detail.suppEntries ?? []).map((n) => {
                      const supp = suppOverrides.get(n) ?? suppUnits.get(n)
                      if (!supp || supp.exercises.length === 0) return null
                      return (
                        <div key={n} className="flex flex-col gap-2">
                          {suppExerciseEdit?.unitNumber === n && (
                            <GrammarExerciseEditorModal
                              groups={supp.exercises}
                              initialGroupIndex={suppExerciseEdit.groupIndex}
                              pageImages={supp.pageImages}
                              onSave={handleSaveSupplementaryExercises}
                              onClose={() => setSuppExerciseEdit(null)}
                            />
                          )}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-text-secondary text-sm font-bold">
                              补充练习 · {supp.title}
                            </span>
                            {supp.units?.map((u) => (
                              <Link
                                key={u}
                                href={`/english/grammar/${book}/${u}`}
                                className="bg-surface text-app-blue ring-border-light hover:bg-app-blue-light rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 transition-colors"
                              >
                                Unit {u}
                              </Link>
                            ))}
                          </div>
                          <ExerciseView
                            groups={supp.exercises}
                            isAdmin={isAdmin}
                            pageImages={supp.pageImages}
                            onGroupResult={NOOP_GROUP_RESULT}
                            onEditGroup={
                              isAdmin
                                ? (groupIndex) => setSuppExerciseEdit({ unitNumber: n, groupIndex })
                                : undefined
                            }
                            onPreviewFigure={setLightbox}
                          />
                        </div>
                      )
                    })}
                  </section>
                )}

                {/* 学习指导区域：studyUnits 含本单元的全部题目，附出处链接 */}
                {(detail.studyGuideUnits?.length ?? 0) > 0 && (
                  <section className="mt-8 flex flex-col gap-4">
                    <h2 className="text-text-primary flex items-center gap-2 text-base font-black">
                      <span className="inline-block h-4 w-1 rounded-full bg-gradient-to-b from-sky-500 to-teal-500" />
                      🧭 学习指导
                    </h2>
                    {(detail.studyGuideUnits ?? []).map((n) => {
                      const guide = guideUnits.get(n)
                      if (!guide) return null
                      const groups = guide.exercises
                        .map((g) => ({
                          ...g,
                          items: g.items.filter((it) => it.studyUnits?.includes(unitNumber)),
                        }))
                        .filter((g) => g.items.length > 0)
                      if (groups.length === 0) return null
                      return (
                        <div key={n} className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-text-secondary text-sm font-bold">
                              {guide.title}
                            </span>
                            <Link
                              href={`/english/grammar/${book}/study-guide#guide-${n}`}
                              className="text-text-muted hover:text-app-blue text-[11px] font-bold underline-offset-2 hover:underline"
                            >
                              在总览中查看 →
                            </Link>
                          </div>
                          <ExerciseView
                            groups={groups}
                            isAdmin={false}
                            pageImages={guide.pageImages}
                            onGroupResult={NOOP_GROUP_RESULT}
                            onPreviewFigure={setLightbox}
                          />
                        </div>
                      )
                    })}
                  </section>
                )}
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-4">
                {detail.pageImages.length > 0 ? (
                  detail.pageImages.map((img) => (
                    <div key={img.path} className="flex flex-col gap-1">
                      <span className="text-text-muted text-xs font-bold">
                        p.{img.page} {img.type === 'lesson' ? '讲解页' : '练习页'}
                      </span>
                      <img
                        src={grammarPageImageUrl(img.path)}
                        alt={`原书 p.${img.page}`}
                        className="ring-border-light w-full rounded-xl ring-1"
                      />
                    </div>
                  ))
                ) : (
                  <div className="text-text-muted flex flex-col items-center gap-2 py-12">
                    <span className="text-4xl">📷</span>
                    <span className="text-sm">原文图片尚未上传</span>
                  </div>
                )}
              </div>
            )}
          </main>

          <nav
            aria-label="语法单元切换"
            className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-40 mx-auto grid max-w-3xl grid-cols-2 gap-2 rounded-2xl bg-surface/95 p-2 text-left shadow-xl ring-1 ring-border-light backdrop-blur-md sm:gap-3"
          >
            {previousUnit ? (
              <Link
                href={`/english/grammar/${book}/${previousUnit.unitNumber}`}
                className="group min-h-12 rounded-xl bg-surface-dim/60 px-3 py-2 transition-colors hover:bg-app-blue-light sm:px-4"
              >
                <span className="block text-xs font-bold text-text-muted">← 上一单元</span>
                <span className="mt-0.5 block truncate text-sm font-bold text-text-primary group-hover:text-app-blue-dark">
                  Unit {previousUnit.unitNumber} · {previousUnit.title}
                </span>
              </Link>
            ) : (
              <span className="min-h-12 rounded-xl bg-surface-dim px-3 py-2 opacity-45 sm:px-4">
                <span className="block text-xs font-bold text-text-muted">← 上一单元</span>
                <span className="mt-0.5 block text-sm font-bold text-text-muted">已经是第一个单元</span>
              </span>
            )}
            {nextUnit ? (
              <Link
                href={`/english/grammar/${book}/${nextUnit.unitNumber}`}
                className="group min-h-12 rounded-xl bg-surface-dim/60 px-3 py-2 text-right transition-colors hover:bg-app-blue-light sm:px-4"
              >
                <span className="block text-xs font-bold text-text-muted">下一单元 →</span>
                <span className="mt-0.5 block truncate text-sm font-bold text-text-primary group-hover:text-app-blue-dark">
                  Unit {nextUnit.unitNumber} · {nextUnit.title}
                </span>
              </Link>
            ) : (
              <span className="min-h-12 rounded-xl bg-surface-dim px-3 py-2 text-right opacity-45 sm:px-4">
                <span className="block text-xs font-bold text-text-muted">下一单元 →</span>
                <span className="mt-0.5 block text-sm font-bold text-text-muted">已经是最后一个单元</span>
              </span>
            )}
          </nav>
        </div>
      </UnitPageShell>

      <PagePreviewModal
        page={previewPage}
        images={detail.pageImages}
        onClose={handleClosePreview}
      />

      {tableEdit &&
        detail.lesson.sections[tableEdit.sectionIdx]?.blocks[tableEdit.blockIdx]?.type ===
          'grammar_table' && (
          <GrammarTableEditorModal
            table={detail.lesson.sections[tableEdit.sectionIdx].blocks[tableEdit.blockIdx] as GrammarTableBlock}
            onSave={handleSaveTable}
            onClose={() => setTableEdit(null)}
          />
        )}

      {crop && (
        <FigureCropModal
          imageUrl={crop.url}
          title={crop.kind === 'group' ? `裁切插图 · 第 ${crop.idx + 1} 组` : '裁切讲解插图'}
          saving={saving}
          error={cropError}
          onConfirm={(blob) => void handleCropConfirm(blob)}
          onClose={() => {
            if (!saving) {
              setCrop(null)
              setCropError(null)
            }
          }}
        />
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <div className="mx-4 max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <img
              src={grammarPageImageUrl(lightbox.path)}
              alt={`插图（原书 p.${lightbox.page}）`}
              className="max-h-[88vh] w-auto rounded-xl object-contain"
            />
          </div>
        </div>
      )}

      {pendingDelete !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="bg-surface ring-border-light mx-4 w-full max-w-xs rounded-2xl p-5 shadow-2xl ring-1"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-text-primary text-sm font-bold">删除这张插图？</p>
            <p className="text-text-secondary mt-1 text-xs">
              删除后这里将不再显示插图，可之后重新裁切。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPendingDelete(null)}
                className="text-text-secondary ring-border-light hover:bg-surface-dim rounded-full px-4 py-1.5 text-sm font-bold ring-1"
              >
                取消
              </button>
              <button
                onClick={() => void handleConfirmDelete()}
                className="bg-app-red rounded-full px-4 py-1.5 text-sm font-bold text-white"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
