import { Suspense } from 'react'
import { ChineseGardenQuizPage } from '@rosie/chinese'

export default function ChineseGardenRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-center text-sm text-slate-500">加载中…</p>}>
      <ChineseGardenQuizPage />
    </Suspense>
  )
}
