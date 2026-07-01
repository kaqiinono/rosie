import { Suspense } from 'react'
import { ChineseCharCardsPage } from '@rosie/chinese'

export default function ChineseCharCardsRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-center text-sm text-slate-500">加载中…</p>}>
      <ChineseCharCardsPage />
    </Suspense>
  )
}
