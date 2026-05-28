'use client'

import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { CalculateMistake, ErrorTag } from '@/utils/calculate-types'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

const ERROR_TAG_LABELS: Record<ErrorTag, string> = {
  carry_miss: '进位遗漏',
  order_confusion: '运算顺序混淆',
  place_value: '数位理解偏差',
  fraction_concept: '分子分母混淆',
  comprehension: '题意理解偏差',
  careless: '粗心计算失误',
  formula_misuse: '公式套用错误',
  estimation_off: '估算范围偏差',
}

export default function MistakesPage() {
  const { user } = useAuth()
  const [mistakes, setMistakes] = useState<CalculateMistake[]>([])
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { data } = await supabase
        .from('calculate_mistakes')
        .select('*')
        .eq('user_id', user.id)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) {
        setMistakes(
          data.map((r) => ({
            id: r.id,
            userId: r.user_id,
            questionSignature: r.question_signature,
            levelId: r.level_id,
            userAnswer: r.user_answer,
            correctAnswer: r.correct_answer,
            errorTag: r.error_tag,
            distractorType: r.distractor_type,
            consecutiveCorrect: r.consecutive_correct,
            resolved: r.resolved,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          })),
        )
      }
    }
    void load()
  }, [user])

  const errorCounts: Record<string, number> = {}
  for (const m of mistakes) {
    if (m.errorTag) {
      errorCounts[m.errorTag] = (errorCounts[m.errorTag] ?? 0) + 1
    }
  }

  const [pageLoadedAt] = useState(() => Date.now())
  const { heatmap, maxHeat } = useMemo(() => {
    const arr: number[] = Array(7).fill(0)
    for (const m of mistakes) {
      const created = new Date(m.createdAt).getTime()
      const daysAgo = Math.floor((pageLoadedAt - created) / 86400000)
      if (daysAgo >= 0 && daysAgo < 7) {
        arr[6 - daysAgo]++
      }
    }
    return { heatmap: arr, maxHeat: Math.max(...arr, 1) }
  }, [mistakes, pageLoadedAt])
  const dayLabels = ['一', '二', '三', '四', '五', '六', '今']

  const filtered =
    filter === 'all'
      ? mistakes
      : mistakes.filter((m) => m.levelId.startsWith(filter))

  const treeFilters = ['all', 'NS', 'AS', 'MU', 'DI', 'MX', 'DE', 'FR', 'PC', 'NG', 'PW', 'AP']

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/calculate" className="text-white/60 hover:text-white">
          ◀
        </Link>
        <h1 className="text-lg font-bold text-white">错题本</h1>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {treeFilters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-white/[0.06] text-white/50 hover:text-white'
            }`}
          >
            {f === 'all' ? '全部' : f}
          </button>
        ))}
      </div>

      {/* 7-day heatmap */}
      {mistakes.length > 0 && (
        <div className="mb-4 rounded-2xl bg-white/[0.06] p-4">
          <div className="mb-3 text-xs font-medium text-white/40">近 7 天错题分布</div>
          <div className="flex gap-1.5">
            {heatmap.map((count, i) => {
              const intensity = count / maxHeat
              const bg = count === 0
                ? 'rgba(255,255,255,0.05)'
                : `rgba(244, 63, 94, ${0.2 + intensity * 0.6})`
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="flex h-12 w-full items-center justify-center rounded-md text-xs font-bold text-white"
                    style={{ backgroundColor: bg }}
                  >
                    {count > 0 ? count : ''}
                  </div>
                  <div className="text-[10px] text-white/40">{dayLabels[i]}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Error pattern stats */}
      {Object.keys(errorCounts).length > 0 && (
        <div className="mb-6 rounded-2xl bg-white/[0.06] p-4">
          <div className="mb-3 text-xs font-medium text-white/40">错误模式统计</div>
          {Object.entries(errorCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([tag, count]) => (
              <div key={tag} className="mb-2 flex items-center gap-2">
                <div className="w-24 text-xs text-white/60">
                  {ERROR_TAG_LABELS[tag as ErrorTag] ?? tag}
                </div>
                <div className="flex-1">
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${count >= 3 ? 'bg-red-500' : 'bg-amber-500'}`}
                      style={{ width: `${Math.min(100, (count / 10) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="w-8 text-right text-xs text-white/40">{count}次</div>
              </div>
            ))}
        </div>
      )}

      {/* Mistake list */}
      <div className="flex flex-col gap-2">
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-white/30">暂无错题</div>
        )}
        {filtered.map((m) => (
          <div key={m.id} className="rounded-2xl bg-white/[0.06] p-4">
            <div className="mb-1 text-sm font-bold text-white">{m.questionSignature}</div>
            <div className="mb-1 text-xs text-white/50">
              你的答案: <span className="text-red-400">{m.userAnswer}</span> 正确:{' '}
              <span className="text-green-400">{m.correctAnswer}</span>
            </div>
            <div className="flex items-center gap-2">
              {m.errorTag && (
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-400">
                  {ERROR_TAG_LABELS[m.errorTag as ErrorTag] ?? m.errorTag}
                </span>
              )}
              <span className="text-[10px] text-white/30">
                纠正: {m.consecutiveCorrect}/3
              </span>
            </div>
          </div>
        ))}
      </div>

      {filtered.length > 0 && (
        <Link
          href="/calculate/session?mode=mistakes"
          className="mt-6 block rounded-xl bg-blue-600 py-3 text-center font-bold text-white hover:bg-blue-500"
        >
          开始错题专项练习 →
        </Link>
      )}
    </div>
  )
}
