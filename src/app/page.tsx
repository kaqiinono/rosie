'use client'

import OrbBackground from '@/components/shared/OrbBackground'
import ModuleCard from '@/components/shared/ModuleCard'
import { useGreeting } from '@/hooks/useGreeting'
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
    href: '/english/words',
    title: '英语天地',
    description: '背单词、拼写练习、沉浸模式，轻松记住每个单词。',
    tag: 'ENGLISH',
    variant: 'english',
    stats: ['单词卡片', '拼写练习', '每日一练'],
    enterText: '开始英语学习',
    icon: '📖',
  },
]

export default function HomePage() {
  const greeting = useGreeting()

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
        </section>

        <section className="grid w-full max-w-[760px] grid-cols-1 gap-5 sm:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
          {modules.map((mod) => (
            <ModuleCard key={mod.href} data={mod} />
          ))}
        </section>

        <div className="text-xs text-text-muted">
          Made with <em className="not-italic text-rose-500">♥</em> for Rosie
        </div>
      </div>
    </>
  )
}
