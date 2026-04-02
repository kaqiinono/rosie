'use client'

import { useState } from 'react'
import type { WordEntry, WordMasteryMap } from '@/utils/type'
import { wordKey } from '@/utils/english-helpers'
import { ensureStageInit, isGraduated, MASTERY_ICON, getWordMasteryLevel } from '@/utils/masteryUtils'

interface MasteryStatusPanelProps {
  vocab: WordEntry[]
  masteryMap: WordMasteryMap
}

function formatDue(nextReviewDate: string | undefined, today: string): { label: string; urgent: 'today' | 'tomorrow' | 'future' | 'none' } {
  if (!nextReviewDate) return { label: '—', urgent: 'none' }
  const diff = Math.floor((Date.parse(nextReviewDate) - Date.parse(today)) / 86400000)
  if (diff <= 0) return { label: '今天', urgent: 'today' }
  if (diff === 1) return { label: '明天', urgent: 'tomorrow' }
  return { label: `${diff}天后`, urgent: 'future' }
}

export default function MasteryStatusPanel({ vocab, masteryMap }: MasteryStatusPanelProps) {
  const [open, setOpen] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  // Only words with mastery records
  const rows = vocab
    .filter(w => masteryMap[wordKey(w)] !== undefined)
    .map(w => {
      const key = wordKey(w)
      const raw = masteryMap[key]!
      const m = ensureStageInit(raw, today)
      const graduated = isGraduated(m)
      const due = graduated ? { label: '已毕业', urgent: 'none' as const } : formatDue(m.nextReviewDate, today)
      return { w, m, graduated, due }
    })
    .sort((a, b) => {
      // Graduated words go last
      if (a.graduated && !b.graduated) return 1
      if (!a.graduated && b.graduated) return -1
      // Sort by nextReviewDate ascending (overdue first)
      const da = a.m.nextReviewDate ?? '9999-12-31'
      const db = b.m.nextReviewDate ?? '9999-12-31'
      return da.localeCompare(db)
    })

  const hardCount = rows.filter(r => r.m.isHard && !r.graduated).length
  const graduatedCount = rows.filter(r => r.graduated).length

  return (
    <div className="px-4 pb-8">
      <div className="border border-[var(--wm-border)] rounded-[14px] overflow-hidden">

        {/* Header / toggle */}
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[var(--wm-surface)] hover:bg-[var(--wm-surface2)] transition-colors text-left cursor-pointer border-0"
        >
          <div className="flex items-center gap-2">
            <span className="text-[15px]">📊</span>
            <span className="text-[var(--wm-text)] text-[13px] font-bold font-nunito">词汇学习状态</span>
            <span className="bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] text-[10px] font-bold px-2 py-0.5 rounded-full">
              {rows.length} 个词
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hardCount > 0 && (
              <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                🔥 {hardCount} 难词
              </span>
            )}
            {graduatedCount > 0 && (
              <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                ✓ {graduatedCount} 毕业
              </span>
            )}
            <svg
              className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              style={{ color: 'var(--wm-text-dim)' }}
            >
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </div>
        </button>

        {/* Table */}
        {open && (
          <div className="overflow-x-auto border-t border-[var(--wm-border)]">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-[var(--wm-surface)]">
                  <th className="px-4 py-2 text-left text-[10px] font-bold text-[var(--wm-text-dim)] tracking-wider">单词</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-[var(--wm-text-dim)] tracking-wider">课程</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-[var(--wm-text-dim)] tracking-wider">阶段</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-[var(--wm-text-dim)] tracking-wider">下次复习</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-[var(--wm-text-dim)] tracking-wider">复习记录</th>
                  <th className="px-4 py-2 text-center text-[10px] font-bold text-[var(--wm-text-dim)] tracking-wider">状态</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ w, m, graduated, due }) => {
                  const level = getWordMasteryLevel(m.correct ?? 0)
                  return (
                    <tr
                      key={wordKey(w)}
                      className="border-t border-[var(--wm-border)]"
                      style={{ opacity: graduated ? 0.6 : 1 }}
                    >
                      <td className="px-4 py-2 font-bold" style={{ color: graduated ? '#4ade80' : 'var(--wm-text)' }}>
                        {w.word}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-[var(--wm-text-dim)]">
                        {w.unit.replace(/\D+(\d+)/, 'U$1')} {w.lesson.replace(/\D+(\d+)/, 'L$1')}
                      </td>
                      <td className="px-3 py-2 text-center text-[var(--wm-text-dim)]">
                        {graduated ? '🦋' : MASTERY_ICON[level]} {m.stage ?? 0}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {due.urgent === 'today' && (
                          <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{due.label}</span>
                        )}
                        {due.urgent === 'tomorrow' && (
                          <span className="bg-orange-500/20 text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{due.label}</span>
                        )}
                        {due.urgent === 'future' && (
                          <span className="text-[var(--wm-text-dim)] text-[10px] font-bold">{due.label}</span>
                        )}
                        {due.urgent === 'none' && (
                          <span className="text-green-400 text-[10px] font-bold">{due.label}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-0.5 flex-wrap">
                          {(m.reviewHistory ?? []).slice(-12).map((r, i) => (
                            <span
                              key={i}
                              title={`${r.date} ${r.correct ? '✓' : '✗'}`}
                              className={`w-2 h-2 rounded-full ${r.correct ? 'bg-green-400' : 'bg-red-400'}`}
                            />
                          ))}
                          {!m.reviewHistory?.length && (
                            <span className="text-[var(--wm-text-dim)] text-[10px]">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center">
                        {graduated ? (
                          <span className="text-green-400 text-[10px] font-bold">✓ 毕业</span>
                        ) : m.isHard ? (
                          <span className="text-red-400 text-[10px] font-bold">🔥 难</span>
                        ) : (
                          <span className="text-[var(--wm-text-dim)]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-[var(--wm-text-dim)] text-[12px]">
                      还没有练习过的词 — 完成一次练习后这里会显示数据
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
