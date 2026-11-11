'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@rosie/core'
import { useChineseBookLessons } from '../../hooks/useChineseBookLessons'
import { useChineseRoadmapPlan } from '../../hooks/useChineseRoadmapPlan'
import { CHINESE_BOOKS, getChineseBook, type ChineseBookSlug } from '../../utils/chinese-books'
import { getLessonDisplayInfo, sortLessonsPedagogically } from '../../utils/chinese-lesson-display'
import {
  CHINESE_PLAN_QUIZ_TYPES,
  type ChinesePlanQuizType,
  type ChineseRoadmapPlan,
  type ChineseRoadmapPlanLessonRun,
} from '../../utils/chineseRoadmapPlanTypes'
import ChinesePlanRoadmapPreview from './ChinesePlanRoadmapPreview'
import {
  PLAN_QUIZ_TYPE_LABELS,
  clampK,
  fmtPlanDateTime,
  formatPlanRunByType,
  planRunTypeLabel,
  planStatusLabel,
} from './chinese-roadmap-plan-shared'
import { FormSelect } from '@rosie/ui'
import { Button, TextField } from '@rosie/ui/themes'

type Props = {
  editPlanId?: string
}

function toggleQuizType(
  current: ChinesePlanQuizType[],
  type: ChinesePlanQuizType,
): ChinesePlanQuizType[] {
  if (current.includes(type)) {
    return current.filter((t) => t !== type)
  }
  // 阅读题已含填空回想：选中阅读题时去掉填空，避免重复
  let next = [...current, type]
  if (type === 'passage') next = next.filter((t) => t !== 'blank')
  if (type === 'blank' && next.includes('passage')) return current
  return CHINESE_PLAN_QUIZ_TYPES.filter((t) => next.includes(t))
}

function accuracyLabel(run: ChineseRoadmapPlanLessonRun): string {
  if (run.accuracy == null) return `${run.correct}/${run.total}`
  const pct = run.accuracy <= 1 ? Math.round(run.accuracy * 100) : Math.round(run.accuracy)
  return `${pct}%（${run.correct}/${run.total}）`
}

