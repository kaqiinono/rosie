'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useWordsContext } from '../../WordsContext'
import { useEnglishWrong } from '../../hooks/useEnglishWrong'
import { findWordByKey, practiceHrefForWord } from '../../utils/english-helpers'
import { getWordMasteryLevel } from '@rosie/core'
import SpeakButton from './SpeakButton'

type StatusFilter = 'unresolved' | 'resolved' | 'all'

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'unresolved', label: '未改正' },
  { key: 'resolved', label: '已改正' },
  { key: 'all', label: '全部' },
]

function formatWhen(iso: string): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = (Date.now() - t) / 1000
  if (diff < 86400) return '今天'
  if (diff < 86400 * 2) return '昨天'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function EnglishHardWordsPage() {
  const { user, vocab, masteryMap } = useWordsContext()
  const { rows, removeWrong, refetch } = useEnglishWrong(user)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('unresolved')

  const items = useMemo(() => {
    return rows
      .map(row => {
        const entry = findWordByKey(vocab, row.wordKey)
        if (!entry) return null
        return { row, entry }
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .filter(({ row }) => {
        if (statusFilter === 'unresolved') return !row.resolved
        if (statusFilter === 'resolved') return row.resolved
        return true
      })
  }, [rows, vocab, statusFilter])

  const unresolvedCount = rows.filter(r => !r.resolved).length
  const resolvedCount = rows.filter(r => r.resolved).length

  return (
    <div className="relative z-1 mx-auto max-w-[720px] px-4 py-6 pb-16">
      <div
        className="mb-5 rounded-[16px] px-5 py-4"
        style={{
          background: 'linear-gradient(135deg, rgba(233,69,96,.12), rgba(96,165,250,.08))',
          border: '1.5px solid var(--wm-border)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">📕</span>
          <h1 className="font-fredoka text-[20px] font-extrabold text-[var(--wm-text)]">难词本</h1>
          {unresolvedCount > 0 && (
            <span className="rounded-full bg-[var(--wm-accent)] px-2 py-0.5 text-[11px] font-bold text-white">
              {unresolvedCount} 个
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--wm-text-dim)]">
          练习或阅读中答错的单词会收录在此 · 再练答对后自动标记已改正
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-all ${
              statusFilter === tab.key
                ? 'bg-[var(--wm-accent)] text-white'
                : 'border border-[var(--wm-border)] bg-[var(--wm-surface)] text-[var(--wm-text-dim)]'
            }`}
          >
            {tab.label}
            <span className="ml-1 opacity-80">
              {tab.key === 'unresolved' ? unresolvedCount : tab.key === 'resolved' ? resolvedCount : rows.length}
            </span>
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 rounded-[16px] border-2 border-dashed py-16 text-center"
          style={{ borderColor: 'var(--wm-border)' }}
        >
          <div className="text-5xl">{statusFilter === 'unresolved' ? '🎉' : '📭'}</div>
          <div className="text-[15px] font-bold text-[var(--wm-text)]">
            {statusFilter === 'unresolved' ? '没有待改正的难词' : statusFilter === 'resolved' ? '还没有已改正记录' : '难词本是空的'}
          </div>
          <p className="max-w-[280px] text-[12px] text-[var(--wm-text-dim)]">
            在练习、计划或阅读测验中答错会自动收录
          </p>
          <Link
            href="/english/words/practice"
            className="mt-1 rounded-full px-4 py-2 text-[12px] font-bold text-white no-underline"
            style={{ background: 'var(--wm-accent)' }}
          >
            去练习 →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(({ row, entry }) => {
            const mastery = masteryMap[row.wordKey]
            const level = getWordMasteryLevel(mastery?.correct ?? 0)
            const isResolved = row.resolved
            return (
              <div
                key={row.wordKey}
                className="flex items-center gap-3 rounded-[14px] px-4 py-3"
                style={{
                  background: 'var(--wm-surface)',
                  border: `1.5px solid ${isResolved ? 'rgba(34,197,94,.25)' : 'rgba(233,69,96,.25)'}`,
                  opacity: isResolved ? 0.8 : 1,
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-fredoka text-[17px] font-extrabold ${isResolved ? 'text-green-600 line-through' : 'text-[var(--wm-text)]'}`}>
                      {entry.word}
                    </span>
                    <SpeakButton word={entry.word} size="text-[14px]" />
                  </div>
                  <div className="mt-0.5 text-[12px] text-[var(--wm-text-dim)]">{entry.explanation}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-white/10 px-2 py-px text-[10px] font-semibold text-[var(--wm-text-dim)]">
                      {entry.unit} · {entry.lesson}
                    </span>
                    <span className={`rounded-full px-2 py-px text-[10px] font-bold ${isResolved ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                      {isResolved ? '已改正' : '未改正'}
                    </span>
                    <span className="text-[10px] text-[var(--wm-text-dim)]">
                      {isResolved ? formatWhen(row.resolvedAt ?? '') : formatWhen(row.addedAt)}
                    </span>
                    <span className="text-[10px] text-[var(--wm-text-dim)]">掌握 Lv.{level}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {!isResolved && (
                    <Link
                      href={practiceHrefForWord(row.wordKey)}
                      className="rounded-full px-3 py-1.5 text-[11px] font-extrabold text-white no-underline"
                      style={{ background: 'var(--wm-accent)' }}
                    >
                      再练 ✨
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => void removeWrong(row.wordKey).then(() => refetch())}
                    className="rounded-full border border-white/15 px-2 py-1.5 text-[11px] text-[var(--wm-text-dim)] hover:text-[var(--wm-text)]"
                    title="从难词本移除"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
