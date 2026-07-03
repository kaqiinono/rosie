import { Suspense } from 'react'
import { ChineseCharsPracticeSession } from '@rosie/chinese'

export default function ChineseCharsPracticeRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-center text-sm text-amber-900/50">加载练习…</p>}>
      <ChineseCharsPracticeSession />
    </Suspense>
  )
}
