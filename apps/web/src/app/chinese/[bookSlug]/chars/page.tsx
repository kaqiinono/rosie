import { Suspense } from 'react'
import { ChineseCharsPage } from '@rosie/chinese'

export default function ChineseBookCharsRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-center text-sm text-slate-500">加载中…</p>}>
      <ChineseCharsPage />
    </Suspense>
  )
}
