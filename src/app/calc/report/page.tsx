'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCalcWallet } from '@/hooks/useCalcWallet'
import { useCalcSettings } from '@/hooks/useCalcSettings'
import { supabase } from '@/lib/supabase'
import CalcAppHeader from '@/components/calc/CalcAppHeader'
import { BLOCK_GROUPS, blocksByGroup } from '@/utils/calc-blocks'
import { skeletonMeta } from '@/utils/calc-mixed'
import type { CalcProblemStatus } from '@/utils/type'

interface ProblemStateLite {
  signature: string
  proficiency: number
  attempt_count: number
  status: CalcProblemStatus
  consecutive_wrong: number
  block_id: string | null
  mixed_op_id: string | null
}

// ── Mastery helpers ────────────────────────────────────────────────────────

interface MasteryStat {
  /** 0..100, computed over answered rows only */
  pct: number
  /** number of rows with attempt_count > 0 */
  answered: number
  /** total attempts across rows */
  attempts: number
}

/** mastery% = round( avgProficiency / 5 * 100 ) over rows with attempt_count > 0 */
function masteryOf(rows: ProblemStateLite[]): MasteryStat {
  const answered = rows.filter((r) => r.attempt_count > 0)
  const attempts = rows.reduce((s, r) => s + r.attempt_count, 0)
  if (answered.length === 0) return { pct: 0, answered: 0, attempts }
  const avg = answered.reduce((s, r) => s + r.proficiency, 0) / answered.length
  return { pct: Math.round((avg / 5) * 100), answered: answered.length, attempts }
}

function masteryColor(pct: number, answered: number): string {
  if (answered === 0) return 'rgba(196,181,253,0.4)'
  if (pct >= 80) return '#4ade80'
  if (pct >= 50) return '#fbbf24'
  return '#f87171'
}

function statusLabel(stat: MasteryStat): string {
  if (stat.answered === 0) return '未练'
  if (stat.pct >= 80) return '已掌握'
  return '练习中'
}

/** Prettify a raw signature: add(a,b)→a+b, sub→−, mul→×, div→÷. Falls back to raw. */
function prettySignature(sig: string): string {
  const fm = sig.match(/^frac:(add|sub|mul|div)\(([^,]+),([^,]+)\)$/)
  if (fm) {
    const opSym = { add: '+', sub: '−', mul: '×', div: '÷' }[fm[1]] ?? '?'
    return `${fm[2]} ${opSym} ${fm[3]}`
  }
  const m = sig.match(/^(add|sub|mul|div)\((-?\d+),(-?\d+)\)$/)
  if (m) {
    const opSym = { add: '+', sub: '−', mul: '×', div: '÷' }[m[1]] ?? '?'
    return `${m[2]} ${opSym} ${m[3]}`
  }
  return sig
}

function sortWeakest(rows: ProblemStateLite[]): ProblemStateLite[] {
  return [...rows].sort((a, b) => {
    if (a.proficiency !== b.proficiency) return a.proficiency - b.proficiency
    return b.consecutive_wrong - a.consecutive_wrong
  })
}

