'use client'

import { OrbBackground, BackLink } from '@rosie/ui'
import { useAuth } from '@rosie/core'
import { EnglishQuickLinkGrid } from '@rosie/english'

export default function EnglishPage() {
  const { user } = useAuth()
  const raw = user?.email?.replace('@rosie.app', '') ?? user?.email?.split('@')[0]
  const username = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : undefined

  return (
    <>
      <OrbBackground variant="home" />
      <BackLink />

      <div className="relative z-1 flex min-h-screen flex-col items-center gap-7 px-5 pt-24 pb-12 max-[500px]:gap-5 max-[500px]:px-3.5 max-[500px]:pt-20 max-[500px]:pb-8">
        <section className="max-w-[480px] text-center">
          <div className="animate-bounce-slow inline-block text-5xl">📚</div>
          <h1 className="mt-2 bg-gradient-to-br from-rose-700 via-pink-600 to-sky-500 bg-clip-text text-[clamp(26px,5vw,34px)] leading-tight font-black text-transparent">
            英语探险乐园
          </h1>
          <p className="text-text-secondary mt-1.5 text-sm leading-relaxed">
            背单词、做练习、读课文，开启今天的英语冒险吧
          </p>
        </section>

        <section className="w-full max-w-[680px]">
          <EnglishQuickLinkGrid />
        </section>

        <div className="text-text-muted text-xs">{username ?? 'Rosie'} 的英语探险乐园</div>
      </div>
    </>
  )
}
