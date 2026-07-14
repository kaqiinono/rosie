import { Suspense } from 'react'
import { EnglishPracticePrintPage } from '@rosie/english'

export default function EnglishWordsPracticePrintRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-center text-sm text-slate-500">加载打印页…</p>}>
      <EnglishPracticePrintPage />
    </Suspense>
  )
}