export default function CalcReportPage() {
  const { user } = useAuth()
  const { settings, update } = useCalcSettings(user)
  const wallet = useCalcWallet(user)

  const [problemStates, setProblemStates] = useState<ProblemStateLite[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      const { data } = await supabase
        .from('calc_problem_state')
        .select('signature,proficiency,attempt_count,status,consecutive_wrong,block_id,mixed_op_id')
        .eq('user_id', user.id)
      if (cancelled) return
      setProblemStates((data ?? []) as ProblemStateLite[])
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [user])

  // Index rows by block_id and mixed_op_id for cheap grouping.
  const rowsByBlock = useMemo(() => {
    const map = new Map<string, ProblemStateLite[]>()
    for (const r of problemStates) {
      if (!r.block_id) continue
      const arr = map.get(r.block_id)
      if (arr) arr.push(r)
      else map.set(r.block_id, [r])
    }
    return map
  }, [problemStates])

  const rowsByMixedOp = useMemo(() => {
    const map = new Map<string, ProblemStateLite[]>()
    for (const r of problemStates) {
      if (!r.mixed_op_id) continue
      const arr = map.get(r.mixed_op_id)
      if (arr) arr.push(r)
      else map.set(r.mixed_op_id, [r])
    }
    return map
  }, [problemStates])

  // Weakest 10 across all rows (not mastered).
  const weakest = useMemo(
    () => sortWeakest(problemStates.filter((p) => p.status !== 'mastered')).slice(0, 10),
    [problemStates],
  )

  const recentSessions = wallet.sessions.slice(0, 5)
  const mixedOps = settings.mixedOps
  const hasData = problemStates.length > 0 || wallet.sessions.length > 0

  return (
    <>
      <CalcAppHeader
        balance={wallet.balance}
        soundEnabled={settings.soundEnabled}
        onToggleSound={() => update({ soundEnabled: !settings.soundEnabled })}
        title="练习报告"
        backHref="/calc"
        backLabel="口算"
      />

      <main className="mx-auto max-w-[640px] px-4 pt-5 pb-12 space-y-6">
        {loading && (
          <div className="text-center text-[13px] py-10" style={{ color: 'rgba(196,181,253,0.4)' }}>
            加载中…
          </div>
        )}

        {!loading && !hasData && (
          <div
            className="text-center text-[13px] py-12 rounded-2xl"
            style={{
              color: 'rgba(196,181,253,0.6)',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            还没有练习数据，先去练一练吧～
          </div>
        )}

        {!loading && hasData && (
          <>
            {/* 1. 掌握度总览 — grouped by block group */}
            <section>
              <h2
                className="mb-2 text-[11px] font-extrabold tracking-widest uppercase"
                style={{ color: 'rgba(196,181,253,0.45)' }}
              >
                掌握度总览
              </h2>
              <div className="space-y-4">
                {BLOCK_GROUPS.map(({ group, label }) => (
                  <div key={group}>
                    <div
                      className="mb-1.5 text-[12px] font-extrabold"
                      style={{ color: '#c4b5fd' }}
                    >
                      {label}
                    </div>
                    <div className="space-y-1.5">
                      {blocksByGroup(group).map((block) => {
                        const rows = rowsByBlock.get(block.id) ?? []
                        const stat = masteryOf(rows)
                        const expanded = expandedBlock === block.id
                        const weak = sortWeakest(
                          rows.filter((r) => r.status !== 'mastered'),
                        )
                        return (
                          <div key={block.id}>
                            <button
                              type="button"
                              onClick={() => setExpandedBlock(expanded ? null : block.id)}
                              className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-all"
                              style={{
                                background: expanded ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.03)',
                                border: expanded ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.07)',
                              }}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-[12px] font-bold truncate" style={{ color: '#e9d5ff' }}>
                                  {block.label}
                                </div>
                                <div className="text-[10px]" style={{ color: 'rgba(245,243,255,0.4)' }}>
                                  <span style={{ color: masteryColor(stat.pct, stat.answered) }}>
                                    {statusLabel(stat)}
                                  </span>
                                  {' · 作答 '}{stat.attempts}{' 次'}
                                </div>
                              </div>
                              <div
                                className="text-[13px] font-black tabular-nums shrink-0"
                                style={{ color: masteryColor(stat.pct, stat.answered) }}
                              >
                                {stat.answered === 0 ? '—' : `${stat.pct}%`}
                              </div>
                              <span className="text-[10px] shrink-0" style={{ color: 'rgba(196,181,253,0.4)' }}>
                                {expanded ? '▲' : '▼'}
                              </span>
                            </button>

                            {expanded && (
                              <div
                                className="mt-1 rounded-xl overflow-hidden"
                                style={{ border: '1px solid rgba(139,92,246,0.15)' }}
                              >
                                {weak.length === 0 ? (
                                  <div
                                    className="px-3 py-2 text-[11px]"
                                    style={{ color: 'rgba(196,181,253,0.45)' }}
                                  >
                                    {stat.answered === 0 ? '这一块还没练过～' : '都掌握了 🎉'}
                                  </div>
                                ) : (
                                  weak.map((item) => (
                                    <div
                                      key={item.signature}
                                      className="grid items-center px-3 py-1.5 text-[11px]"
                                      style={{
                                        gridTemplateColumns: '1fr auto auto',
                                        borderTop: '1px solid rgba(255,255,255,0.04)',
                                      }}
                                    >
                                      <span className="font-mono font-semibold" style={{ color: '#e9d5ff' }}>
                                        {prettySignature(item.signature)}
                                      </span>
                                      <span
                                        className="font-extrabold tabular-nums pr-3"
                                        style={{ color: item.proficiency <= 1 ? '#f87171' : '#fbbf24' }}
                                      >
                                        熟练 {item.proficiency}/5
                                      </span>
                                      <span
                                        className="text-right font-extrabold tabular-nums w-12"
                                        style={{ color: item.consecutive_wrong > 0 ? '#f87171' : 'rgba(196,181,253,0.3)' }}
                                      >
                                        {item.consecutive_wrong > 0 ? `×${item.consecutive_wrong}` : '·'}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 2. 混合运算 */}
            {mixedOps.length > 0 && (
              <section>
                <h2
                  className="mb-2 text-[11px] font-extrabold tracking-widest uppercase"
                  style={{ color: 'rgba(196,181,253,0.45)' }}
                >
                  混合运算
                </h2>
                <div className="space-y-1.5">
                  {mixedOps.map((op) => {
                    const rows = rowsByMixedOp.get(op.id) ?? []
                    const stat = masteryOf(rows)
                    const label = op.label ?? skeletonMeta(op.skeleton).label
                    return (
                      <div
                        key={op.id}
                        className="flex items-center gap-3 rounded-xl px-3 py-2"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.07)',
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-bold truncate" style={{ color: '#e9d5ff' }}>
                            {label}
                          </div>
                          <div className="text-[10px]" style={{ color: 'rgba(245,243,255,0.4)' }}>
                            <span style={{ color: masteryColor(stat.pct, stat.answered) }}>
                              {statusLabel(stat)}
                            </span>
                            {' · 作答 '}{stat.attempts}{' 次'}
                          </div>
                        </div>
                        <div
                          className="text-[13px] font-black tabular-nums shrink-0"
                          style={{ color: masteryColor(stat.pct, stat.answered) }}
                        >
                          {stat.answered === 0 ? '—' : `${stat.pct}%`}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* 3. 最弱 10 题 */}
            {weakest.length > 0 && (
              <section>
                <h2
                  className="mb-2 text-[11px] font-extrabold tracking-widest uppercase"
                  style={{ color: 'rgba(196,181,253,0.45)' }}
                >
                  最弱 10 题
                </h2>
                <div className="space-y-1">
                  {weakest.map((p) => (
                    <div
                      key={p.signature}
                      className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px]"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                      }}
                    >
                      <span className="font-mono text-[11px] flex-1 truncate" style={{ color: '#e9d5ff' }}>
                        {prettySignature(p.signature)}
                      </span>
                      <span
                        className="text-[10px] font-extrabold tabular-nums shrink-0"
                        style={{ color: p.proficiency <= 1 ? '#f87171' : '#fbbf24' }}
                      >
                        熟练 {p.proficiency}/5
                      </span>
                      {p.consecutive_wrong > 0 && (
                        <span className="text-[10px] font-extrabold shrink-0" style={{ color: '#f87171' }}>
                          ×{p.consecutive_wrong} 错
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 4. 最近练习 */}
            {recentSessions.length > 0 && (
              <section>
                <h2
                  className="mb-2 text-[11px] font-extrabold tracking-widest uppercase"
                  style={{ color: 'rgba(196,181,253,0.45)' }}
                >
                  最近练习
                </h2>
                <div className="space-y-1">
                  {recentSessions.map((s, i) => {
                    const done = s.correctCount + s.retryCount + s.wrongCount
                    const right = s.correctCount + s.retryCount
                    return (
                      <div
                        key={s.id ?? `${s.finishedAt}-${i}`}
                        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px]"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.07)',
                        }}
                      >
                        <span className="text-[11px] tabular-nums shrink-0" style={{ color: 'rgba(245,243,255,0.45)' }}>
                          {s.date.slice(5)}
                        </span>
                        <span className="text-[11px] tabular-nums" style={{ color: '#e9d5ff' }}>
                          {done} 题
                        </span>
                        <span
                          className="text-[11px] font-extrabold tabular-nums"
                          style={{ color: '#4ade80' }}
                        >
                          对 {right}
                        </span>
                        <span className="ml-auto text-[11px] font-extrabold tabular-nums shrink-0" style={{ color: '#fbbf24' }}>
                          ⭐ {s.coinsEarned}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  )
}