export default function ChineseRoadmapPlanEditor({ editPlanId }: Props) {
  const router = useRouter()
  const { user } = useAuth()
  const {
    plans,
    isLoading: plansLoading,
    createPlan,
    savePlan,
    pausePlan,
    activatePlan,
    loadRunsForPlan,
    runsByPlanId,
  } = useChineseRoadmapPlan(user)

  const isEdit = !!editPlanId
  const existingPlan = useMemo(
    () => (editPlanId ? (plans.find((p) => p.id === editPlanId) ?? null) : null),
    [editPlanId, plans],
  )

  const [bookSlug, setBookSlug] = useState<ChineseBookSlug | null>(
    () => existingPlan?.bookSlug ?? CHINESE_BOOKS[0]?.slug ?? null,
  )
  const [title, setTitle] = useState('')
  const [titleTouched, setTitleTouched] = useState(false)
  const [startLessonKey, setStartLessonKey] = useState('')
  const [currentLessonKey, setCurrentLessonKey] = useState('')
  const [lessonsPerBatch, setLessonsPerBatch] = useState(1)
  const [quizTypes, setQuizTypes] = useState<ChinesePlanQuizType[]>([...CHINESE_PLAN_QUIZ_TYPES])
  const [activateNow, setActivateNow] = useState(true)
  const [hydratedPlanId, setHydratedPlanId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [selectedRunLessonKey, setSelectedRunLessonKey] = useState<string | null>(null)
  const [runsLoading, setRunsLoading] = useState(false)

  const effectiveBookSlug: ChineseBookSlug | null = isEdit
    ? (existingPlan?.bookSlug ?? null)
    : bookSlug

  const {
    lessons,
    lessonGroups,
    isLoading: lessonsLoading,
  } = useChineseBookLessons(effectiveBookSlug)

  const selectableLessons = useMemo(() => {
    const ordered = sortLessonsPedagogically(lessons).filter(
      (l) => l.lessonKind !== 'happy_reading',
    )
    return ordered.map((lesson) => {
      const unitLessons = lessons.filter((l) => l.unit === lesson.unit)
      const display = getLessonDisplayInfo(lesson, unitLessons)
      return { lesson, label: display.label }
    })
  }, [lessons])

  const bookMeta = effectiveBookSlug ? getChineseBook(effectiveBookSlug) : null
  const defaultTitle = bookMeta ? `${bookMeta.label}计划` : '语文计划'

  // Hydrate edit form once plan is available
  useEffect(() => {
    if (!isEdit || !existingPlan) return
    if (hydratedPlanId === existingPlan.id) return
    setBookSlug(existingPlan.bookSlug)
    setTitle(existingPlan.title)
    setTitleTouched(true)
    setStartLessonKey(existingPlan.startLessonKey)
    setCurrentLessonKey(existingPlan.currentLessonKey)
    setLessonsPerBatch(existingPlan.lessonsPerBatch)
    setQuizTypes([...existingPlan.quizTypes])
    setSelectedRunLessonKey(existingPlan.currentLessonKey)
    setHydratedPlanId(existingPlan.id)
  }, [isEdit, existingPlan, hydratedPlanId])

  // Default start lesson when creating / book changes
  useEffect(() => {
    if (isEdit) return
    if (selectableLessons.length === 0) {
      setStartLessonKey('')
      return
    }
    setStartLessonKey((prev) =>
      selectableLessons.some((item) => item.lesson.lessonKey === prev)
        ? prev
        : selectableLessons[0].lesson.lessonKey,
    )
  }, [isEdit, selectableLessons])

  // Keep default title in sync until user edits it
  useEffect(() => {
    if (isEdit || titleTouched) return
    setTitle(defaultTitle)
  }, [isEdit, titleTouched, defaultTitle])

  // Load runs for edit mode
  useEffect(() => {
    if (!isEdit || !editPlanId || !user) return
    let cancelled = false
    setRunsLoading(true)
    void loadRunsForPlan(editPlanId)
      .catch((err) => {
        console.error('[chinese_roadmap_plan] loadRuns failed', err)
      })
      .finally(() => {
        if (!cancelled) setRunsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isEdit, editPlanId, user, loadRunsForPlan])

  const selectedRuns = useMemo(() => {
    if (!selectedRunLessonKey) return []
    const planRuns = editPlanId ? (runsByPlanId[editPlanId] ?? []) : []
    return planRuns.filter((run) => run.lessonKey === selectedRunLessonKey)
  }, [editPlanId, runsByPlanId, selectedRunLessonKey])

  const canSubmit =
    !isSubmitting &&
    !plansLoading &&
    !lessonsLoading &&
    !!effectiveBookSlug &&
    quizTypes.length > 0 &&
    (isEdit ? !!existingPlan && !!currentLessonKey : !!startLessonKey)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit || !effectiveBookSlug) return
    setIsSubmitting(true)
    setFormError(null)
    try {
      if (isEdit && existingPlan) {
        const next: ChineseRoadmapPlan = {
          ...existingPlan,
          title: title.trim() || defaultTitle,
          currentLessonKey,
          lessonsPerBatch: clampK(lessonsPerBatch),
          quizTypes,
        }
        await savePlan(next)
        router.push('/setting/plans/chinese')
        return
      }

      await createPlan({
        title: title.trim() || defaultTitle,
        bookSlug: effectiveBookSlug,
        startLessonKey,
        lessonsPerBatch: clampK(lessonsPerBatch),
        quizTypes,
        activateNow,
      })
      router.push('/setting/plans/chinese')
    } catch (err) {
      console.error('[chinese_roadmap_plan] save failed', err)
      setFormError('保存失败，请检查网络后重试。')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePause = async () => {
    if (!existingPlan) return
    setTogglingStatus(true)
    try {
      await pausePlan(existingPlan.id)
    } catch (err) {
      console.error('[chinese_roadmap_plan] pause failed', err)
      window.alert('暂停失败，请检查网络后重试。')
    } finally {
      setTogglingStatus(false)
    }
  }

  const handleActivate = async () => {
    if (!existingPlan) return
    const hasOtherActive = plans.some((p) => p.status === 'active' && p.id !== existingPlan.id)
    if (hasOtherActive && !window.confirm('恢复此计划将暂停当前进行中的计划，确定继续？')) {
      return
    }
    setTogglingStatus(true)
    try {
      await activatePlan(existingPlan.id)
    } catch (err) {
      console.error('[chinese_roadmap_plan] activate failed', err)
      window.alert('恢复失败，请检查网络后重试。')
    } finally {
      setTogglingStatus(false)
    }
  }

  if (isEdit && plansLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[14px] font-bold text-amber-600">
        加载中…
      </div>
    )
  }

  if (isEdit && !plansLoading && !existingPlan) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-10 text-center">
        <p className="text-[14px] font-bold text-slate-600">未找到该计划（可能已归档）。</p>
        <Button
          type="button"
          onClick={() => router.push('/setting/plans/chinese')}
          variant="soft"
          color="amber"
          size="2"
          className="mt-4"
        >
          返回列表
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 py-6">
      <form
        onSubmit={(e) => {
          void handleSubmit(e)
        }}
        className="flex flex-col gap-5"
      >
        <div>
          <h1 className="text-[20px] font-extrabold text-amber-900">
            {isEdit ? '编辑语文计划' : '新建语文计划'}
          </h1>
          <p className="mt-1 text-[12px] text-gray-500">
            {isEdit
              ? '教材创建后不可更换；可调整标题、当前关、每批关数与题型'
              : '选择教材与起始关后创建；教材创建后不可改'}
          </p>
        </div>

        {/* Book */}
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-extrabold text-amber-900">教材</span>
          {isEdit ? (
            <div
              className="rounded-xl px-3.5 py-2.5 text-[14px] font-bold text-slate-700"
              style={{
                background: 'rgba(255,248,240,0.9)',
                border: '1.5px solid rgba(245,158,11,.25)',
              }}
            >
              {bookMeta?.label ?? existingPlan?.bookSlug}
              <span className="ml-2 text-[11px] font-semibold text-slate-400">（不可更改）</span>
            </div>
          ) : (
            <FormSelect
              value={bookSlug ?? ''}
              onValueChange={(value) => {
                const next = value as ChineseBookSlug
                setBookSlug(next)
                if (!titleTouched) {
                  const meta = getChineseBook(next)
                  if (meta) setTitle(`${meta.label}计划`)
                }
              }}
              options={CHINESE_BOOKS.filter((b) => b.isOpen).map((book) => ({
                value: book.slug,
                label: book.label,
              }))}
              ariaLabel="教材"
              size="2"
              className="w-full"
            />
          )}
        </label>

        {/* Title */}
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-extrabold text-amber-900">标题</span>
          <TextField.Root
            type="text"
            value={title}
            onChange={(e) => {
              setTitleTouched(true)
              setTitle(e.target.value)
            }}
            placeholder={defaultTitle}
            size="2"
            className="w-full"
          />
        </label>

        {/* Start / current lesson */}
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-extrabold text-amber-900">
            {isEdit ? '当前关' : '起始关'}
          </span>
          {lessonsLoading ? (
            <div className="rounded-xl border border-dashed border-amber-200 px-3.5 py-2.5 text-[13px] text-amber-700/70">
              加载课文…
            </div>
          ) : selectableLessons.length === 0 ? (
            <div className="rounded-xl border border-dashed border-amber-200 px-3.5 py-2.5 text-[13px] text-amber-700/70">
              该册暂无可用课文
            </div>
          ) : (
            <FormSelect
              value={isEdit ? currentLessonKey : startLessonKey}
              onValueChange={(value) => {
                if (isEdit) {
                  setCurrentLessonKey(value)
                  setSelectedRunLessonKey(value)
                } else {
                  setStartLessonKey(value)
                }
              }}
              options={selectableLessons.map(({ lesson, label }) => ({
                value: lesson.lessonKey,
                label: `第${lesson.unit}单元 · ${label}`,
              }))}
              ariaLabel={isEdit ? '当前关' : '起始关'}
              size="2"
              className="w-full"
            />
          )}
        </label>

        {/* K */}
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-extrabold text-amber-900">
            每批关数 K（1–10）
          </span>
          <TextField.Root
            type="number"
            min={1}
            max={10}
            value={lessonsPerBatch}
            onChange={(e) => setLessonsPerBatch(clampK(Number(e.target.value)))}
            size="2"
            className="w-28"
          />
        </label>

        {/* Quiz types */}
        <fieldset>
          <legend className="mb-2 text-[12px] font-extrabold text-amber-900">题型</legend>
          <div className="flex flex-wrap gap-2">
            {CHINESE_PLAN_QUIZ_TYPES.map((type) => {
              const on = quizTypes.includes(type)
              const disabled = type === 'blank' && quizTypes.includes('passage')
              return (
                <Button
                  key={type}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return
                    setQuizTypes((prev) => toggleQuizType(prev, type))
                  }}
                  variant={on ? 'solid' : 'soft'}
                  color="amber"
                  size="1"
                  radius="full"
                >
                  {PLAN_QUIZ_TYPE_LABELS[type]}
                </Button>
              )
            })}
          </div>
          {quizTypes.includes('passage') && (
            <p className="mt-1.5 text-[11px] font-semibold text-amber-900/45">填空已含在阅读题中</p>
          )}
          {quizTypes.length === 0 && (
            <p className="mt-1.5 text-[11px] font-semibold text-red-500">请至少选择一种题型</p>
          )}
        </fieldset>

        {!isEdit && (
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={activateNow}
              onChange={(e) => setActivateNow(e.target.checked)}
              className="h-4 w-4 accent-amber-600"
            />
            <span className="text-[13px] font-bold text-slate-700">
              创建后立即激活
              <span className="ml-1 text-[11px] font-semibold text-slate-400">
                （若已有进行中计划将先暂停对方）
              </span>
            </span>
          </label>
        )}

        {isEdit && existingPlan && (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[12px] font-extrabold ${
                existingPlan.status === 'active'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : existingPlan.status === 'paused'
                    ? 'border-kid-line bg-slate-50 text-slate-600'
                    : 'border-blue-300 bg-blue-50 text-blue-700'
              }`}
            >
              {planStatusLabel(existingPlan.status)}
            </span>
            {existingPlan.status === 'active' && (
              <Button
                type="button"
                disabled={togglingStatus}
                onClick={() => {
                  void handlePause()
                }}
                variant="outline"
                color="gray"
                size="2"
              >
                {togglingStatus ? '处理中…' : '暂停'}
              </Button>
            )}
            {existingPlan.status === 'paused' && (
              <Button
                type="button"
                disabled={togglingStatus}
                onClick={() => {
                  void handleActivate()
                }}
                variant="soft"
                color="jade"
                size="2"
              >
                {togglingStatus ? '处理中…' : '恢复'}
              </Button>
            )}
          </div>
        )}

        {isEdit && existingPlan && effectiveBookSlug && (
          <div className="grid gap-4 md:grid-cols-2">
            <ChinesePlanRoadmapPreview
              plan={{
                completedLessonKeys: existingPlan.completedLessonKeys,
                currentLessonKey: currentLessonKey || existingPlan.currentLessonKey,
              }}
              bookSlug={effectiveBookSlug}
              lessons={lessons}
              lessonGroups={lessonGroups}
              selectedLessonKey={selectedRunLessonKey}
              onSelectLesson={setSelectedRunLessonKey}
            />
            <div className="rounded-2xl border border-amber-200/80 bg-white px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <span className="text-[12px] font-extrabold text-amber-900">关卡练习记录</span>
                {runsLoading && (
                  <span className="text-[11px] font-bold text-amber-600">加载中…</span>
                )}
              </div>
              {!selectedRunLessonKey ? (
                <p className="px-1 py-4 text-center text-[12px] text-slate-400">
                  点选左侧关卡查看记录
                </p>
              ) : selectedRuns.length === 0 ? (
                <p className="px-1 py-4 text-center text-[12px] text-slate-400">该关暂无练习记录</p>
              ) : (
                <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto pr-1">
                  {selectedRuns.map((run) => (
                    <div
                      key={run.id}
                      className="border-kid-line rounded-xl border-2 bg-slate-50/80 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-extrabold text-slate-700">
                          {fmtPlanDateTime(run.finishedAt)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                            run.completed
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {run.completed ? '已完成' : '未完成'}
                        </span>
                        {run.source && run.source !== 'plan' && (
                          <span className="border-kid-line rounded-full border-2 bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                            {run.source === 'free'
                              ? '自由练习'
                              : run.source === 'review'
                                ? '复习'
                                : run.source}
                          </span>
                        )}
                        {run.durationSeconds != null && run.durationSeconds > 0 && (
                          <span className="text-[10px] font-semibold text-slate-400">
                            {run.durationSeconds < 60
                              ? `${run.durationSeconds}秒`
                              : `${Math.floor(run.durationSeconds / 60)}分${run.durationSeconds % 60 > 0 ? `${run.durationSeconds % 60}秒` : ''}`}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[12px] font-bold text-slate-500">
                        正确率 {accuracyLabel(run)}
                      </div>
                      {(() => {
                        const byTypeRows = formatPlanRunByType(run.byType)
                        if (byTypeRows.length === 0) {
                          return run.quizTypes.length > 0 ? (
                            <div className="mt-0.5 text-[11px] text-slate-400">
                              {run.quizTypes.map((t) => planRunTypeLabel(t)).join(' · ')}
                            </div>
                          ) : null
                        }
                        return (
                          <ul className="mt-1.5 flex flex-col gap-0.5">
                            {byTypeRows.map((row) => (
                              <li
                                key={row.key}
                                className="flex items-center justify-between gap-2 text-[11px] text-slate-500"
                              >
                                <span>{row.label}</span>
                                <span className="tabular-nums">
                                  {row.correct}/{row.total}
                                  {row.accuracyPct != null ? ` · ${row.accuracyPct}%` : ''}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {formError && <p className="text-[13px] font-bold text-red-500">{formError}</p>}

        <div className="flex flex-wrap gap-3 pt-1">
          <Button type="submit" disabled={!canSubmit} variant="solid" color="amber" size="2">
            {isSubmitting ? '保存中…' : isEdit ? '保存修改' : '创建计划'}
          </Button>
          <Button
            type="button"
            onClick={() => router.push('/setting/plans/chinese')}
            variant="outline"
            color="gray"
            size="2"
          >
            取消
          </Button>
        </div>
      </form>
    </div>
  )
}
