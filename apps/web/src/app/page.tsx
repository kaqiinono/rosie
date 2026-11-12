'use client'

import { NavigationLink, OrbBackground } from '@rosie/ui'
import { useAuth } from '@rosie/core'
import { useGreeting } from '@/hooks/useGreeting'
import HomeStatsPanel from '@/components/HomeStatsPanel'

const modules = [
  { href: '/time-tree', title: '生命树', icon: '🌳', tint: 'bg-emerald-100' },
  { href: '/today', title: '今日计划', icon: '🎯', tint: 'bg-amber-100' },
  { href: '/tasks/timetable', title: '课程表', icon: '🗓️', tint: 'bg-sky-100' },
  { href: '/calc', title: '口算天地', icon: '🧮', tint: 'bg-violet-100' },
  { href: '/math', title: '数学乐园', icon: '🔢', tint: 'bg-indigo-100' },
  { href: '/english', title: '英语天地', icon: '📖', tint: 'bg-emerald-100' },
  { href: '/chinese', title: '语文园地', icon: '📜', tint: 'bg-orange-100' },
  { href: '/ai', title: 'AI 助手', icon: '✨', tint: 'bg-cyan-100' },
  { href: '/mistakes', title: '错题本', icon: '📕', tint: 'bg-rose-100' },
  { href: '/vouchers', title: '我的奖券', icon: '⭐', tint: 'bg-yellow-100' },
  { href: '/draw', title: '抽一抽', icon: '🎡', tint: 'bg-amber-100' },
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
          <h1 className="mt-1.5 text-[clamp(28px,5vw,38px)] leading-tight font-black text-[var(--accent-11)]">
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
              className="border-kid-line shadow-sticker-sm ease-spring hover:shadow-sticker-accent active:shadow-sticker-pressed flex min-h-14 items-center gap-2 rounded-full border-2 bg-white px-3 py-2 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent-8)] focus-visible:outline-2 focus-visible:outline-[var(--focus-8)] active:translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <span
                aria-hidden
                className={`grid size-9 shrink-0 place-items-center rounded-full text-lg ${tint}`}
              >
                {icon}
              </span>
              <span className="text-text-primary text-sm font-bold">{title}</span>
            </NavigationLink>
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
