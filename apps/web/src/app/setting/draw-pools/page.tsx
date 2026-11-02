import { DrawPoolManager } from '@rosie/rewards'
import { PageBreadcrumb } from '@rosie/ui'

export default function DrawPoolsPage() {
  return <main className="mx-auto min-h-screen max-w-3xl space-y-5 px-4 py-8">
    <PageBreadcrumb variant="inline" />
    <h1 className="text-2xl font-black">奖惩管理</h1>
    <DrawPoolManager />
  </main>
}
