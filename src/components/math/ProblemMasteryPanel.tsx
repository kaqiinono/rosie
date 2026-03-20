'use client'

import { useState } from 'react'
import type { MathPlanProblem, ProblemMasteryMap } from '@/utils/type'
import { ensureStageInit, isGraduated, MASTERY_ICON, getMasteryLevel } from '@/utils/masteryUtils'

interface Props {
  problems: MathPlanProblem[]
  masteryMap: ProblemMasteryMap
}

const SECTION_LABEL: Record<string, string> = {
  lesson: '课堂',
  homework: '课后',
  workbook: '练习册',
  pretest: '课前测',
}

function formatDue(nextReviewDate: string | undefined, today: string) {
  if (!nextReviewDate) return { label: '—', urgent: 'none' as const }
  const diff = Math.floor((Date.parse(nextReviewDate) - Date.parse(today)) / 86400000)
  const [, m, d] = nextReviewDate.split('-')
  const dateStr = `${Number(m)}/${Number(d)}`
  if (diff <= 0) return { label: `今天 (${dateStr})`, urgent: 'today' as const }
  if (diff === 1) return { label: `明天 (${dateStr})`, urgent: 'tomorrow' as const }
  return { label: `${diff}天后 (${dateStr})`, urgent: 'future' as const }
}

export default function ProblemMasteryPanel({ problems, masteryMap }: Props) {
  const [open, setOpen] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  const rows = problems
    .filter(p => masteryMap[p.key] !== undefined)
    .map(p => {
      const raw = masteryMap[p.key]!
      const m = ensureStageInit(raw, today)
      const graduated = isGraduated(m)
      const due = graduated ? { label: '已毕业', urgent: 'none' as const } : formatDue(m.nextReviewDate, today)
      return { p, m, graduated, due }
    })
    .sort((a, b) => {
      if (a.graduated && !b.graduated) return 1
      if (!a.graduated && b.graduated) return -1
      const da = a.m.nextReviewDate ?? '9999-12-31'
      const db = b.m.nextReviewDate ?? '9999-12-31'
      return da.localeCompare(db)
    })

  const hardCount = rows.filter(r => r.m.isHard && !r.graduated).length
  const graduatedCount = rows.filter(r => r.graduated).length

  return (
    <div className="mx-auto max-w-[640px] px-4 pb-8">
      <div className="border border-gray-200 rounded-[14px] overflow-hidden bg-white">

        {/* Header / toggle */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="text-[15px]">📊</span>
            <span className="text-text-primary text-[13px] font-bold">题目学习状态</span>
            <span className="bg-gray-100 text-text-muted text-[10px] font-bold px-2 py-0.5 rounded-full">
              {rows.length} 道题
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hardCount > 0 && (
              <span className="bg-red-50 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-100">
                🔥 {hardCount} 难题
              </span>
            )}
            {graduatedCount > 0 && (
              <span className="bg-green-50 text-green-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-100">
                ✓ {graduatedCount} 毕业
              </span>
            )}
            <svg
              className={`transition-transform duration-200 text-text-muted ${open ? 'rotate-180' : ''}`}
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
            >
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </div>
        </button>

        {/* Table */}
        {open && (
          <div className="overflow-x-auto border-t border-gray-200">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left text-[10px] font-bold text-text-muted tracking-wider">题目</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-text-muted tracking-wider">类型</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-text-muted tracking-wider">阶段</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-text-muted tracking-wider">下次复习</th>
                  <th className="px-4 py-2 text-center text-[10px] font-bold text-text-muted tracking-wider">状态</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, m, graduated, due }) => {
                  const level = getMasteryLevel(m.correct ?? 0)
                  return (
                    <tr
                      key={p.key}
                      className="border-t border-gray-100"
                      style={{ opacity: graduated ? 0.6 : 1 }}
                    >
                      <td className="px-4 py-2 font-medium max-w-[180px] truncate" style={{ color: graduated ? '#16a34a' : undefined }}>
                        {p.title}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-text-muted whitespace-nowrap">
                        第{p.lessonId}讲 · {SECTION_LABEL[p.section] ?? p.section}
                      </td>
                      <td className="px-3 py-2 text-center text-text-muted">
                        {graduated ? '🦋' : MASTERY_ICON[level]} {m.stage ?? 0}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {due.urgent === 'today' && (
                          <span className="bg-red-50 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded-full">{due.label}</span>
                        )}
                        {due.urgent === 'tomorrow' && (
                          <span className="bg-orange-50 text-orange-500 text-[10px] font-bold px-2 py-0.5 rounded-full">{due.label}</span>
                        )}
                        {due.urgent === 'future' && (
                          <span className="text-text-muted text-[10px] font-bold">{due.label}</span>
                        )}
                        {due.urgent === 'none' && (
                          <span className="text-green-600 text-[10px] font-bold">{due.label}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {graduated ? (
                          <span className="text-green-600 text-[10px] font-bold">✓ 毕业</span>
                        ) : m.isHard ? (
                          <span className="text-red-500 text-[10px] font-bold">🔥 难</span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-text-muted text-[12px]">
                      还没有练习记录 — 完成题目后这里会显示状态
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}
