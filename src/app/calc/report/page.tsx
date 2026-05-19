'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCalcWallet } from '@/hooks/useCalcWallet'
import { useCalcSettings } from '@/hooks/useCalcSettings'
import { supabase } from '@/lib/supabase'
import CalcAppHeader from '@/components/calc/CalcAppHeader'
import { LEVELS, formatLevel, levelSpec } from '@/utils/calc-levels'
import { expectedBankSize } from '@/utils/calc-bank'
import type { CalcLevel, CalcLevelStateInfo, CalcLevelStatus } from '@/utils/type'

interface ProblemStateLite {
  signature: string
  level: number
  proficiency: number
  status: 'active' | 'review' | 'mastered' | 'forced'
  consecutive_wrong: number
  last_seen_session: number | null
  updated_at: string
}

interface LevelStateRow {
  level: number
  status: CalcLevelStatus
  abc_passed_date: string | null
  review_r1_date: string | null
  review_r2_date: string | null
  review_r3_date: string | null
  warmup_complete: boolean
  warmup_answered: number
  last_session_accuracy: number | null
  consecutive_poor_sessions: number
  session_count_in_level: number
}

interface EventRow {
  id: string
  occurred_at: string
  event_type: string
  level: number | null
  signature: string | null
  detail: Record<string, unknown> | null
}

function rowToLevelState(r: LevelStateRow): CalcLevelStateInfo {
  return {
    level: r.level === 99 ? 'C' : r.level,
    status: r.status,
    abcPassedDate: r.abc_passed_date,
    reviewR1Date: r.review_r1_date,
    reviewR2Date: r.review_r2_date,
    reviewR3Date: r.review_r3_date,
    sessionCountInLevel: r.session_count_in_level,
    warmupComplete: r.warmup_complete,
    warmupAnswered: r.warmup_answered,
    lastSessionAccuracy: r.last_session_accuracy,
    consecutivePoorSessions: r.consecutive_poor_sessions,
  }
}

const STATUS_LABEL: Record<CalcLevelStatus, string> = {
  practicing: '练习中',
  abc_passed: 'A/B/C 已通过',
  review_r1: '第 1 轮通过',
  review_r2: '第 2 轮通过',
  review_r3: '第 3 轮通过',
  mastered: '已掌握',
}

const STATUS_COLOR: Record<CalcLevelStatus, string> = {
  practicing: '#c4b5fd',
  abc_passed: '#a78bfa',
  review_r1: '#7dd3fc',
  review_r2: '#5eead4',
  review_r3: '#34d399',
  mastered: '#fbbf24',
}

