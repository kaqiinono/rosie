import { Suspense } from 'react'
import { ChineseAccumulationPage } from '@rosie/chinese'

export default function ChineseAccumulationRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-center text-sm text-slate-500">加载中…</p>}>
      <ChineseAccumulationPage />
    </Suspense>
  )
}
