import { Suspense } from 'react'
import { ChinesePhraseQuizPage } from '@rosie/chinese'

export default function ChinesePhrasesRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-center text-sm text-slate-500">加载中…</p>}>
      <ChinesePhraseQuizPage />
    </Suspense>
  )
}
