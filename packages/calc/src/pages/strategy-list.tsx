'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@rosie/core'
import CalcAppHeader from '../components/CalcAppHeader'
import { useCalcStrategies, type CalcStrategy } from '../hooks/useCalcSettings'
import { blockById } from '../utils/calc-blocks'
import { skeletonMeta } from '../utils/calc-mixed'
import { calcPlannedQuestionCount } from '../utils/calc-planned-question-count'

function strategyLabels(strategy: CalcStrategy): string[] {
  const blockLabels = strategy.settings.selectedBlocks.map(
    (block) => blockById(block.id)?.label ?? block.id,
  )
  const mixedLabels = strategy.settings.mixedOps
    .filter((mixed) => mixed.enabled)
    .map((mixed) => mixed.label ?? skeletonMeta(mixed.skeleton).label)
  return [...blockLabels, ...mixedLabels]
}

function StrategyCard({
  strategy,
  busy,
  onToggle,
  onDelete,
}: {
  strategy: CalcStrategy
  busy: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const labels = strategyLabels(strategy)
  const questionCount = calcPlannedQuestionCount(strategy.settings)

  return (
    <article
      className="rounded-2xl p-4 transition-all hover:-translate-y-0.5"
      style={{
        background: strategy.isActive
          ? 'linear-gradient(145deg, rgba(124,58,237,.22), rgba(217,70,239,.10))'
          : 'rgba(255,255,255,.045)',
        border: `1.5px solid ${strategy.isActive ? 'rgba(167,139,250,.62)' : 'rgba(255,255,255,.10)'}`,
        boxShadow: strategy.isActive ? '0 12px 36px rgba(76,29,149,.24)' : 'none',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-[17px] font-black text-violet-50">{strategy.name}</h2>
            {strategy.isActive && (
              <span className="rounded-full border border-emerald-300/35 bg-emerald-400/15 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                当前默认
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] font-semibold text-violet-200/40">
            {strategy.settings.countMode === 'auto' ? '自适应分配' : '按占比分配'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <div
            className="flex h-7 items-center gap-0.5 whitespace-nowrap text-[10px] font-bold text-violet-200/40"
            aria-label={`题目总数 ${questionCount} 题`}
          >
            总题数
            <strong className="ml-1 text-[15px] font-black text-amber-300 tabular-nums">{questionCount}</strong>
            <span>题</span>
          </div>
          <span className="h-5 w-px bg-white/10" aria-hidden="true" />
          <button
            type="button"
            role="switch"
            aria-checked={strategy.isActive}
            aria-label={`${strategy.isActive ? '禁用' : '启用'}策略 ${strategy.name}`}
            disabled={busy}
            onClick={onToggle}
            className="relative h-7 w-12 shrink-0 rounded-full transition-all disabled:cursor-default"
            style={{ background: strategy.isActive ? '#10b981' : 'rgba(255,255,255,.13)' }}
          >
            <span
              className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-all"
              style={{ left: strategy.isActive ? 24 : 4 }}
            />
          </button>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-2 text-[10px] font-black tracking-widest text-violet-200/35 uppercase">
          运算标签 · {labels.length} 项
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="完整运算标签列表">
        {labels.length > 0 ? (
          labels.map((label, index) => (
            <span
              key={`${label}-${index}`}
              className="rounded-lg border border-violet-300/15 bg-violet-300/10 px-2 py-1 text-[10px] font-bold text-violet-100/75"
            >
              {label}
            </span>
          ))
        ) : (
          <span className="text-[11px] text-violet-200/35">尚未选择运算</span>
        )}
        </div>
      </div>

      <div className="mt-4 flex gap-2 border-t border-white/[.07] pt-3">
        <Link
          href={`/setting/calc/${strategy.id}`}
          className="flex min-h-10 flex-1 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-300/10 text-xs font-black text-violet-200 transition-colors hover:bg-violet-300/15"
        >
          编辑策略
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="min-h-10 rounded-xl border border-red-300/15 bg-red-400/[.07] px-4 text-xs font-bold text-red-300/70 transition-colors hover:bg-red-400/15 disabled:opacity-40"
        >
          删除
        </button>
      </div>
    </article>
  )
}

export default function CalcStrategyListPage() {
  const { user } = useAuth()
  const { strategies, setStrategyEnabled, deleteStrategy, isLoading, error } = useCalcStrategies(user)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  const runAction = async (id: string, action: () => Promise<void>) => {
    setBusyId(id)
    setActionError('')
    try {
      await action()
    } catch (actionFailure: unknown) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : '操作失败，请稍后重试')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <CalcAppHeader
        title="口算策略"
        backHref="/setting"
        backLabel="设置"
        rightExtra={
          <Link
            href="/setting/calc/new"
            className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-2 text-xs font-black text-white shadow-lg shadow-violet-950/30 transition-transform hover:-translate-y-0.5"
          >
            ＋ 新增策略
          </Link>
        }
      />

      <main className="relative mx-auto max-w-[720px] px-4 pt-6 pb-14">
        <div className="mb-5">
          <p className="text-[13px] leading-6 text-violet-100/55">
            启用的策略会作为默认口算配置；从今日计划进入时会直接使用它。每位用户同时只能启用一个策略。
          </p>
        </div>

        {(error || actionError) && (
          <p role="alert" className="mb-4 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-300">
            {actionError || '策略加载失败，请刷新页面重试'}
          </p>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-sm text-violet-200/40">正在加载策略…</div>
        ) : strategies.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-violet-300/25 bg-violet-400/[.06] px-6 py-14 text-center">
            <div className="text-4xl">🧮</div>
            <h2 className="mt-4 text-lg font-black text-violet-50">还没有口算策略</h2>
            <p className="mt-2 text-xs leading-5 text-violet-200/45">创建第一条策略后，它会自动成为默认策略。</p>
            <Link
              href="/setting/calc/new"
              className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black text-white shadow-lg shadow-violet-950/30"
            >
              创建第一条策略
            </Link>
          </section>
        ) : (
          <div className="flex flex-col gap-3">
            {strategies.map((strategy) => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                busy={busyId !== null}
                onToggle={() =>
                  void runAction(strategy.id, () =>
                    setStrategyEnabled(strategy.id, !strategy.isActive),
                  )
                }
                onDelete={() => {
                  if (!window.confirm(`确定删除“${strategy.name}”吗？`)) return
                  void runAction(strategy.id, () => deleteStrategy(strategy.id))
                }}
              />
            ))}
          </div>
        )}
      </main>
    </>
  )
}
