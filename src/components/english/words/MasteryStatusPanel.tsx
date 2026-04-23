'use client'

import { useMemo, useState } from 'react'
import type { WordEntry, WordMasteryInfo, WordMasteryMap } from '@/utils/type'
import { wordKey } from '@/utils/english-helpers'
import { ensureStageInit, isGraduated, MASTERY_ICON, getWordMasteryLevel } from '@/utils/masteryUtils'

export type MasteryStatusPanelLayout = 'collapsible' | 'alwaysOpen'

interface MasteryStatusPanelProps {
  vocab: WordEntry[]
  masteryMap: WordMasteryMap
  /** Header label (default: 词汇学习状态) */
  panelTitle?: string
  /**
   * When set, only these words appear, in this order (e.g. current weekly plan).
   * Words without mastery still show as「未练习」.
   * When omitted, every word in `vocab` that has a mastery record is listed (global practiced view).
   */
  orderedWordsInScope?: WordEntry[]
  layout?: MasteryStatusPanelLayout
  className?: string
}

function formatDue(nextReviewDate: string | undefined, today: string): { label: string; urgent: 'today' | 'tomorrow' | 'future' | 'none' } {
  if (!nextReviewDate) return { label: '—', urgent: 'none' }
  const diff = Math.floor((Date.parse(nextReviewDate) - Date.parse(today)) / 86400000)
  if (diff <= 0) return { label: '今天', urgent: 'today' }
  if (diff === 1) return { label: '明天', urgent: 'tomorrow' }
  return { label: `${diff}天后`, urgent: 'future' }
}

type PanelRow =
  | { w: WordEntry; unpracticed: true }
  | {
      w: WordEntry
      unpracticed: false
      m: WordMasteryInfo
      graduated: boolean
      due: { label: string; urgent: 'today' | 'tomorrow' | 'future' | 'none' }
    }

