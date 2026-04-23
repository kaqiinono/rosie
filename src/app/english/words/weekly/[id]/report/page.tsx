'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useWordsContext } from '@/contexts/WordsContext'
import type { WeeklyPlan } from '@/utils/type'
import { loadWeeklyPlanById } from '@/lib/loadWeeklyPlanById'
import EnglishWeeklyReportView from '@/components/english/words/EnglishWeeklyReportView'
import EnglishWeeklyReportWordTable from '@/components/english/words/EnglishWeeklyReportWordTable'
import { buildWeeklyReportWordRows } from '@/utils/weeklyReportWordRows'

export default function WeeklyPlanReportPage() {
  const router = useRouter()
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : ''
  const { user } = useAuth()
  const { vocab, masteryMap } = useWordsContext()
  const [plan, setPlan] = useState<WeeklyPlan | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user || !id) return
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      const loaded = await loadWeeklyPlanById(user.id, id)
      if (!cancelled) {
        setPlan(loaded)
        setIsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user, id])

  const wordRows = useMemo(
    () => (plan ? buildWeeklyReportWordRows(plan, vocab, masteryMap) : []),
    [plan, vocab, masteryMap],
  )

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-[var(--wm-text-dim)]">
        加载中…
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-sm text-[var(--wm-text-dim)]">计划不存在或已删除</p>
        <Link
          href="/english/words/daily"
          className="mt-4 inline-block font-nunito text-[#fbbf24] underline"
        >
          返回周计划列表
        </Link>
      </div>
    )
  }

  const done = plan.weekCompletion
  const completedAtLabel = done
    ? new Date(done.completedAt).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })
    : ''

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-16">
      <div className="mb-6 flex flex-wrap items-center gap-3 text-[.8rem]">
        <button
          type="button"
          onClick={() => { router.back() }}
          className="cursor-pointer rounded-full border border-[var(--wm-border)] px-3 py-1.5 font-bold text-[var(--wm-text-dim)] hover:border-[var(--wm-accent)]"
        >
          ← 返回
        </button>
        <Link
          href="/english/words/daily"
          className="rounded-full border border-[var(--wm-border)] px-3 py-1.5 font-bold text-[var(--wm-text-dim)] hover:border-[#fbbf24] hover:text-[#fbbf24]"
        >
          周计划列表
        </Link>
        {plan.id && (
          <Link
            href={`/english/words/weekly/${plan.id}`}
            className="rounded-full border border-[var(--wm-border)] px-3 py-1.5 font-bold text-[var(--wm-text-dim)] hover:border-[#93c5fd] hover:text-[#93c5fd]"
          >
            去练习
          </Link>
        )}
      </div>

      {done ? (
        <>
          <div className="mb-2 rounded-[16px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-5 sm:p-7">
            <EnglishWeeklyReportView report={done.report} completedAtLabel={completedAtLabel} />
          </div>
          <h2 className="mb-1 font-fredoka text-lg text-[var(--wm-text)]">单词学习情况（核心数据）</h2>
          <p className="mb-4 text-[.82rem] text-[var(--wm-text-dim)]">
            下表含本计划每个词的判题次数、答对/错、正确率、复习轮次、SRS 阶段、下次复习时间与最近练习等；与词库里的掌握度一致，会随你继续学习实时更新。本周日测分仍然表示「该日整套测验」的一张成绩单，供对照。
          </p>
          <div className="rounded-[16px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] p-3 sm:p-5">
            <EnglishWeeklyReportWordTable rows={wordRows} />
          </div>
        </>
      ) : (
        <div className="rounded-[16px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-8 text-center">
          <p className="text-[.9rem] text-[var(--wm-text-dim)]">尚未生成本周的结课报告</p>
          <p className="mt-2 text-[.8rem] text-[var(--wm-text-dim)]">
            请在「每日学习 → 周计划」列表中点击「完成本周」生成报告后再查看本页。
          </p>
          <Link
            href="/english/words/daily"
            className="mt-5 inline-block rounded-[10px] bg-gradient-to-br from-[#d97706] to-[#f59e0b] px-6 py-2.5 text-[.88rem] font-extrabold text-white"
          >
            前往周计划列表
          </Link>
        </div>
      )}
    </div>
  )
}
