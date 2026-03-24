'use client'

import Link from 'next/link'
import OrbBackground from '@/components/shared/OrbBackground'
import ModuleCard from '@/components/shared/ModuleCard'
import { useGreeting } from '@/hooks/useGreeting'
import { useAuth } from '@/contexts/AuthContext'
import type { ModuleCardData } from '@/utils/type'

const modules: ModuleCardData[] = [
  {
    href: '/math',
    title: '数学乐园',
    description: '加减乘除、应用题、趣味动画，用故事理解数学。',
    tag: 'MATH',
    variant: 'math',
    stats: ['乘法分配律', '归一问题', '动画演示'],
    enterText: '开始数学学习',
    icon: '🔢',
  },
  {
    href: '/english',
    title: '英语天地',
    description: '背单词、拼写练习、沉浸模式，轻松记住每个单词。',
    tag: 'ENGLISH',
    variant: 'english',
    stats: ['单词卡片', '拼写练习', '每日一练'],
    enterText: '开始英语学习',
    icon: '📖',
  },
]

const todayCard = {
  href: '/today',
  title: '今日计划',
  description: '一键查看今天的数学题目和英语单词，高效完成每日任务。',
  stats: ['数学每日一练', '英语每日一练', '进度追踪'],
  icon: '🗓️',
}

export default function HomePage() {
  const greeting = useGreeting()
  const { user, loading } = useAuth()
  const username = user?.email?.replace('@rosie.app', '') ?? user?.email?.split('@')[0]

  return (
    <>
      <OrbBackground variant="home" />

      <div className="relative z-1 flex min-h-screen flex-col items-center justify-center gap-9 px-5 py-8 pb-12">
        <section className="max-w-[540px] text-center">
          <div className="inline-block origin-[70%_70%] animate-wave text-[52px]">
            👋
          </div>
          <div className="mt-2 text-[15px] font-semibold tracking-wide text-text-secondary">
            {greeting}
          </div>
          <h1 className="mt-1.5 bg-gradient-to-br from-slate-800 via-indigo-500 to-emerald-500 bg-clip-text text-[clamp(28px,5vw,38px)] font-black leading-tight text-transparent">
            Rosie 的学习乐园
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-text-secondary">
            选一个模块开始今天的学习吧
          </p>

          {/* Login status */}
          {!loading && (
            <div className="mt-4 flex items-center justify-center">
              {user ? (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[0.8rem] text-green-700"
                  style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                  已登录：{username} · 进度云端同步中
                </div>
              ) : (
                <Link href="/auth"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[0.8rem] transition-all hover:scale-105"
                  style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.22)', color: '#6366f1' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  未登录 · 点击登录同步进度
                </Link>
              )}
            </div>
          )}
        </section>

        <section className="grid w-full max-w-[760px] grid-cols-1 gap-5 sm:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
          {modules.map((mod) => (
            <ModuleCard key={mod.href} data={mod} />
          ))}
        </section>

        {/* Today card */}
        <Link
          href={todayCard.href}
          className="no-underline w-full max-w-[760px]"
        >
          <div
            className="flex items-center gap-4 rounded-2xl px-5 py-4 transition-all hover:scale-[1.01]"
            style={{
              background: 'linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(249,115,22,0.10) 100%)',
              border: '1.5px solid rgba(251,191,36,0.35)',
            }}
          >
            <div className="text-3xl shrink-0">{todayCard.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-bold text-amber-800">{todayCard.title}</div>
              <div className="text-[12px] text-amber-700 mt-0.5 line-clamp-1">{todayCard.description}</div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {todayCard.stats.map(s => (
                  <span key={s} className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <span className="text-amber-500 text-lg shrink-0">→</span>
          </div>
        </Link>

        <div className="text-xs text-text-muted">
          Made with <em className="not-italic text-rose-500">♥</em> for Rosie
        </div>
      </div>
    </>
  )
}
