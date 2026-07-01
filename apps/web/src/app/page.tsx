'use client'

import Link from 'next/link'
import { OrbBackground } from '@rosie/ui'
import { ModuleCard } from '@rosie/ui'
import { useGreeting } from '@/hooks/useGreeting'
import { useHomeStats } from '@/hooks/useHomeStats'
import HomeStatsPanel from '@/components/HomeStatsPanel'
import { useAuth } from '@rosie/core'
import type { ModuleCardData } from '@rosie/core'

const baseModules: ModuleCardData[] = [
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
  {
    href: '/today',
    title: '今日计划',
    description: '一键查看今天的数学题目和英语单词，高效完成每日任务。',
    tag: 'TODAY',
    variant: 'today',
    stats: ['数学每日一练', '英语每日一练', '进度追踪'],
    enterText: '查看今日计划',
    icon: '🗓️',
  },
  {
    href: '/calc',
    title: '口算天地',
    description: '加减乘除闯关，答对得金币，金币兑换心愿奖券。',
    tag: 'CALC',
    variant: 'calc',
    stats: ['加减乘除闯关', '金币兑换奖券', '错题本'],
    enterText: '开始口算',
    icon: '🧮',
  },
  {
    href: '/mistakes',
    title: '错题本',
    description: '汇总数学、口算等各模块错题，点击进入对应练习，答对后自动标记已改正。',
    tag: 'MISTAKES',
    variant: 'today',
    stats: ['跨模块汇总', '状态筛选', '一键练习'],
    enterText: '打开错题本',
    icon: '📕',
  },
  {
    href: '/flipbook',
    title: '绘本阅读',
    description: '3D 翻页讲义，上传 PDF 与讲解音频，按时间轴自动翻页。',
    tag: 'READ',
    variant: 'reading',
    stats: ['PDF 翻页', '音频联动', '进度保存'],
    enterText: '打开书架',
    icon: '📕',
  },
  {
    href: '/audio',
    title: '音频天地',
    description: '阅读、绘本、我的最爱，收藏夹连播，单曲/列表循环随心听。',
    tag: 'AUDIO',
    variant: 'reading',
    stats: ['收藏夹连播', '循环次数', '我的最爱'],
    enterText: '开始听音频',
    icon: '🎧',
  },
  {
    href: '/vouchers',
    title: '我的奖券',
    description: '口算、英语、数学均可赚星星，积攒后兑换心愿奖券。',
    tag: 'STARS',
    variant: 'calc',
    stats: ['全模块通用', '兑换奖券', '星星余额'],
    enterText: '查看奖券',
    icon: '⭐',
  },
]

export default function HomePage() {
  const greeting = useGreeting()
  const { user } = useAuth()
  const { stats, isLoading: statsLoading } = useHomeStats(user)
  const raw = user?.email?.replace('@rosie.app', '') ?? user?.email?.split('@')[0]
  const username = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : undefined

  const modules = baseModules

  return (
    <>
      <OrbBackground variant="home" />

      <div className="relative z-1 flex min-h-screen flex-col items-center justify-center gap-9 px-5 py-8 pt-12 pb-12">
        <section className="max-w-[540px] text-center">
          <div className="animate-wave inline-block origin-[70%_70%] text-[52px]">👋</div>
          <div className="text-text-secondary mt-2 text-[15px] font-semibold tracking-wide">
            {greeting}
          </div>
          <h1 className="mt-1.5 bg-gradient-to-br from-slate-800 via-indigo-500 to-emerald-500 bg-clip-text text-[clamp(28px,5vw,38px)] leading-tight font-black text-transparent">
            {username ?? 'Rosie'} 的学习乐园
          </h1>
        </section>

        {user && (
          <HomeStatsPanel stats={stats} isLoading={statsLoading} />
        )}

        <section className="grid w-full max-w-[760px] grid-cols-1 gap-5 sm:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
          {modules.map((mod) => (
            <ModuleCard key={mod.href} data={mod} />
          ))}
        </section>

        <div className="flex flex-col items-center gap-2">
          <div className="text-text-muted text-xs">
            Made with <em className="text-rose-500 not-italic">♥</em> for {username ?? 'Rosie'}
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold text-slate-400 transition hover:text-amber-700"
            style={{
              background: 'rgba(148,163,184,0.08)',
              border: '1px solid rgba(148,163,184,0.18)',
            }}
            aria-label="管理"
          >
            <span aria-hidden>🛠</span>
            <span>管理</span>
          </Link>
        </div>
      </div>
    </>
  )
}
