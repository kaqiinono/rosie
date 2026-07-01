'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { OrbBackground, BackLink } from '@rosie/ui'
import {
  filterMistakes,
  MODULE_LABEL,
  useUnifiedMistakes,
  type MistakeModuleFilter,
  type MistakeStatusFilter,
} from '@/hooks/useUnifiedMistakes'

const STATUS_TABS: { key: MistakeStatusFilter; label: string }[] = [
  { key: 'unresolved', label: '未改正' },
  { key: 'resolved', label: '已改正' },
  { key: 'all', label: '全部' },
]

const MODULE_TABS: { key: MistakeModuleFilter; label: string }[] = [
  { key: 'all', label: '全部模块' },
  { key: 'math', label: '数学' },
  { key: 'calc', label: '口算' },
  { key: 'english', label: '英语' },
]

const MODULE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  math: { bg: 'rgba(59,130,246,.1)', text: '#1d4ed8', border: 'rgba(59,130,246,.25)' },
  calc: { bg: 'rgba(139,92,246,.1)', text: '#6d28d9', border: 'rgba(139,92,246,.25)' },
  english: { bg: 'rgba(233,69,96,.1)', text: '#be123c', border: 'rgba(233,69,96,.25)' },
}

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

function FilterChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-all ${
        active
          ? 'bg-rose-500 text-white shadow-[0_2px_8px_rgba(244,63,94,.3)]'
          : 'bg-white/80 text-gray-600 hover:bg-white'
      }`}
      style={active ? undefined : { border: '1px solid rgba(0,0,0,.08)' }}
    >
      {label}
      {count != null && count > 0 && (
        <span className={`ml-1 ${active ? 'text-white/90' : 'text-rose-500'}`}>{count}</span>
      )}
    </button>
  )
}

export default function UnifiedMistakesPage() {
  const { items, isLoading, counts } = useUnifiedMistakes()
  const [statusFilter, setStatusFilter] = useState<MistakeStatusFilter>('unresolved')
  const [moduleFilter, setModuleFilter] = useState<MistakeModuleFilter>('all')

  const filtered = useMemo(
    () => filterMistakes(items, statusFilter, moduleFilter),
    [items, statusFilter, moduleFilter],
  )

  const grouped = useMemo(() => {
    const math = filtered.filter(i => i.module === 'math')
    const calc = filtered.filter(i => i.module === 'calc')
    const english = filtered.filter(i => i.module === 'english')
    return { math, calc, english }
  }, [filtered])

  return (
    <>
      <OrbBackground variant="home" />
      <BackLink href="/" label="首页" />

      <div className="relative z-1 mx-auto min-h-screen max-w-[680px] px-4 py-8 pt-20 pb-12">
        {/* Header */}
        <div
          className="mb-5 rounded-[18px] px-5 py-4"
          style={{
            background: 'linear-gradient(135deg, #fff5f5 0%, #fee2e2 50%, #fce7f3 100%)',
            border: '2px solid rgba(244,63,94,.2)',
            boxShadow: '0 4px 20px rgba(244,63,94,.08)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl">📕</span>
            <h1 className="text-[18px] font-extrabold text-rose-900">错题本</h1>
            {counts.unresolved > 0 && (
              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white">
                {counts.unresolved} 待练
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-rose-800/80">
            汇总数学、口算、英语错题 · 点击进入对应练习 · 答对后自动标记为已改正
          </p>
        </div>

        {/* Status filter */}
        <div className="mb-3 flex flex-wrap gap-2">
          {STATUS_TABS.map(tab => (
            <FilterChip
              key={tab.key}
              active={statusFilter === tab.key}
              label={tab.label}
              count={
                tab.key === 'unresolved'
                  ? counts.unresolved
                  : tab.key === 'resolved'
                    ? counts.resolved
                    : counts.total
              }
              onClick={() => setStatusFilter(tab.key)}
            />
          ))}
        </div>

        {/* Module filter */}
        <div className="mb-5 flex flex-wrap gap-2">
          {MODULE_TABS.map(tab => (
            <FilterChip
              key={tab.key}
              active={moduleFilter === tab.key}
              label={tab.label}
              onClick={() => setModuleFilter(tab.key)}
            />
          ))}
        </div>

        {isLoading && (
          <div className="py-16 text-center text-[13px] text-gray-400">加载中…</div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-[16px] border-2 border-dashed border-rose-200 bg-white/60 py-16 text-center">
            <div className="text-5xl">{statusFilter === 'unresolved' ? '🎉' : '📭'}</div>
            <div className="text-[15px] font-bold text-gray-700">
              {statusFilter === 'unresolved'
                ? '没有待改正的错题'
                : statusFilter === 'resolved'
                  ? '还没有已改正的记录'
                  : '错题本是空的'}
            </div>
            <p className="max-w-[280px] text-[12px] leading-relaxed text-gray-500">
              {statusFilter === 'unresolved'
                ? '数学、口算、英语中答错的题目会自动收录到这里'
                : '完成练习并答对后，错题会移入「已改正」'}
            </p>
            {statusFilter !== 'unresolved' && (
              <button
                type="button"
                onClick={() => setStatusFilter('unresolved')}
                className="mt-1 rounded-full bg-rose-500 px-4 py-2 text-[12px] font-bold text-white"
              >
                查看未改正
              </button>
            )}
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="space-y-6">
            {(moduleFilter === 'all' || moduleFilter === 'math') && grouped.math.length > 0 && (
              <MistakeSection module="math" items={grouped.math} />
            )}
            {(moduleFilter === 'all' || moduleFilter === 'calc') && grouped.calc.length > 0 && (
              <MistakeSection module="calc" items={grouped.calc} />
            )}
            {(moduleFilter === 'all' || moduleFilter === 'english') && grouped.english.length > 0 && (
              <MistakeSection module="english" items={grouped.english} />
            )}
          </div>
        )}

        {!isLoading && counts.unresolved > 0 && statusFilter === 'unresolved' && moduleFilter !== 'math' && (
          <div className="mt-6">
            <Link
              href="/calc/session?mode=mistakes&count=3&time=0"
              className="block w-full rounded-2xl py-3.5 text-center text-[14px] font-extrabold text-white no-underline transition-all hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #d97706, #f97316)',
                boxShadow: '0 6px 20px rgba(249,115,22,.25)',
              }}
            >
              📝 口算错题专项练（{counts.calc > 0 ? `${grouped.calc.filter(i => i.status === 'unresolved').length} 题` : '前往'}）
            </Link>
          </div>
        )}
      </div>
    </>
  )
}

function MistakeSection({
  module,
  items,
}: {
  module: 'math' | 'calc' | 'english'
  items: ReturnType<typeof filterMistakes>
}) {
  const style = MODULE_STYLE[module]
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-extrabold"
          style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
        >
          {MODULE_LABEL[module]}
        </span>
        <span className="text-[11px] font-medium text-gray-400">{items.length} 题</span>
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <MistakeRow key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}

function MistakeRow({ item }: { item: ReturnType<typeof filterMistakes>[number] }) {
  const isResolved = item.status === 'resolved'
  const style = MODULE_STYLE[item.module]
  const when = isResolved
    ? (item.resolvedAt ? formatWhen(item.resolvedAt) : '已改正')
    : formatWhen(item.lastWrongAt)

  return (
    <div
      className="flex items-center gap-3 rounded-[14px] bg-white px-4 py-3 transition-shadow"
      style={{
        border: `1.5px solid ${isResolved ? 'rgba(34,197,94,.25)' : 'rgba(244,63,94,.2)'}`,
        boxShadow: '0 2px 10px rgba(0,0,0,.04)',
        opacity: isResolved ? 0.75 : 1,
      }}
    >
      <div className="min-w-0 flex-1">
        <div className={`text-[13px] font-bold leading-snug ${isResolved ? 'text-green-700 line-through' : 'text-gray-800'}`}>
          {item.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span
            className="rounded-full px-2 py-px text-[10px] font-semibold"
            style={{ background: style.bg, color: style.text }}
          >
            {item.subtitle}
          </span>
          <span
            className={`rounded-full px-2 py-px text-[10px] font-bold ${
              isResolved ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'
            }`}
          >
            {isResolved ? '已改正' : '未改正'}
          </span>
          {when && <span className="text-[10px] text-gray-400">{when}</span>}
        </div>
      </div>

      {!isResolved ? (
        <Link
          href={item.href}
          className="shrink-0 rounded-full px-3.5 py-2 text-[12px] font-extrabold text-white no-underline transition-all hover:scale-105"
          style={{ background: 'linear-gradient(135deg, #f97316, #fbbf24)' }}
        >
          去练 ✨
        </Link>
      ) : (
        <span className="shrink-0 text-[18px]">✅</span>
      )}
    </div>
  )
}
