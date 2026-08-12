'use client'

import Link from 'next/link'
import { AdminSettingsCards } from '@/components/settings/SettingsHub'

export default function AdminHomePage() {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg,#fffbeb 0%,#fff1f2 45%,#eff6ff 100%)' }}>
      <header className="sticky top-0 z-30 border-b border-amber-200/40 bg-white/85 backdrop-blur"><div className="mx-auto flex h-14 max-w-[860px] items-center gap-3 px-4"><Link href="/setting" className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-300/40 bg-amber-500/10 text-amber-700" aria-label="返回用户配置">←</Link><div className="text-[17px] font-extrabold text-amber-900">🛠 管理后台</div></div></header>
      <main className="mx-auto max-w-[860px] px-4 py-8 pb-20"><h1 className="text-[22px] font-black text-slate-800">全局配置</h1><p className="mb-6 mt-1 text-[13px] text-slate-500">管理员专用 · 管理全局内容和账户</p><AdminSettingsCards /></main>
    </div>
  )
}
