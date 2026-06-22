'use client'

import NavigationLink from './NavigationLink'

interface BackLinkProps {
  href?: string
  label?: string
}

export default function BackLink({ href = '/', label = '返回首页' }: BackLinkProps) {
  return (
    <NavigationLink
      href={href}
      className="fixed top-4 left-4 z-10 flex items-center gap-1.5 rounded-xl border border-black/6 bg-white/80 px-3.5 py-2 text-[13px] font-bold text-slate-500 shadow-sm backdrop-blur-xl transition-all hover:text-slate-800 hover:border-black/12 hover:-translate-x-0.5 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:text-slate-200"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 18-6-6 6-6" />
      </svg>
      {label}
    </NavigationLink>
  )
}
