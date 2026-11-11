'use client'

import { PageShell } from '@rosie/ui'
import { AdminSettingsCards } from '@/components/settings/SettingsHub'

export default function AdminHomePage() {
  return (
    <PageShell
      tone="rose"
      width="narrow"
      backHref="/setting"
      backLabel="返回用户配置"
      icon="🛠"
      title="管理后台"
    >
      <h2 className="text-[22px] font-black text-slate-800">全局配置</h2>
      <p className="mt-1 mb-6 text-[13px] text-slate-500">管理员专用 · 管理全局内容和账户</p>
      <AdminSettingsCards />
    </PageShell>
  )
}