const EVENT_LABEL: Record<string, string> = {
  level_up: '🎉 升级',
  level_down: '📉 降级',
  review_pass: '✅ 复测通过',
  review_fail: '❌ 复测未通过',
  assault_mode_on: '⚔️ 攻坚模式',
  forced_problem: '🔒 难题强化',
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function nextDueLabel(state: CalcLevelStateInfo): string | null {
  if (!state.abcPassedDate) return null
  if (state.status === 'abc_passed') return `r1 检验 · ${addDays(state.abcPassedDate, 2)}`
  if (state.status === 'review_r1') return `r2 检验 · ${addDays(state.abcPassedDate, 7)}`
  if (state.status === 'review_r2') return `r3 检验 · ${addDays(state.abcPassedDate, 30)}`
  return null
}

export default function CalcReportPage() {
  const { user } = useAuth()
  const { settings, update } = useCalcSettings(user)
  const wallet = useCalcWallet(user)

  const [levelStates, setLevelStates] = useState<Map<number | 'C', CalcLevelStateInfo>>(new Map())
  const [problemStates, setProblemStates] = useState<ProblemStateLite[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      const [{ data: ls }, { data: ps }, { data: ev }] = await Promise.all([
        supabase
          .from('calc_level_state')
          .select('level,status,abc_passed_date,review_r1_date,review_r2_date,review_r3_date,session_count_in_level,warmup_complete,warmup_answered,last_session_accuracy,consecutive_poor_sessions')
          .eq('user_id', user.id),
        supabase
          .from('calc_problem_state')
          .select('signature,level,proficiency,status,consecutive_wrong,last_seen_session,updated_at')
          .eq('user_id', user.id),
        supabase
          .from('calc_event_log')
          .select('id,occurred_at,event_type,level,signature,detail')
          .eq('user_id', user.id)
          .order('occurred_at', { ascending: false })
          .limit(30),
      ])
      if (cancelled) return
      const map = new Map<number | 'C', CalcLevelStateInfo>()
      for (const r of (ls ?? []) as LevelStateRow[]) {
        const s = rowToLevelState(r)
        map.set(s.level, s)
      }
      setLevelStates(map)
      setProblemStates((ps ?? []) as ProblemStateLite[])
      setEvents((ev ?? []) as EventRow[])
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [user])

  // Aggregate stats per level
  const numericLevels = LEVELS.filter((l) => l.level !== 'C')

  const masteryByLevel = new Map<number, { total: number; mastered: number; review: number }>()
  for (const ps of problemStates) {
    const lvl = ps.level
    if (!masteryByLevel.has(lvl)) masteryByLevel.set(lvl, { total: 0, mastered: 0, review: 0 })
    const agg = masteryByLevel.get(lvl)!
    agg.total += 1
    if (ps.status === 'mastered') agg.mastered += 1
    else if (ps.status === 'review') agg.review += 1
  }

  // Weakest 10 problems — proficiency asc, then consecutive_wrong desc
  const weakest = [...problemStates]
    .filter((p) => p.status === 'active' || p.status === 'forced')
    .sort((a, b) => {
      if (a.proficiency !== b.proficiency) return a.proficiency - b.proficiency
      return b.consecutive_wrong - a.consecutive_wrong
    })
    .slice(0, 10)

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

      <main className="mx-auto max-w-[640px] px-4 pt-5 pb-12 space-y-5">
        {loading && (
          <div className="text-center text-[13px] py-10" style={{ color: 'rgba(196,181,253,0.4)' }}>
            加载中…
          </div>
        )}

        {!loading && (
          <>
            {/* Levels overview */}
            <section>
              <h2
                className="mb-2 text-[11px] font-extrabold tracking-widest uppercase"
                style={{ color: 'rgba(196,181,253,0.45)' }}
              >
                关卡状态
              </h2>
              <div className="space-y-1.5">
                {numericLevels.map((spec) => {
                  const level = spec.level as number
                  const state = levelStates.get(level)
                  const agg = masteryByLevel.get(level) ?? { total: 0, mastered: 0, review: 0 }
                  const expected = expectedBankSize(level)
                  const masteredPct = expected > 0
                    ? Math.round(((agg.mastered + agg.review) / expected) * 100)
                    : 0
                  const status = state?.status ?? 'practicing'
                  const nextDue = state ? nextDueLabel(state) : null
                  return (
                    <div
                      key={level}
                      className="flex items-center gap-3 rounded-xl px-3 py-2"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                      }}
                    >
                      <div
                        className="font-fredoka text-[15px] font-black tabular-nums shrink-0 w-12"
                        style={{ color: STATUS_COLOR[status] }}
                      >
                        {formatLevel(level)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-bold truncate" style={{ color: '#e9d5ff' }}>
                          {levelSpec(level).label}
                        </div>
                        <div className="text-[10px]" style={{ color: 'rgba(245,243,255,0.4)' }}>
                          <span style={{ color: STATUS_COLOR[status] }}>{STATUS_LABEL[status]}</span>
                          {' · '}
                          {agg.mastered + agg.review}/{expected} 题（{masteredPct}%）
                          {nextDue && (
                            <span style={{ color: 'rgba(125,211,252,0.7)' }}> · {nextDue}</span>
                          )}
                        </div>
                      </div>
                      {state && state.lastSessionAccuracy !== null && (
                        <div
                          className="text-[11px] font-extrabold tabular-nums"
                          style={{
                            color:
                              state.lastSessionAccuracy >= 0.9 ? '#4ade80'
                              : state.lastSessionAccuracy >= 0.75 ? '#fbbf24'
                              : '#f87171',
                          }}
                        >
                          {Math.round(state.lastSessionAccuracy * 100)}%
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Weakest 10 */}
            {weakest.length > 0 && (
              <section>
                <h2
                  className="mb-2 text-[11px] font-extrabold tracking-widest uppercase"
                  style={{ color: 'rgba(196,181,253,0.45)' }}
                >
                  待加强（最弱 10 道）
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
                      <span className="font-extrabold tabular-nums w-12 shrink-0" style={{ color: '#a78bfa' }}>
                        Lv.{p.level}
                      </span>
                      <span className="font-mono text-[11px] flex-1 truncate" style={{ color: '#e9d5ff' }}>
                        {p.signature}
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

            {/* Event timeline */}
            {events.length > 0 && (
              <section>
                <h2
                  className="mb-2 text-[11px] font-extrabold tracking-widest uppercase"
                  style={{ color: 'rgba(196,181,253,0.45)' }}
                >
                  关键事件
                </h2>
                <div className="space-y-1">
                  {events.map((e) => {
                    const date = e.occurred_at.slice(0, 10)
                    const time = e.occurred_at.slice(11, 16)
                    const label = EVENT_LABEL[e.event_type] ?? e.event_type
                    const levelLabel = e.level !== null
                      ? (e.level === 99 ? '挑战' : `Lv.${e.level}`)
                      : null
                    return (
                      <div
                        key={e.id}
                        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px]"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.07)',
                        }}
                      >
                        <span className="text-[11px] tabular-nums shrink-0" style={{ color: 'rgba(245,243,255,0.45)' }}>
                          {date.slice(5)} {time}
                        </span>
                        <span className="font-extrabold truncate" style={{ color: '#e9d5ff' }}>
                          {label}
                          {levelLabel && (
                            <span className="ml-1" style={{ color: 'rgba(167,139,250,0.7)' }}>
                              {levelLabel}
                            </span>
                          )}
                        </span>
                        {e.signature && (
                          <span className="font-mono text-[10px] ml-auto shrink-0" style={{ color: 'rgba(245,243,255,0.4)' }}>
                            {e.signature}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {events.length === 0 && weakest.length === 0 && !loading && (
              <div
                className="text-center text-[12px] py-8"
                style={{ color: 'rgba(196,181,253,0.4)' }}
              >
                还没有练习数据。开始一次 session 后再来看看～
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}
