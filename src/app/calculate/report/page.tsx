'use client'

import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { getLevel } from '@/utils/calculate-trees'
import type { LevelId } from '@/utils/calculate-types'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const ERROR_TAG_LABELS: Record<string, string> = {
  carry_miss: '进位遗漏',
  order_confusion: '运算顺序混淆',
  place_value: '数位理解偏差',
  fraction_concept: '分子分母混淆',
  comprehension: '题意理解偏差',
  careless: '粗心计算失误',
  formula_misuse: '公式套用错误',
  estimation_off: '估算范围偏差',
}

interface SessionRow {
  id: string
  date: string
  mode: string
  level_id: string | null
  tier: string | null
  count: number
  correct_count: number
  wrong_count: number
  time_spent_sec: number
  stars_earned: number
  max_streak: number
  error_summary: Record<string, number>
  finished_at: string
}

interface MistakeRow {
  id: string
  question_signature: string
  user_answer: string
  correct_answer: string
  error_tag: string | null
}

export default function ReportPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')

  const [session, setSession] = useState<SessionRow | null>(null)
  const [trend, setTrend] = useState<number[]>([])
  const [mistakes, setMistakes] = useState<MistakeRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const load = async () => {
      let current: SessionRow | null = null

      if (sessionId) {
        const { data } = await supabase
          .from('calculate_sessions')
          .select('*')
          .eq('id', sessionId)
          .eq('user_id', user.id)
          .maybeSingle()
        current = data as SessionRow | null
      } else {
        const { data } = await supabase
          .from('calculate_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('finished_at', { ascending: false })
          .limit(1)
        current = data && data.length > 0 ? (data[0] as SessionRow) : null
      }

      setSession(current)

      if (current) {
        const { data: trendData } = await supabase
          .from('calculate_sessions')
          .select('count, correct_count')
          .eq('user_id', user.id)
          .order('finished_at', { ascending: false })
          .limit(5)
        if (trendData) {
          const acc = (trendData as { count: number; correct_count: number }[])
            .map((r) => (r.count > 0 ? r.correct_count / r.count : 0))
            .reverse()
          setTrend(acc)
        }

        const since = new Date(current.finished_at)
        since.setMinutes(since.getMinutes() - 30)
        const { data: mistakeData } = await supabase
          .from('calculate_mistakes')
          .select('id, question_signature, user_answer, correct_answer, error_tag')
          .eq('user_id', user.id)
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: false })
          .limit(20)
        if (mistakeData) setMistakes(mistakeData as MistakeRow[])
      }

      setLoading(false)
    }

    void load()
  }, [user, sessionId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white/60">加载中...</div>
    )
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-12 text-center">
        <p className="mb-4 text-white/60">没有找到练习记录</p>
        <Link href="/calculate" className="text-blue-400 hover:text-blue-300">
          返回首页
        </Link>
      </div>
    )
  }

  const accuracy = session.count > 0 ? Math.round((session.correct_count / session.count) * 100) : 0
  const avgSec = session.count > 0 ? Math.round(session.time_spent_sec / session.count) : 0
  const levelInfo = session.level_id ? getLevel(session.level_id as LevelId) : null
  const sortedErrors = Object.entries(session.error_summary ?? {}).sort(([, a], [, b]) => b - a)
  const topErrorTag = sortedErrors[0]?.[0]

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <Link href="/calculate" className="text-white/60 hover:text-white">
          ◀
        </Link>
        <h1 className="text-lg font-bold text-white">练习报告</h1>
      </div>

      {/* Score */}
      <div className="mb-6 rounded-2xl bg-white/[0.06] p-6 text-center">
        <div className="text-5xl font-bold text-amber-400">{session.stars_earned}</div>
        <div className="mt-1 text-sm text-white/40">本次得分</div>
        {levelInfo && (
          <div className="mt-2 text-xs text-white/30">
            {session.level_id} {levelInfo.name}
            {session.tier && ` · ${session.tier === 'beginner' ? '入门' : session.tier === 'advanced' ? '进阶' : '挑战'}`}
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <Stat label="正确率" value={`${accuracy}%`} highlight={accuracy >= 80} />
        <Stat label="用时" value={formatTime(session.time_spent_sec)} />
        <Stat label="答对/总数" value={`${session.correct_count}/${session.count}`} />
        <Stat label="平均题时" value={`${avgSec}秒/题`} />
      </div>

      {/* Trend */}
      {trend.length > 1 && (
        <div className="mb-6 rounded-2xl bg-white/[0.06] p-4">
          <div className="mb-3 text-xs font-medium text-white/40">近 {trend.length} 次正确率趋势</div>
          <div className="flex h-20 items-end gap-2">
            {trend.map((acc, i) => {
              const pct = Math.round(acc * 100)
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t transition-all ${
                      pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ height: `${Math.max(8, pct)}%` }}
                  />
                  <div className="text-[10px] text-white/40">{pct}%</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Error breakdown */}
      {sortedErrors.length > 0 && (
        <div className="mb-6 rounded-2xl bg-white/[0.06] p-4">
          <div className="mb-3 text-xs font-medium text-white/40">薄弱点</div>
          {sortedErrors.slice(0, 5).map(([tag, count]) => {
            const label = ERROR_TAG_LABELS[tag] ?? tag
            return (
              <div key={tag} className="mb-2 flex items-center gap-2">
                <div className="w-24 text-xs text-white/60">{label}</div>
                <div className="flex-1">
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${count >= 3 ? 'bg-red-500' : 'bg-amber-500'}`}
                      style={{ width: `${Math.min(100, (count / Math.max(session.wrong_count, 1)) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="w-8 text-right text-xs text-white/40">{count}次</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Mistakes detail */}
      {mistakes.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 text-xs font-medium text-white/40">错题详情</div>
          <div className="flex flex-col gap-2">
            {mistakes.slice(0, 5).map((m) => (
              <div key={m.id} className="rounded-2xl bg-white/[0.06] p-3">
                <div className="mb-1 text-sm font-bold text-white">{m.question_signature}</div>
                <div className="text-xs text-white/50">
                  你: <span className="text-red-400">{m.user_answer}</span> · 正确:{' '}
                  <span className="text-green-400">{m.correct_answer}</span>
                </div>
                {m.error_tag && (
                  <div className="mt-1 inline-block rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-400">
                    {ERROR_TAG_LABELS[m.error_tag] ?? m.error_tag}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next suggestion */}
      {topErrorTag && (
        <div className="mb-6 rounded-2xl bg-blue-500/10 p-4">
          <div className="mb-1 text-xs font-medium text-blue-300">下次建议</div>
          <div className="text-sm text-white/80">
            重点练习「{ERROR_TAG_LABELS[topErrorTag] ?? topErrorTag}」类题型
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href="/calculate/mistakes"
          className="flex-1 rounded-xl bg-white/10 py-3 text-center font-bold text-white/80 hover:bg-white/15"
        >
          专项练习
        </Link>
        <Link
          href={
            session.level_id
              ? `/calculate/session?level=${session.level_id}&tier=${session.tier ?? 'beginner'}`
              : '/calculate/session?mode=daily'
          }
          className="flex-1 rounded-xl bg-blue-600 py-3 text-center font-bold text-white hover:bg-blue-500"
        >
          再来一局
        </Link>
      </div>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] p-4 text-center">
      <div className={`text-2xl font-bold ${highlight ? 'text-green-400' : 'text-white'}`}>{value}</div>
      <div className="mt-1 text-xs text-white/40">{label}</div>
    </div>
  )
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}分${s}秒` : `${s}秒`
}
