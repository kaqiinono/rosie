'use client'

import { NavigationLink, OrbBackground } from '@rosie/ui'
import { useAuth } from '@rosie/core'
import { useGreeting } from '@/hooks/useGreeting'
import { DrawCard } from '@rosie/rewards'
import HomeStatsPanel from '@/components/HomeStatsPanel'

const modules = [
  { href: '/today', title: '今日计划', icon: '🎯', tint: 'bg-amber-100' },
  { href: '/tasks/timetable', title: '课程表', icon: '🗓️', tint: 'bg-sky-100' },
  { href: '/calc', title: '口算天地', icon: '🧮', tint: 'bg-violet-100' },
  { href: '/math', title: '数学乐园', icon: '🔢', tint: 'bg-indigo-100' },
  { href: '/english', title: '英语天地', icon: '📖', tint: 'bg-emerald-100' },
  { href: '/chinese', title: '语文园地', icon: '📜', tint: 'bg-orange-100' },
  { href: '/ai', title: 'AI 助手', icon: '✨', tint: 'bg-cyan-100' },
  { href: '/mistakes', title: '错题本', icon: '📕', tint: 'bg-rose-100' },
  { href: '/flipbook', title: '绘本阅读', icon: '📚', tint: 'bg-orange-100' },
  { href: '/audio', title: '音频天地', icon: '🎧', tint: 'bg-sky-100' },
  { href: '/vouchers', title: '我的奖券', icon: '⭐', tint: 'bg-yellow-100' },
]

export default function HomePage() {
  const greeting = useGreeting()
  const { user } = useAuth()
  const raw = user?.email?.replace('@rosie.app', '') ?? user?.email?.split('@')[0]
  const username = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : undefined

  return (
    <>
      <OrbBackground variant="home" />

      <div className="relative z-1 flex min-h-screen flex-col items-center justify-center gap-5 px-4 py-12 sm:px-5">
        <section className="max-w-[540px] text-center">
          <picture>
            {/* Animated WebP must stay unoptimized so the browser receives every frame. */}
            <img
              src="/brand/rosie-fun-hop.webp?v=3"
              alt="Rosie Fun"
              width={144}
              height={128}
              className="home-rosie-animation mx-auto h-32 w-36 object-contain drop-shadow-[0_12px_18px_rgba(251,113,133,0.2)]"
            />
            <img
              src="/brand/rosie-fun-mascot.png"
              alt="Rosie Fun"
              width={144}
              height={128}
              className="home-rosie-static mx-auto hidden h-32 w-36 object-contain drop-shadow-[0_12px_18px_rgba(251,113,133,0.2)]"
            />
          </picture>
          <div className="text-text-secondary mt-2 text-[15px] font-semibold tracking-wide">
            {greeting}
          </div>
          <h1 className="mt-1.5 bg-gradient-to-br from-slate-800 via-indigo-500 to-emerald-500 bg-clip-text text-[clamp(28px,5vw,38px)] leading-tight font-black text-transparent">
            {username ?? 'Rosie'} 的炸弹乐园
          </h1>
        </section>

        <nav
          aria-label="功能菜单"
          className="grid w-full max-w-[1040px] grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6"
        >
          {modules.map(({ href, title, icon, tint }) => (
            <NavigationLink
              key={href}
              href={href}
              className="flex min-h-14 items-center gap-2 rounded-xl border border-border-light bg-surface px-3 py-2 shadow-sm transition hover:border-indigo-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-indigo-500"
            >
              <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-lg text-lg ${tint}`}>
                {icon}
              </span>
              <span className="text-sm font-bold text-text-primary">{title}</span>
            </NavigationLink>
          ))}
        </nav>

        {user && <DrawCard key={user.id} userId={user.id} />}
        <HomeStatsPanel />

        <div className="text-text-muted text-xs">
          Made with <em className="text-rose-500 not-italic">♥</em> for {username ?? 'Rosie'}
        </div>
      </div>
    </>
  )
}
