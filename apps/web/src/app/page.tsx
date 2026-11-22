'use client'

import dynamic from 'next/dynamic'
import { NavigationLink, StickerCard } from '@rosie/ui'
import { useAuth } from '@rosie/core'
import { useGreeting } from '@/hooks/useGreeting'
import HomeStatsPanel from '@/components/HomeStatsPanel'

const TodayPlanSummary = dynamic(() => import('@/components/today/TodayPlanSummary'), {
  ssr: false,
  loading: () => (
    <p role="status" className="text-text-muted min-h-48 text-sm sm:min-h-24">
      正在加载今日计划…
    </p>
  ),
})

const moduleTones = {
  green: '[--accent-2:var(--color-emerald-50)] [--accent-6:var(--color-emerald-200)] [--module-icon:var(--color-emerald-100)] [--module-hover:var(--color-emerald-400)]',
  blue: '[--accent-2:var(--color-sky-50)] [--accent-6:var(--color-sky-200)] [--module-icon:var(--color-sky-100)] [--module-hover:var(--color-sky-400)]',
  purple: '[--accent-2:var(--color-violet-50)] [--accent-6:var(--color-violet-200)] [--module-icon:var(--color-violet-100)] [--module-hover:var(--color-violet-400)]',
  amber: '[--accent-2:var(--color-amber-50)] [--accent-6:var(--color-amber-200)] [--module-icon:var(--color-amber-100)] [--module-hover:var(--color-amber-400)]',
  rose: '[--accent-2:var(--color-rose-50)] [--accent-6:var(--color-rose-200)] [--module-icon:var(--color-rose-100)] [--module-hover:var(--color-rose-400)]',
}

const moduleGroups = [
  {
    id: 'daily',
    title: '日积月累',
    columns: 'sm:grid-cols-4',
    modules: [
      { href: '/calc', title: '闪电速算王', description: '练口算提速度', icon: '🧮', tone: 'purple' },
      { href: '/time-tree', title: '生命树', description: '做作业养生命树', icon: '🌳', tone: 'green' },
      { href: '/tasks/timetable', title: '课程表', description: '看课表和提醒', icon: '🗓️', tone: 'blue' },
      { href: '/stories', title: '故事屋', description: '听读中英故事', icon: '📚', tone: 'amber' },
    ],
  },
  {
    id: 'subjects',
    title: '学科提升',
    columns: 'sm:grid-cols-4',
    modules: [
      { href: '/math', title: '数学乐园', description: '学新课练数学', icon: '🔢', tone: 'blue' },
      { href: '/english', title: '英语天地', description: '背词阅读学语法', icon: '📖', tone: 'green' },
      { href: '/chinese', title: '语文园地', description: '认字写字背古诗', icon: '📜', tone: 'amber' },
      { href: '/exams/ket', title: '考一考', description: '练剑桥英语真题', icon: '📝', tone: 'blue' },
    ],
  },
  {
    id: 'extras',
    title: '趣味与工具',
    columns: 'sm:grid-cols-3 xl:grid-cols-6',
    modules: [
      { href: '/ai', title: 'AI 助手', description: '提问和查资料', icon: '✨', tone: 'blue' },
      { href: '/mistakes', title: '错题本', description: '复习和订正错题', icon: '📕', tone: 'rose' },
      { href: '/tomato', title: '番茄计时', description: '分段专注和休息', icon: '🍅', tone: 'rose' },
      { href: '/superpowers', title: '我的超能力', description: '测测英语词汇量', icon: '⚡', tone: 'purple' },
      { href: '/vouchers', title: '我的奖券', description: '用星星兑换奖券', icon: '⭐', tone: 'amber' },
      { href: '/draw', title: '抽一抽', description: '转转盘抽奖', icon: '🎡', tone: 'amber' },
    ],
  },
] as const

export default function HomePage() {
  const greeting = useGreeting()
  const { user } = useAuth()
  const raw = user?.email?.replace('@rosie.app', '') ?? user?.email?.split('@')[0]
  const username = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : undefined

  return (
    <>
      <div className="bg-kid-paper relative z-1 flex min-h-screen flex-col items-center gap-3.5 px-4 pt-14 pb-8 sm:px-5">
        <section className="flex max-w-[540px] items-center gap-3">
          <picture className="shrink-0">
            {/* Animated WebP must stay unoptimized so the browser receives every frame. */}
            <img
              src="/brand/rosie-fun-hop.webp?v=3"
              alt="Rosie Fun"
              width={144}
              height={128}
              className="home-rosie-animation h-14 w-16 object-contain sm:h-16 sm:w-18"
            />
            <img
              src="/brand/rosie-fun-mascot.png"
              alt="Rosie Fun"
              width={144}
              height={128}
              className="home-rosie-static hidden h-14 w-16 object-contain sm:h-16 sm:w-18"
            />
          </picture>
          <div className="min-w-0">
            <div className="text-text-secondary text-xs">{greeting}</div>
            <h1 className="text-text-primary mt-1 text-lg leading-tight font-bold sm:text-xl">
              {username ?? 'Rosie'} 的炸弹乐园
            </h1>
          </div>
        </section>

        <section aria-labelledby="home-today-title" className="w-full max-w-[1040px]">
          <div className="mb-1.5 flex items-center justify-between">
            <h2 id="home-today-title" className="text-text-primary text-sm font-bold">
              今日计划
            </h2>
            <NavigationLink href="/today" className="text-sm font-bold text-[var(--accent-11)]">
              查看全部
            </NavigationLink>
          </div>
          {user && <TodayPlanSummary />}
        </section>

        <nav aria-label="功能菜单" className="grid w-full max-w-[1040px] gap-2.5">
          {moduleGroups.map(group => (
            <section key={group.id} aria-labelledby={`home-${group.id}-title`}>
              <h2 id={`home-${group.id}-title`} className="text-text-secondary mb-1 text-xs font-medium">
                {group.title}
              </h2>
              <div className={`grid grid-cols-2 gap-2 ${group.columns}`}>
                {group.modules.map(({ href, title, description, icon, tone }) => (
                  <StickerCard
                    key={href}
                    asChild
                    radius="md"
                    size="none"
                    tone="accent"
                    elevation="flat"
                    className={`ease-spring flex min-h-17 items-center gap-2 px-2.5 py-1.5 lg:px-3
                      transition-[translate,scale,border-color,box-shadow] duration-200
                      hover:border-[var(--module-hover)] hover:shadow-[0_2px_0_var(--accent-6)]
                      focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-8)]
                      motion-safe:hover:-translate-y-[3px] motion-safe:active:scale-[0.97]
                      motion-reduce:transition-none ${moduleTones[tone]}`}
                  >
                    <NavigationLink href={href}>
                      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--module-icon)] text-xl lg:size-12 lg:text-2xl">
                        {icon}
                      </span>
                      <span className="min-w-0">
                        <span className="text-text-primary block text-sm leading-tight font-bold">{title}</span>
                        <span className="text-text-secondary mt-0.5 block text-xs leading-tight">{description}</span>
                      </span>
                    </NavigationLink>
                  </StickerCard>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <HomeStatsPanel />

        <div className="text-text-muted text-xs">
          Made with <em className="text-rose-500 not-italic">♥</em> for {username ?? 'Rosie'}
        </div>
      </div>
    </>
  )
}
