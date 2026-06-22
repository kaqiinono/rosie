'use client'

import { fmtDate } from '@/utils/english-helpers'
import type { WeeklyReportWordRow } from '@/utils/weeklyReportWordRows'
import { MASTERY_ICON, wordLevelName } from '@/utils/weeklyReportWordRows'

type Props = { rows: WeeklyReportWordRow[] }

function nextReviewLabel(r: WeeklyReportWordRow): string {
  if (r.isGraduated) return '已毕业'
  if (!r.nextReviewDate) return '—'
  const d = fmtDate(r.nextReviewDate)
  if (r.daysToNextReview === null) return d
  if (r.daysToNextReview > 0) return `${d}（剩 ${r.daysToNextReview} 天）`
  if (r.daysToNextReview === 0) return `${d}（今天）`
  return `${d}（已逾期 ${-r.daysToNextReview} 天）`
}

export default function EnglishWeeklyReportWordTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-[.82rem] text-[var(--wm-text-dim)]">本计划未包含排期新词，暂无单词行。</p>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] border-separate border-spacing-0 text-left text-[.78rem]">
          <thead>
            <tr className="text-[.62rem] font-extrabold tracking-wider text-[#93c5fd] uppercase">
              <th className="sticky left-0 z-[1] border-b border-r border-[var(--wm-border)] bg-[var(--wm-surface2)] px-2 py-2.5">
                单词
              </th>
              <th className="border-b border-[var(--wm-border)] px-2 py-2.5">类型</th>
              <th className="border-b border-[var(--wm-border)] px-2 py-2.5">判题次</th>
              <th className="border-b border-[var(--wm-border)] px-2 py-2.5">答对 / 错</th>
              <th className="border-b border-[var(--wm-border)] px-2 py-2.5">正确率</th>
              <th className="border-b border-[var(--wm-border)] px-2 py-2.5">复习轮次</th>
              <th className="border-b border-[var(--wm-border)] px-2 py-2.5">SRS 阶段</th>
              <th className="border-b border-[var(--wm-border)] px-2 py-2.5">熟练度</th>
              <th className="border-b border-[var(--wm-border)] px-2 py-2.5">难词</th>
              <th className="border-b border-[var(--wm-border)] px-2 py-2.5 min-w-[10.5rem]">下次复习</th>
              <th className="border-b border-[var(--wm-border)] px-2 py-2.5">最近练习</th>
              <th className="border-b border-[var(--wm-border)] px-2 py-2.5">本周日测分</th>
              <th className="border-b border-[var(--wm-border)] px-2 py-2.5">首次排期</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.key}
                className="border-b border-[var(--wm-border)] text-[var(--wm-text-dim)] hover:bg-[var(--wm-surface2)]"
              >
                <td className="sticky left-0 z-[1] border-r border-[var(--wm-border)] bg-[var(--wm-surface2)] px-2 py-2.5 font-bold text-[var(--wm-text)]">
                  {r.word}
                </td>
                <td className="px-2 py-2.5">
                  <span
                    className={r.kind === 'consolidate' ? 'text-[#93c5fd]' : 'text-[#fb923c]'}
                  >
                    {r.kind === 'consolidate' ? '必记' : '预习'}
                  </span>
                </td>
                <td className="px-2 py-2.5 font-mono tabular-nums text-[#fbbf24]">
                  {r.totalGrades}
                </td>
                <td className="px-2 py-2.5 font-mono tabular-nums">
                  {r.correct} / {r.incorrect}
                </td>
                <td className="px-2 py-2.5">
                  {r.accuracyPercent !== null ? (
                    <span
                      className={
                        r.accuracyPercent >= 80
                          ? 'text-[#4ade80]'
                          : r.accuracyPercent >= 50
                            ? 'text-[#fbbf24]'
                            : 'text-[#f87171]'
                      }
                    >
                      {r.accuracyPercent}%
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-2 py-2.5 font-mono tabular-nums">
                  {r.reviewRounds}
                </td>
                <td className="px-2 py-2.5 font-mono text-[.8rem]">
                  {r.isGraduated ? '—' : r.stage}
                </td>
                <td className="px-2 py-2.5">
                  {r.level > 0 && <span className="mr-1 text-[.75rem]">{MASTERY_ICON[r.level]}</span>}
                  {wordLevelName(r.level)}
                </td>
                <td className="px-2 py-2.5">
                  {r.isHard ? <span className="text-[#f87171]">是</span> : '否'}
                </td>
                <td className="px-2 py-2.5 text-[.72rem] leading-snug text-[#a78bfa]">
                  {nextReviewLabel(r)}
                </td>
                <td className="px-2 py-2.5 text-[.75rem]">
                  {r.lastSeen ? fmtDate(r.lastSeen.slice(0, 10)) : '—'}
                </td>
                <td className="px-2 py-2.5">
                  {r.lastScore !== null ? (
                    <span className="font-mono font-bold text-[#93c5fd]">{r.lastScore}%</span>
                  ) : r.didQuiz ? (
                    '已测'
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-2 py-2.5 text-[.75rem]">
                  {fmtDate(r.firstScheduledDay)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-4 space-y-1.5 text-[.7rem] leading-relaxed text-[var(--wm-text-dim)]">
        <li>
          <span className="font-bold text-[var(--wm-text)]">判题次、答对/错、正确率、复习轮次、SRS、难词、下次复习、最近练习</span>
          来自全 App 的单词掌握度（与词库/练习页一致）；会随你继续学习而更新。
        </li>
        <li>
          <span className="font-bold text-[var(--wm-text)]">判题次</span>
          为各题「判分」累加总次数；正确率 = 答对 /（答对+答错）。
        </li>
        <li>
          <span className="font-bold text-[var(--wm-text)]">复习轮次</span>
          为间隔复习记录条数；未触发过时为 0。
        </li>
        <li>
          <span className="font-bold text-[var(--wm-text)]">本周日测分</span>
          为「你完成当日整套日测」的分数，覆盖当日会话中所有词（同一张成绩单）。
        </li>
        <li>已毕业 = SRS 已达成毕业阶段，不再排下次复习日。</li>
      </ul>
    </div>
  )
}
