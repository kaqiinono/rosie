import { Suspense } from 'react'
import { ChineseCharWritingPage } from '@rosie/chinese'

export default function ChineseCharWritingRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-center text-sm text-slate-500">加载中…</p>}>
      <ChineseCharWritingPage />
    </Suspense>
  )
}
