import { PageBreadcrumb } from '@rosie/ui'
import BaiduOAuthConnect from '@/components/settings/BaiduOAuthConnect'
import BaiduMathVideoManager from '@/components/settings/BaiduMathVideoManager'

export default function SyncPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-blue-50">
      <header className="sticky top-0 z-30 border-b border-border-light bg-white/85 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-[860px] items-center gap-3 px-4">
          <PageBreadcrumb variant="inline" />
          <span className="text-base font-extrabold text-text-primary">同步管理</span>
        </div>
      </header>
      <main className="mx-auto max-w-[860px] px-4 py-8 pb-24">
        <h1 className="text-2xl font-black text-text-primary">同步管理</h1>
        <p className="mt-1 text-sm text-text-secondary">管理百度网盘授权与数学回放清单。</p>
        <BaiduOAuthConnect target="shared">
          <BaiduMathVideoManager />
        </BaiduOAuthConnect>
      </main>
    </div>
  )
}
