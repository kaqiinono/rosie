import { Suspense } from 'react'
import { ChinesePinyinWritePrintPage } from '@rosie/chinese'

export default function ChineseCharsPrintRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-center text-sm text-slate-500">加载打印页…</p>}>
      <ChinesePinyinWritePrintPage />
    </Suspense>
  )
}
