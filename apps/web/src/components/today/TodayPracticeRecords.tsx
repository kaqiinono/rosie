'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  useAuth,
  todayStr,
  getTodayPlanSyncStatus,
  PRACTICE_PENDING_CHANGED_EVENT,
  type TodayPlanSyncStatus,
} from '@rosie/core'
import {
  useWeeklyPlan,
  useAdaptiveTodayProgress,
  useWordMastery,
  useWordData,
  findWordByKey,
} from '@rosie/english'
import { useMathWeeklyPlan } from '@rosie/math/hooks/useMathWeeklyPlan'
import { useMathTodayAttempts } from '@rosie/math/hooks/useMathTodayAttempts'
import { lessonDisplayLabel } from '@rosie/math'
import { fetchScratchDraft } from '@rosie/math/utils/math-scratch-db'
import ScratchPadContentPreview from '@rosie/math/components/shared/ScratchPad/ScratchPadContentPreview'
import { useCalcTodaySessions } from '@rosie/calc'
import {
  useChineseRoadmapProgress,
  useChineseRoadmapPlan,
  chineseRoute,
  setActiveChineseBook,
  buildChinesePlanPracticeHref,
  currentBatchLessonKeys,
  orderedPlanLessonKeys,
} from '@rosie/chinese'

function formatClock(iso: string | null | undefined): string | null {
  if (!iso) return null
  // Date-only YYYY-MM-DD — no wall-clock time stored
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function formatDuration(sec: number | null | undefined): string {
  if (sec == null || sec < 0) return '—'
  if (sec < 60) return `${sec}秒`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${m}分${s}秒` : `${m}分`
}

function sectionLabel(section: string): string {
  const map: Record<string, string> = {
    lesson: '例题',
    homework: '练习',
    pretest: '前测',
    workbook: '练习册',
    supplement: '补充',
    sea: '题海',
  }
  return map[section] ?? section
}

function SubjectSection({
  icon,
  title,
  tone,
  children,
  footer,
}: {
  icon: string
  title: string
  tone: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg" aria-hidden>
          {icon}
        </span>
        <h2 className="text-[15px] font-extrabold" style={{ color: tone }}>
          {title}
        </h2>
      </div>
      {children}
      {footer ? <div className="mt-3 border-t border-slate-100 pt-3">{footer}</div> : null}
    </section>
  )
}

function PendingBanner({
  sync,
  href,
  savedHint,
}: {
  sync: TodayPlanSyncStatus
  href: string
  savedHint?: string
}) {
  if (sync === 'none') return null
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2">
      <div className="text-[12px] font-bold text-amber-900">
        <span className="mr-1.5 rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
          进行中
        </span>
        {sync === 'unsynced' ? '本机有未完成进度（未全部备份）' : '有未完成进度（已备份）'}
        {savedHint ? <span className="ml-1 font-semibold text-amber-800/80">· {savedHint}</span> : null}
      </div>
      <Link
        href={href}
        className="rounded-full bg-amber-600 px-3 py-1 text-[11px] font-bold text-white no-underline"
      >
        继续练习 →
      </Link>
    </div>
  )
}

function EmptyLine() {
  return <p className="py-2 text-center text-[12px] font-medium text-slate-400">今天还没有练习记录</p>
}

function LoadingLine() {
  return <p className="py-2 text-center text-[12px] font-medium text-slate-400">加载中…</p>
}

function MathDraftPreview({ draftId }: { draftId: string }) {
  const [objects, setObjects] = useState<
    import('@rosie/math/components/shared/ScratchPad/scratch-pad-types').ScratchObject[] | null
  >(null)

  useEffect(() => {
    void fetchScratchDraft(draftId).then((d) => setObjects(d?.objects ?? []))
  }, [draftId])

  if (!objects) return <p className="p-2 text-[11px] text-slate-400">加载中…</p>
  if (objects.length === 0) return <p className="p-2 text-[11px] text-slate-400">无画布内容</p>
  return <ScratchPadContentPreview objects={objects} />
}

export default function TodayPracticeRecords() {
  const { user } = useAuth()
  const today = todayStr()
  // Lazy init — avoid setState inside effect (react-hooks/set-state-in-effect).
  const [syncBySubject, setSyncBySubject] = useState(getTodayPlanSyncStatus)

  const refreshSync = useCallback(() => {
    setSyncBySubject(getTodayPlanSyncStatus())
  }, [])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshSync()
    }
    window.addEventListener('storage', refreshSync)
    window.addEventListener(PRACTICE_PENDING_CHANGED_EVENT, refreshSync)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('storage', refreshSync)
      window.removeEventListener(PRACTICE_PENDING_CHANGED_EVENT, refreshSync)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [refreshSync])

  // ── Calc ──
  const { sessions: calcSessions, isLoading: calcLoading } = useCalcTodaySessions(user)

  // ── English ──
  const { weeklyPlan: englishPlan, isLoading: englishPlanLoading } = useWeeklyPlan(user)
  const {
    activePlan: activeAdaptive,
    summary: adaptiveToday,
    isLoading: adaptiveLoading,
  } = useAdaptiveTodayProgress(user)
  const { masteryMap, isLoading: masteryLoading } = useWordMastery(user)
  const { vocab, isLoading: vocabLoading } = useWordData(user)

  const englishProgress = englishPlan?.progress[today]
  const englishDay = englishPlan?.days.find((d) => d.date === today)
  const englishContinueHref = activeAdaptive
    ? adaptiveToday?.allDone
      ? `/english/words/adaptive/${activeAdaptive.id}`
      : `/english/words/adaptive/${activeAdaptive.id}/practice`
    : englishPlan?.id
      ? englishProgress?.quizDone
        ? `/english/words/weekly/${englishPlan.id}`
        : `/english/words/weekly/${englishPlan.id}/practice`
      : '/english/words/daily'
  const englishReportHref =
    englishPlan?.id && englishPlan.weekCompletion
      ? `/english/words/weekly/${englishPlan.id}/report`
      : null

  const todayWordReviews = useMemo(() => {
    const rows: {
      id: string
      word: string
      gloss: string
      correct: boolean
      source?: string
    }[] = []
    let i = 0
    for (const [key, info] of Object.entries(masteryMap)) {
      const history = info.reviewHistory ?? []
      for (const rec of history) {
        if (rec.date !== today) continue
        const entry = findWordByKey(vocab, key)
        rows.push({
          id: `${key}-${i++}`,
          word: entry?.word ?? key.split('::').pop() ?? key,
          gloss: entry?.chineseDef || entry?.explanation || '',
          correct: rec.correct,
          source: rec.source,
        })
      }
    }
    return rows
  }, [masteryMap, vocab, today])

  // ── Math ──
  const { weeklyPlan: mathPlan, isLoading: mathPlanLoading } = useMathWeeklyPlan(user)
  const { attempts: mathAttempts, isLoading: mathAttemptsLoading } = useMathTodayAttempts(user)
  const mathToday = mathPlan?.days.find((d) => d.date === today)
  const mathProgress = mathPlan?.progress[today] ?? { doneKeys: [] }
  const mathProblems = mathToday?.problems ?? []
  const mathDoneCount = mathProblems.filter((p) => mathProgress.doneKeys.includes(p.key)).length
  const [mathPreviewId, setMathPreviewId] = useState<string | null>(null)

  // ── Chinese ──
  const chinese = useChineseRoadmapProgress(user)
  const {
    activePlan: chineseActivePlan,
    loadRunsForPlan,
    runsByPlanId,
    isLoading: chinesePlanLoading,
  } = useChineseRoadmapPlan(user)

  useEffect(() => {
    if (chineseActivePlan) {
      setActiveChineseBook(chineseActivePlan.bookSlug)
      void loadRunsForPlan(chineseActivePlan.id)
    }
  }, [chineseActivePlan, loadRunsForPlan])

  const chineseOrderedKeys = useMemo(
    () =>
      orderedPlanLessonKeys(
        chinese.lessons,
        chineseActivePlan?.bookSlug ?? chinese.bookSlug,
      ),
    [chinese.lessons, chineseActivePlan?.bookSlug, chinese.bookSlug],
  )
  const chineseBatchKeys = useMemo(() => {
    if (!chineseActivePlan) return []
    return currentBatchLessonKeys(
      chineseOrderedKeys,
      chineseActivePlan.currentLessonKey,
      chineseActivePlan.lessonsPerBatch,
      new Set(chineseActivePlan.completedLessonKeys),
    )
  }, [chineseActivePlan, chineseOrderedKeys])

  const chineseRuns = chineseActivePlan
    ? (runsByPlanId[chineseActivePlan.id] ?? [])
    : []
  const chineseLatestRun = chineseActivePlan
    ? (chineseRuns.find((r) => r.lessonKey === chineseActivePlan.currentLessonKey) ??
      chineseRuns[0] ??
      null)
    : null
  const chinesePlanLesson = chineseActivePlan
    ? (chinese.lessons.find((l) => l.lessonKey === chineseActivePlan.currentLessonKey) ?? null)
    : null

  const chineseContinueHref =
    chineseActivePlan?.status === 'completed'
      ? '/chinese/weekly'
      : chineseActivePlan && chineseBatchKeys.length > 0
        ? buildChinesePlanPracticeHref(chineseActivePlan, chineseBatchKeys)
        : chinese.currentNode
          ? `/chinese/chars/practice?lessons=${encodeURIComponent(chinese.currentNode.lessonKey)}`
          : chineseRoute(chinese.bookSlug, 'daily')

  const englishLoading =
    englishPlanLoading || masteryLoading || vocabLoading || (!englishPlan && adaptiveLoading)
  const mathLoading = mathPlanLoading || mathAttemptsLoading
  const chineseLoading =
    chinesePlanLoading || (chinese.isCharDataLoading && !chinese.isCharDataReady)

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 pb-16">
      <p className="px-0.5 text-[12px] font-medium text-slate-500">
        查看今天四科练习的完成时间、状态、对错与得分；数学可看草稿，口算可打开统计报告。
      </p>

      {/* 口算 */}
      <SubjectSection
        icon="🧮"
        title="口算"
        tone="#7c3aed"
        footer={
          <Link
            href="/calc/report"
            className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3.5 py-1.5 text-[12px] font-bold text-violet-800 no-underline transition-opacity hover:opacity-80"
          >
            查看统计报告 →
          </Link>
        }
      >
        <PendingBanner sync={syncBySubject.calc} href="/calc/session?mode=daily" />
        {calcLoading ? (
          <LoadingLine />
        ) : calcSessions.length === 0 ? (
          <EmptyLine />
        ) : (
          <ul className="flex flex-col gap-2">
            {calcSessions.map((s) => {
              const total =
                (s.correct_count ?? 0) + (s.retry_count ?? 0) + (s.wrong_count ?? 0)
              const ok = (s.correct_count ?? 0) + (s.retry_count ?? 0)
              const accuracy = total > 0 ? Math.round((ok / total) * 100) : 0
              const clock = formatClock(s.finished_at)
              return (
                <li
                  key={s.id}
                  className="rounded-xl border border-violet-100 bg-violet-50/40 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[13px] font-bold text-violet-900">
                      {clock ? `${clock} 完成` : '已完成'}
                      <span className="ml-2 text-[11px] font-semibold text-violet-700/80">
                        {s.mode === 'daily' ? '每日练习' : s.mode ?? '练习'}
                      </span>
                    </div>
                    <span className="rounded-full bg-violet-600/90 px-2 py-0.5 text-[11px] font-extrabold text-white">
                      {accuracy}%
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-violet-800/80">
                    对 {s.correct_count ?? 0} · 重试 {s.retry_count ?? 0} · 错 {s.wrong_count ?? 0}
                    <span className="mx-1.5">·</span>
                    用时 {formatDuration(s.time_spent_sec)}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </SubjectSection>

      {/* 英语 */}
      <SubjectSection
        icon="📖"
        title="英语词汇"
        tone="#2563eb"
        footer={
          englishReportHref ? (
            <Link
              href={englishReportHref}
              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-[12px] font-bold text-blue-800 no-underline transition-opacity hover:opacity-80"
            >
              查看周报 →
            </Link>
          ) : (
            <Link
              href={englishContinueHref}
              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-[12px] font-bold text-blue-800 no-underline transition-opacity hover:opacity-80"
            >
              去练习 →
            </Link>
          )
        }
      >
        <PendingBanner sync={syncBySubject.english} href={englishContinueHref} />
        {englishLoading ? (
          <LoadingLine />
        ) : (
          <>
            {englishPlan ? (
              <div className="mb-2 rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2.5">
                <div className="text-[13px] font-bold text-blue-900">
                  周计划今日
                  {englishProgress?.quizDone ? (
                    <span className="ml-2 text-emerald-700">已完成</span>
                  ) : (
                    <span className="ml-2 text-slate-500">未完成</span>
                  )}
                </div>
                <div className="mt-1 text-[11px] font-medium text-blue-800/80">
                  新词 {(englishDay?.newWordKeys ?? []).length} 个
                  {englishProgress?.lastScore !== undefined && (
                    <>
                      <span className="mx-1.5">·</span>
                      得分 {englishProgress.lastScore}%
                    </>
                  )}
                  {englishProgress?.completedAt && (
                    <>
                      <span className="mx-1.5">·</span>
                      {formatClock(englishProgress.completedAt) ?? englishProgress.completedAt}
                    </>
                  )}
                  {englishProgress?.consolidateScore !== undefined && (
                    <>
                      <span className="mx-1.5">·</span>
                      必记 {englishProgress.consolidateScore}%
                    </>
                  )}
                  {englishProgress?.previewScore !== undefined && (
                    <>
                      <span className="mx-1.5">·</span>
                      预习 {englishProgress.previewScore}%
                    </>
                  )}
                </div>
              </div>
            ) : activeAdaptive && adaptiveToday ? (
              <div className="mb-2 rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2.5">
                <div className="text-[13px] font-bold text-blue-900">
                  自适应计划
                  {adaptiveToday.allDone ? (
                    <span className="ml-2 text-emerald-700">今日目标完成</span>
                  ) : (
                    <span className="ml-2 text-slate-500">进行中</span>
                  )}
                </div>
                <div className="mt-1 text-[11px] font-medium text-blue-800/80">
                  新词 {adaptiveToday.done}/{adaptiveToday.total}
                  <span className="mx-1.5">·</span>
                  {adaptiveToday.subtitle}
                </div>
              </div>
            ) : null}

            {todayWordReviews.length === 0 ? (
              !englishPlan && !activeAdaptive ? (
                <EmptyLine />
              ) : (
                <p className="py-1 text-center text-[11px] font-medium text-slate-400">
                  今天还没有词汇对错记录
                </p>
              )
            ) : (
              <ul className="flex flex-col gap-1.5">
                {todayWordReviews.map((r) => (
                  <li
                    key={r.id}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] ${
                      r.correct
                        ? 'border-emerald-100 bg-emerald-50/60'
                        : 'border-rose-100 bg-rose-50/60'
                    }`}
                  >
                    <span aria-hidden>{r.correct ? '✓' : '✗'}</span>
                    <span className="font-bold text-slate-800">{r.word}</span>
                    {r.gloss ? (
                      <span className="truncate text-[11px] text-slate-500">{r.gloss}</span>
                    ) : null}
                    {r.source === 'recall' ? (
                      <span className="ml-auto shrink-0 text-[10px] font-semibold text-slate-400">
                        课文回忆
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </SubjectSection>

      {/* 数学 */}
      <SubjectSection
        icon="📐"
        title="数学"
        tone="#d97706"
        footer={
          <Link
            href={
              mathPlan && mathProblems.length > 0 && mathDoneCount >= mathProblems.length
                ? '/math/ny/plan'
                : '/math/ny/plan/practice'
            }
            className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-[12px] font-bold text-amber-900 no-underline transition-opacity hover:opacity-80"
          >
            打开周计划 →
          </Link>
        }
      >
        <PendingBanner
          sync={syncBySubject.math}
          href={
            mathPlan && mathProblems.length > 0 && mathDoneCount >= mathProblems.length
              ? '/math/ny/plan'
              : '/math/ny/plan/practice'
          }
        />
        {mathPlan && mathProblems.length > 0 && (
          <div className="mb-2 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2.5">
            <div className="text-[13px] font-bold text-amber-900">
              今日计划 {mathDoneCount}/{mathProblems.length}
              {mathProgress.completedAt ? (
                <span className="ml-2 text-[11px] font-semibold text-amber-800/80">
                  · {formatClock(mathProgress.completedAt) ?? '已完成'}
                </span>
              ) : null}
            </div>
          </div>
        )}
        {mathLoading ? (
          <LoadingLine />
        ) : mathAttempts.length === 0 ? (
          <EmptyLine />
        ) : (
          <ul className="flex flex-col gap-2">
            {mathAttempts.map((a) => {
              const expanded = mathPreviewId === a.id
              const clock = formatClock(a.attemptedAt)
              return (
                <li
                  key={a.id}
                  className={`rounded-xl border px-3 py-2.5 ${
                    a.correct
                      ? 'border-slate-200 bg-white'
                      : 'border-rose-200 bg-rose-50/40'
                  }`}
                >
                  <div className="flex flex-wrap items-start gap-2">
                    <span aria-hidden>{a.correct ? '✅' : '❌'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-slate-800">
                        {lessonDisplayLabel(a.lessonId, true)}
                        <span className="ml-1.5 text-[11px] font-semibold text-slate-500">
                          {sectionLabel(a.section)}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium text-slate-500">
                        {a.correct ? '做对' : '做错'}
                        {clock ? ` · ${clock}` : null}
                        <span className="ml-1.5 font-mono text-[10px] text-slate-400">
                          {a.problemId}
                        </span>
                      </div>
                    </div>
                    {a.draftId && (
                      <button
                        type="button"
                        onClick={() => setMathPreviewId(expanded ? null : a.id)}
                        className="cursor-pointer rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700"
                      >
                        {expanded ? '收起' : '📝 草稿'}
                      </button>
                    )}
                  </div>
                  {expanded && a.draftId && (
                    <div className="mt-2 overflow-hidden rounded-lg border border-slate-100 bg-slate-50/50">
                      {!a.correct && (
                        <p className="border-b border-rose-100 bg-rose-50 px-2.5 py-1.5 text-[10px] font-semibold text-rose-700">
                          这次做错了，仅供参考演算过程
                        </p>
                      )}
                      <div className="p-1">
                        <MathDraftPreview draftId={a.draftId} />
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </SubjectSection>

      {/* 语文 */}
      <SubjectSection
        icon="📘"
        title="语文"
        tone="#059669"
        footer={
          <Link
            href={chineseContinueHref}
            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-[12px] font-bold text-emerald-800 no-underline transition-opacity hover:opacity-80"
          >
            去练习 →
          </Link>
        }
      >
        <PendingBanner sync={syncBySubject.chinese} href={chineseContinueHref} />
        {chineseLoading ? (
          <LoadingLine />
        ) : (
          <div className="flex flex-col gap-2">
            {chineseLatestRun ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5">
                <div className="text-[13px] font-bold text-emerald-900">
                  {chinesePlanLesson?.lessonTitle ?? chineseLatestRun.lessonKey}
                  {chineseLatestRun.completed ? (
                    <span className="ml-2 text-emerald-700">已完成</span>
                  ) : (
                    <span className="ml-2 text-slate-500">未完成</span>
                  )}
                </div>
                <div className="mt-1 text-[11px] font-medium text-emerald-800/80">
                  {chineseLatestRun.accuracy != null && (
                    <>正确率 {Math.round(chineseLatestRun.accuracy * 100)}%</>
                  )}
                  {chineseLatestRun.accuracy == null && chineseLatestRun.total > 0 && (
                    <>
                      {chineseLatestRun.correct}/{chineseLatestRun.total}
                    </>
                  )}
                  {chineseLatestRun.finishedAt && (
                    <>
                      <span className="mx-1.5">·</span>
                      {formatClock(chineseLatestRun.finishedAt) ?? chineseLatestRun.finishedAt}
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {chineseActivePlan ? (
              <div className="rounded-xl border border-emerald-100 bg-white px-3 py-2.5">
                <div className="text-[13px] font-bold text-emerald-900">
                  {chineseActivePlan.status === 'completed'
                    ? '计划通关'
                    : (chinesePlanLesson?.lessonTitle ?? chineseActivePlan.currentLessonKey)}
                </div>
                <div className="mt-1 text-[11px] font-medium text-emerald-800/80">
                  {chineseActivePlan.status === 'completed'
                    ? chineseActivePlan.title
                    : `本批 ${chineseBatchKeys.length} 关 · ${chineseActivePlan.title}`}
                </div>
              </div>
            ) : chinese.hasChinese ? (
              <div className="rounded-xl border border-emerald-100 bg-white px-3 py-2.5">
                <div className="text-[13px] font-bold text-emerald-900">
                  {chinese.allDone
                    ? '本册通关'
                    : chinese.lessonDone
                      ? '本关完成'
                      : (chinese.currentNode?.lessonTitle ?? '当前关卡')}
                </div>
                <div className="mt-1 text-[11px] font-medium text-emerald-800/80">
                  {chinese.allDone
                    ? chinese.bookLabel
                    : `${chinese.done}/${chinese.total} · ${chinese.bookLabel}`}
                </div>
              </div>
            ) : !chineseLatestRun ? (
              <EmptyLine />
            ) : null}
          </div>
        )}
      </SubjectSection>
    </div>
  )
}
