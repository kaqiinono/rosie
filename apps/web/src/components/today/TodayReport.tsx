'use client'

import { useEffect, useMemo } from 'react'
import { useAuth, todayStr } from '@rosie/core'
import { useWeeklyPlan, useAdaptiveTodayProgress } from '@rosie/english'
import { useMathWeeklyPlan } from '@rosie/math-kit/hooks/useMathWeeklyPlan'
import { isPlanProblemDone } from '@rosie/math-kit/utils/math-helpers'
import { useCalcDaily } from '@rosie/calc'
import {
  useChineseRoadmapProgress,
  useChineseRoadmapPlan,
  setActiveChineseBook,
  formatPlanRunByType,
  planRunTypeLabel,
} from '@rosie/chinese'

function formatDuration(sec: number | null | undefined): string {
  if (sec == null || sec < 0) return '—'
  if (sec < 60) return `${sec}秒`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${m}分${s}秒` : `${m}分钟`
}

function SubjectHeader({ icon, title, color }: { icon: string; title: string; color: string }) {
  return (
    <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: `${color}33` }}>
      <span className="text-lg">{icon}</span>
      <h2 className="text-[15px] font-extrabold" style={{ color }}>
        {title}
      </h2>
    </div>
  )
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="font-bold" style={{ color: color ?? '#334155' }}>
        {value}
      </span>
    </div>
  )
}

export default function TodayReport() {
  const { user } = useAuth()
  const today = todayStr()

  // ── English ──
  const { weeklyPlan: englishPlan } = useWeeklyPlan(user)
  const {
    activePlan: activeAdaptive,
    summary: adaptiveToday,
  } = useAdaptiveTodayProgress(user)
  const englishToday = englishPlan?.days.find((d) => d.date === today)
  const englishProgress = englishPlan?.progress[today]
  const newWordKeys = englishToday?.newWordKeys ?? []
  const englishDone = !!englishProgress?.quizDone

  // ── Math ──
  const { weeklyPlan: mathPlan } = useMathWeeklyPlan(user)
  const mathToday = mathPlan?.days.find((d) => d.date === today)
  const mathProgress = mathPlan?.progress[today] ?? { doneKeys: [] }
  const mathProblems = mathToday?.problems ?? []
  const mathDoneCount = mathProblems.filter((p) => isPlanProblemDone(p, today, mathProgress.doneKeys)).length

  // ── Calc ──
  const calcDaily = useCalcDaily(user)

  // ── Chinese ──
  const chinese = useChineseRoadmapProgress(user)
  const {
    activePlan: chineseActivePlan,
    completedPlan: chineseCompletedPlan,
    loadRunsForPlan,
    runsByPlanId,
  } = useChineseRoadmapPlan(user)
  const chineseFocusPlan = chineseActivePlan ?? chineseCompletedPlan

  useEffect(() => {
    if (chineseFocusPlan) {
      setActiveChineseBook(chineseFocusPlan.bookSlug)
      void loadRunsForPlan(chineseFocusPlan.id)
    }
  }, [chineseFocusPlan, loadRunsForPlan])

  const chineseTodayRuns = useMemo(() => {
    if (!chineseFocusPlan) return []
    const runs = runsByPlanId[chineseFocusPlan.id] ?? []
    return runs.filter((r) => r.finishedAt.startsWith(today))
  }, [chineseFocusPlan, runsByPlanId, today])

  // ── Aggregated stats ──
  const totalDuration = useMemo(() => {
    let sec = 0
    for (const run of chineseTodayRuns) {
      if (run.durationSeconds != null) sec += run.durationSeconds
    }
    // Math attempts don't have duration, calc has session-level data
    // English doesn't track duration yet
    return sec
  }, [chineseTodayRuns])

  const subjectsPracticed = useMemo(() => {
    const list: string[] = []
    if (chineseTodayRuns.length > 0) list.push('语文')
    if (englishDone || (activeAdaptive && (adaptiveToday?.done ?? 0) > 0)) list.push('英语')
    if (mathDoneCount > 0) list.push('数学')
    if (calcDaily.todayDone > 0) list.push('口算')
    return list
  }, [chineseTodayRuns, englishDone, activeAdaptive, adaptiveToday, mathDoneCount, calcDaily.todayDone])

  // ── Date label ──
  const dateLabel = useMemo(() => {
    const d = new Date()
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return `${months[d.getMonth()]}${d.getDate()}日 ${days[d.getDay()]}`
  }, [])

  const hasAnyPractice = subjectsPracticed.length > 0

  return (
    <div className="mx-auto max-w-[640px] px-4 py-6">
      {/* Summary header */}
      <div className="mb-6 rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
        <div className="text-[11px] font-bold uppercase tracking-widest text-amber-600/80">
          今日练习报告
        </div>
        <div className="mt-1 text-[18px] font-extrabold text-slate-900">{dateLabel}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 shadow-sm">
            练习科目 {subjectsPracticed.length}/4
          </span>
          {totalDuration > 0 && (
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 shadow-sm">
              总时长 {formatDuration(totalDuration)}
            </span>
          )}
          {subjectsPracticed.length === 4 && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              全部完成
            </span>
          )}
        </div>
      </div>

      {!hasAnyPractice && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div className="text-3xl">📝</div>
          <p className="mt-2 text-[14px] font-bold text-slate-600">今天还没有练习记录</p>
          <p className="mt-1 text-[12px] text-slate-400">完成练习后这里会显示详细报告</p>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {/* ── 语文 ── */}
        {chineseTodayRuns.length > 0 && (
          <div className="rounded-2xl border border-emerald-200/60 bg-white p-4">
            <SubjectHeader icon="📘" title="语文" color="#059669" />
            <div className="mt-3 flex flex-col gap-2">
              {chineseTodayRuns.map((run) => {
                const byTypeRows = formatPlanRunByType(run.byType)
                return (
                  <div key={run.id} className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-bold text-emerald-900">
                        {run.lessonTitle || run.lessonKey}
                      </span>
                      {run.completed && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          已完成
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-col gap-1">
                      <StatRow
                        label="正确率"
                        value={run.accuracy != null ? `${Math.round(run.accuracy * 100)}%` : `${run.correct}/${run.total}`}
                        color="#059669"
                      />
                      {run.durationSeconds != null && run.durationSeconds > 0 && (
                        <StatRow label="练习时长" value={formatDuration(run.durationSeconds)} />
                      )}
                    </div>
                    {byTypeRows.length > 0 && (
                      <div className="mt-2.5 border-t border-emerald-100 pt-2">
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-emerald-600/70">
                          题型分项
                        </div>
                        <div className="flex flex-col gap-1">
                          {byTypeRows.map((row) => (
                            <div key={row.key} className="flex items-center justify-between text-[11px]">
                              <span className="font-medium text-emerald-800">{row.label}</span>
                              <span className="tabular-nums font-semibold text-emerald-700">
                                {row.correct}/{row.total}
                                {row.accuracyPct != null ? ` (${row.accuracyPct}%)` : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {run.finishedPhases.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {run.finishedPhases.map((phase) => (
                          <span
                            key={phase}
                            className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700"
                          >
                            {planRunTypeLabel(phase)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── 英语 ── */}
        {(englishDone || (activeAdaptive && (adaptiveToday?.done ?? 0) > 0)) && (
          <div className="rounded-2xl border border-teal-200/60 bg-white p-4">
            <SubjectHeader icon="📖" title="英语" color="#0d9488" />
            <div className="mt-3 flex flex-col gap-1.5">
              {activeAdaptive ? (
                <>
                  <StatRow
                    label="今日单词"
                    value={`${adaptiveToday?.done ?? 0}/${adaptiveToday?.total ?? activeAdaptive.newWordsPerDay}`}
                    color="#0d9488"
                  />
                  {adaptiveToday?.allDone && (
                    <StatRow label="状态" value="已完成" color="#059669" />
                  )}
                </>
              ) : (
                <>
                  <StatRow label="今日新词" value={`${newWordKeys.length} 个`} color="#0d9488" />
                  <StatRow label="测验" value={englishDone ? '已完成' : '未完成'} color={englishDone ? '#059669' : '#94a3b8'} />
                </>
              )}
            </div>
          </div>
        )}

        {/* ── 数学 ── */}
        {mathDoneCount > 0 && (
          <div className="rounded-2xl border border-orange-200/60 bg-white p-4">
            <SubjectHeader icon="📐" title="数学" color="#c2410c" />
            <div className="mt-3 flex flex-col gap-1.5">
              <StatRow
                label="今日题目"
                value={`${mathDoneCount}/${mathProblems.length}`}
                color="#c2410c"
              />
              {mathDoneCount >= mathProblems.length && mathProblems.length > 0 && (
                <StatRow label="状态" value="全部完成" color="#059669" />
              )}
            </div>
          </div>
        )}

        {/* ── 口算 ── */}
        {calcDaily.todayDone > 0 && (
          <div className="rounded-2xl border border-violet-200/60 bg-white p-4">
            <SubjectHeader icon="🧮" title="口算" color="#7c3aed" />
            <div className="mt-3 flex flex-col gap-1.5">
              <StatRow
                label="今日完成"
                value={`${calcDaily.todayDone}/${calcDaily.todayTarget} 题`}
                color="#7c3aed"
              />
              <StatRow
                label="正确率"
                value={calcDaily.todayDone > 0 ? `${Math.round((calcDaily.todayCorrect / calcDaily.todayDone) * 100)}%` : '—'}
                color="#7c3aed"
              />
              {calcDaily.todayCoins > 0 && (
                <StatRow label="获得星星" value={`${calcDaily.todayCoins} ⭐`} color="#eab308" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {hasAnyPractice && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-center text-[11px] text-slate-400">
          报告自动生成于练习完成后 · {dateLabel}
        </div>
      )}
    </div>
  )
}
