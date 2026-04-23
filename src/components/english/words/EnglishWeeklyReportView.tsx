import type { EnglishWeeklyReport } from '@/utils/type'

const LEVEL_LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: '新接触',
  1: '起步',
  2: '巩固中',
  3: '熟练',
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

type Props = {
  report: EnglishWeeklyReport
  completedAtLabel: string
  className?: string
}

export default function EnglishWeeklyReportView({ report, completedAtLabel, className = '' }: Props) {
  return (
    <div className={`text-[.88rem] leading-relaxed text-[var(--wm-text)] ${className}`}>
      <div className="mb-4">
        <h1 className="font-fredoka text-2xl text-[var(--wm-text)]">周计划结课报告</h1>
        <p className="mt-1 text-[.75rem] text-[var(--wm-text-dim)]">
          {report.weekRangeLabel} · 标记于 {completedAtLabel}
        </p>
        <p className="mt-0.5 text-[.7rem] text-[var(--wm-text-dim)]">报告生成 {formatWhen(report.generatedAt)}</p>
      </div>

      <p className="mb-4 rounded-[12px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-3 py-2.5 text-[.82rem] font-bold text-[#fbbf24]">
        {report.unitLessonLabel}
      </p>

      <h2 className="mb-2 text-[.72rem] font-extrabold tracking-widest text-[#93c5fd] uppercase">
        执行概览
      </h2>
      <ul className="mb-5 list-inside list-disc space-y-1.5 text-[.82rem] text-[var(--wm-text-dim)]">
        <li>学习日（排期内）：{report.execution.daysInWeek} 天</li>
        <li>已做日测并打卡：{report.execution.daysWithQuiz} 天（约 {report.execution.dayCompletionRatePercent}%）</li>
        <li>
          有分数记录时的日均分：
          {report.execution.averageQuizScore !== null
            ? `${report.execution.averageQuizScore} 分`
            : '暂无'}
        </li>
        <li>高分日（≥90%）{report.execution.highScoreDays} 天；低分日（低于 60%）{report.execution.lowScoreDays} 天</li>
      </ul>

      <h2 className="mb-2 text-[.72rem] font-extrabold tracking-widest text-[#93c5fd] uppercase">
        按日记录
      </h2>
      <div className="mb-5 space-y-2">
        {report.byDay.map((d) => (
          <div
            key={d.date}
            className="flex flex-wrap items-baseline justify-between gap-2 rounded-[10px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-3 py-2"
          >
            <span className="font-bold text-[var(--wm-text)]">
              {d.displayDate} {d.weekdayLabel}
            </span>
            <span className="text-[.8rem] text-[var(--wm-text-dim)]">
              {d.hadSession ? `已测${d.lastScore !== null ? ` · ${d.lastScore}%` : ''}` : '未测'}
            </span>
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-[.72rem] font-extrabold tracking-widest text-[#93c5fd] uppercase">
        词汇结构
      </h2>
      <ul className="mb-5 list-inside list-disc space-y-1.5 text-[.82rem] text-[var(--wm-text-dim)]">
        <li>本计划词位（去重后）约 {report.vocabulary.totalPlanWordKeys} 个</li>
        <li>必记 {report.vocabulary.consolidateCount} 个；预习 {report.vocabulary.previewCount} 个</li>
        <li>必记中达到巩固线（阶段 2+）约 {report.vocabulary.consolidateMet} 个</li>
        <li>排期上每日新词位：{report.vocabulary.newWordSlotsPerDay} 个/天</li>
      </ul>

      {report.spotlightWords.length > 0 && (
        <>
          <h2 className="mb-2 text-[.72rem] font-extrabold tracking-widest text-[#a78bfa] uppercase">
            词汇亮点（按阶段）
          </h2>
          <div className="mb-5 flex flex-wrap gap-1.5">
            {report.spotlightWords.map((w, i) => (
              <span
                key={`${w.word}-${w.kind}-${i}`}
                className={`rounded-full border px-2.5 py-1 text-[.75rem] font-bold ${
                  w.kind === 'consolidate'
                    ? 'border-[rgba(96,165,250,.35)] text-[#93c5fd]'
                    : 'border-[rgba(249,115,22,.35)] text-[#fb923c]'
                }`}
              >
                {w.word}
                <span className="ml-1 opacity-70">
                  {w.kind === 'consolidate' ? '必记' : '预习'} · 阶段{w.stage} · {LEVEL_LABEL[w.level]}
                </span>
              </span>
            ))}
          </div>
        </>
      )}

      <h2 className="mb-2 text-[.72rem] font-extrabold tracking-widest text-[#4ade80] uppercase">
        综合评述
      </h2>
      <div className="mb-5 space-y-3 text-[.82rem] text-[var(--wm-text-dim)]">
        {report.narrative.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <h2 className="mb-2 text-[.72rem] font-extrabold tracking-widest text-[#f59e0b] uppercase">
        后续建议
      </h2>
      <ol className="mb-6 list-decimal space-y-2 pl-5 text-[.82rem] text-[var(--wm-text-dim)]">
        {report.suggestions.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  )
}
