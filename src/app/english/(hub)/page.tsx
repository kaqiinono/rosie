'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useWordMastery } from '@/hooks/useWordMastery'
import { isGraduated } from '@/utils/masteryUtils'
import type { WordMasteryMap } from '@/utils/type'

// ─── helpers ────────────────────────────────────────────────────────────────

function formatLastSeen(date: string | null): string {
  if (!date) return '--'
  const diffDays = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays <= 30) return `${diffDays}天前`
  return date
}

type Stats = {
  totalWords: number
  totalPractice: number
  accuracy: string
  lastSeen: string | null
  dueToday: number
  graduated: number
}

function computeStats(masteryMap: WordMasteryMap): Stats {
  const today = new Date().toISOString().slice(0, 10)
  const entries = Object.values(masteryMap)

  let totalCorrect = 0
  let totalIncorrect = 0
  let dueToday = 0
  let graduated = 0
  const validDates: string[] = []

  for (const info of entries) {
    totalCorrect += info.correct
    totalIncorrect += info.incorrect
    if (info.nextReviewDate !== undefined && info.nextReviewDate <= today) dueToday++
    if (isGraduated(info)) graduated++
    if (info.lastSeen !== '') validDates.push(info.lastSeen)
  }

  const total = totalCorrect + totalIncorrect
  const accuracy = total === 0 ? '--' : `${Math.round((totalCorrect / total) * 100)}%`
  const lastSeen = validDates.length > 0
    ? validDates.reduce((a, b) => (a > b ? a : b))
    : null

  return {
    totalWords: entries.length,
    totalPractice: total,
    accuracy,
    lastSeen,
    dueToday,
    graduated,
  }
}

// ─── sub-components ─────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: string
  label: string
  value: string | number
  highlight?: boolean
}) {
  return (
    <div
      className={[
        'rounded-2xl bg-white p-4 flex flex-col gap-1 border',
        highlight ? 'border-app-green bg-app-green-light' : 'border-border-light',
      ].join(' ')}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-2xl font-black text-text-primary leading-none">{value}</span>
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  )
}

function StatSkeleton() {
  return (
    <div className="rounded-2xl bg-white p-4 border border-border-light flex flex-col gap-1">
      <div className="w-8 h-8 rounded bg-gray-100 animate-pulse" />
      <div className="w-16 h-7 rounded bg-gray-100 animate-pulse mt-1" />
      <div className="w-20 h-3 rounded bg-gray-100 animate-pulse mt-1" />
    </div>
  )
}

const NAV_CARDS = [
  { href: '/english/words/cards',    icon: '🃏', title: '单词卡片',  desc: '浏览和翻转单词卡' },
  { href: '/english/words/daily',    icon: '📅', title: '每日打卡',  desc: '完成今日单词计划' },
  { href: '/english/words/practice', icon: '🏋️', title: '练习模式',  desc: '拼写和词义练习' },
]

// ─── page ───────────────────────────────────────────────────────────────────

export default function EnglishHubPage() {
  const { user, loading } = useAuth()
  const { masteryMap } = useWordMastery(user)

  const stats = computeStats(masteryMap)
  const isEmpty = !loading && user !== null && Object.keys(masteryMap).length === 0

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-8">

      {/* Stats section */}
      <section>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
          学习进度
        </h2>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <StatSkeleton key={i} />)}
          </div>
        ) : !user ? (
          <p className="text-text-secondary text-sm py-4">请先登录查看学习进度。</p>
        ) : isEmpty ? (
          <p className="text-text-secondary text-sm py-4">还没有打卡记录，快去打卡吧！</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard icon="📚" label="已接触单词" value={stats.totalWords} />
            <StatCard icon="✏️" label="总打卡次数" value={stats.totalPractice} />
            <StatCard icon="🎯" label="正确率"     value={stats.accuracy} />
            <StatCard icon="🕐" label="最近打卡"   value={formatLastSeen(stats.lastSeen)} />
            <StatCard icon="🔔" label="今日待复习" value={stats.dueToday} highlight={stats.dueToday > 0} />
            <StatCard icon="🦋" label="已毕业单词" value={stats.graduated} />
          </div>
        )}
      </section>

      {/* Nav cards */}
      <section>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
          开始学习
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {NAV_CARDS.map(card => (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-2xl p-5 flex flex-col gap-2 transition-transform hover:scale-[1.02] no-underline"
              style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-eng-from) 10%, transparent) 0%, color-mix(in srgb, var(--color-eng-to) 10%, transparent) 100%)',
                border: '1.5px solid color-mix(in srgb, var(--color-eng-from) 25%, transparent)',
              }}
            >
              <span className="text-3xl">{card.icon}</span>
              <span className="text-base font-bold text-text-primary">{card.title}</span>
              <span className="text-xs text-text-secondary">{card.desc}</span>
            </Link>
          ))}
        </div>
      </section>

    </main>
  )
}