export default function MasteryStatusPanel({
  vocab,
  masteryMap,
  panelTitle = '词汇学习状态',
  orderedWordsInScope,
  layout = 'collapsible',
  className,
}: MasteryStatusPanelProps) {
  const [open, setOpen] = useState(layout === 'alwaysOpen')
  const today = new Date().toISOString().slice(0, 10)

  const rows: PanelRow[] = useMemo(() => {
    if (orderedWordsInScope !== undefined) {
      return orderedWordsInScope.map((w) => {
        const key = wordKey(w)
        const raw = masteryMap[key]
        if (raw === undefined) {
          return { w, unpracticed: true as const }
        }
        const m = ensureStageInit(raw, today)
        const graduated = isGraduated(m)
        const due = graduated ? { label: '已毕业', urgent: 'none' as const } : formatDue(m.nextReviewDate, today)
        return { w, unpracticed: false as const, m, graduated, due }
      })
    }
    return vocab
      .filter((w) => masteryMap[wordKey(w)] !== undefined)
      .map((w) => {
        const key = wordKey(w)
        const raw = masteryMap[key]!
        const m = ensureStageInit(raw, today)
        const graduated = isGraduated(m)
        const due = graduated ? { label: '已毕业', urgent: 'none' as const } : formatDue(m.nextReviewDate, today)
        return { w, unpracticed: false as const, m, graduated, due }
      })
      .sort((a, b) => {
        if (a.graduated && !b.graduated) return 1
        if (!a.graduated && b.graduated) return -1
        const da = a.m.nextReviewDate ?? '9999-12-31'
        const db = b.m.nextReviewDate ?? '9999-12-31'
        return da.localeCompare(db)
      })
  }, [vocab, masteryMap, orderedWordsInScope, today])

  const hardCount = rows.filter((r): r is Extract<PanelRow, { unpracticed: false }> => !r.unpracticed && r.m.isHard && !r.graduated).length
  const graduatedCount = rows.filter((r): r is Extract<PanelRow, { unpracticed: false }> => !r.unpracticed && r.graduated).length
  const practicedCount = rows.filter((r) => !r.unpracticed).length
  const pendingInScopeCount = rows.length - practicedCount

  const dueTodayCount = rows.filter(
    (r): r is Extract<PanelRow, { unpracticed: false }> =>
      !r.unpracticed && !r.graduated && r.due.urgent === 'today',
  ).length
  const dueTomorrowCount = rows.filter(
    (r): r is Extract<PanelRow, { unpracticed: false }> =>
      !r.unpracticed && !r.graduated && r.due.urgent === 'tomorrow',
  ).length

  const vocabRecordedCount = useMemo(
    () => vocab.filter((w) => masteryMap[wordKey(w)] !== undefined).length,
    [vocab, masteryMap],
  )
  const vocabNeverPracticedCount = vocab.length - vocabRecordedCount

  const isScoped = orderedWordsInScope !== undefined

  const tableBody = (
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
          {rows.map((row) => {
            if (row.unpracticed) {
              const w = row.w
              return (
                <tr key={wordKey(w)} className="border-t border-[var(--wm-border)]">
                  <td className="px-4 py-2 font-bold text-[var(--wm-text)]">{w.word}</td>
                  <td className="px-3 py-2 text-[11px] text-[var(--wm-text-dim)]">
                    {w.unit.replace(/\D+(\d+)/, 'U$1')} {w.lesson.replace(/\D+(\d+)/, 'L$1')}
                  </td>
                  <td className="px-3 py-2 text-center text-[var(--wm-text-dim)]">—</td>
                  <td className="px-3 py-2 text-center text-[var(--wm-text-dim)] text-[10px]">—</td>
                  <td className="px-3 py-2 text-center text-[var(--wm-text-dim)] text-[10px]">—</td>
                  <td className="px-4 py-2 text-center text-[var(--wm-text-dim)] text-[10px]">未练习</td>
                </tr>
              )
            }
            const { w, m, graduated, due } = row
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
                        className={`h-2 w-2 rounded-full ${r.correct ? 'bg-green-400' : 'bg-red-400'}`}
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
              <td colSpan={6} className="px-4 py-6 text-center text-[var(--wm-text-dim)] text-[12px]">
                {orderedWordsInScope !== undefined
                  ? '本周计划暂无分配单词'
                  : '还没有练习过的词 — 完成一次练习后这里会显示数据'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )

  const summaryLineScoped = (
    <div className="font-nunito flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-snug text-[var(--wm-text-dim)]">
      <span>
        共 <strong className="text-[var(--wm-text)]">{rows.length}</strong> 词
      </span>
      <span className="text-[var(--wm-border)]">·</span>
      <span>
        已练 <strong className="text-[#93c5fd]">{practicedCount}</strong>
      </span>
      <span className="text-[var(--wm-border)]">·</span>
      <span>
        待练 <strong className={pendingInScopeCount > 0 ? 'text-[#fbbf24]' : 'text-[var(--wm-text)]'}>{pendingInScopeCount}</strong>
      </span>
      {(dueTodayCount > 0 || dueTomorrowCount > 0) && (
        <>
          <span className="text-[var(--wm-border)]">·</span>
          <span>
            今日复习 <strong className="text-[#f87171]">{dueTodayCount}</strong>
          </span>
          {dueTomorrowCount > 0 && (
            <>
              <span className="text-[var(--wm-border)]">·</span>
              <span>
                明日 <strong className="text-[#fb923c]">{dueTomorrowCount}</strong>
              </span>
            </>
          )}
        </>
      )}
      {hardCount > 0 && (
        <>
          <span className="text-[var(--wm-border)]">·</span>
          <span>
            难词 <strong className="text-red-400">{hardCount}</strong>
          </span>
        </>
      )}
      {graduatedCount > 0 && (
        <>
          <span className="text-[var(--wm-border)]">·</span>
          <span>
            毕业 <strong className="text-[#4ade80]">{graduatedCount}</strong>
          </span>
        </>
      )}
    </div>
  )

  const summaryLineGlobal = (
    <div className="font-nunito flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-snug text-[var(--wm-text-dim)]">
      <span>
        有记录 <strong className="text-[var(--wm-text)]">{vocabRecordedCount}</strong> 词
      </span>
      <span className="text-[var(--wm-border)]">·</span>
      <span>
        词库未练 <strong className={vocabNeverPracticedCount > 0 ? 'text-[#fbbf24]' : 'text-[var(--wm-text)]'}>{vocabNeverPracticedCount}</strong>
      </span>
      {(dueTodayCount > 0 || dueTomorrowCount > 0) && (
        <>
          <span className="text-[var(--wm-border)]">·</span>
          <span>
            今日复习 <strong className="text-[#f87171]">{dueTodayCount}</strong>
          </span>
          {dueTomorrowCount > 0 && (
            <>
              <span className="text-[var(--wm-border)]">·</span>
              <span>
                明日 <strong className="text-[#fb923c]">{dueTomorrowCount}</strong>
              </span>
            </>
          )}
        </>
      )}
      {hardCount > 0 && (
        <>
          <span className="text-[var(--wm-border)]">·</span>
          <span>
            难词 <strong className="text-red-400">{hardCount}</strong>
          </span>
        </>
      )}
      {graduatedCount > 0 && (
        <>
          <span className="text-[var(--wm-border)]">·</span>
          <span>
            毕业 <strong className="text-[#4ade80]">{graduatedCount}</strong>
          </span>
        </>
      )}
    </div>
  )

  const summaryBlock =
    isScoped && rows.length === 0 ? (
      <p className="font-nunito text-[11px] text-[var(--wm-text-dim)]">本周暂无分配单词</p>
    ) : isScoped ? (
      summaryLineScoped
    ) : (
      summaryLineGlobal
    )

  const headerInner = (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div className="flex w-full min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="shrink-0 text-[15px]">📊</span>
          <span className="font-nunito text-[13px] font-bold text-[var(--wm-text)]">{panelTitle}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hardCount > 0 && (
            <span className="hidden rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400 sm:inline">
              🔥 {hardCount}
            </span>
          )}
          {graduatedCount > 0 && (
            <span className="hidden rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-bold text-green-400 sm:inline">
              ✓ {graduatedCount}
            </span>
          )}
          {layout === 'collapsible' && (
            <svg
              className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{ color: 'var(--wm-text-dim)' }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          )}
        </div>
      </div>
      {summaryBlock}
    </div>
  )

  return (
    <div className={`px-4 pb-8 ${className ?? ''}`}>
      <div className="overflow-hidden rounded-[14px] border border-[var(--wm-border)]">
        {layout === 'alwaysOpen' ? (
          <div className="w-full bg-[var(--wm-surface)] px-4 py-3 text-left">{headerInner}</div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-full cursor-pointer border-0 bg-[var(--wm-surface)] px-4 py-3 text-left transition-colors hover:bg-[var(--wm-surface2)]"
          >
            {headerInner}
          </button>
        )}

        {(layout === 'alwaysOpen' || open) && tableBody}
      </div>
    </div>
  )
}
