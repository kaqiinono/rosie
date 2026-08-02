'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { AdaptivePlanSession, WordsProvider } from '@rosie/english'

function AdaptivePlanPageInner() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const planId = typeof params.planId === 'string' ? params.planId : ''
  // Capture once so clearing `?start=1` from the URL doesn't cancel auto-start.
  const [autoStart] = useState(() => searchParams.get('start') === '1')

  useEffect(() => {
    if (!autoStart || !planId) return
    if (searchParams.get('start') !== '1') return
    const next = new URLSearchParams(searchParams.toString())
    next.delete('start')
    const qs = next.toString()
    router.replace(`/english/words/adaptive/${planId}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [autoStart, searchParams, router, planId])

  return (
    <AdaptivePlanSession
      planId={planId}
      autoStart={autoStart}
      onBack={() => router.push('/english/words/daily')}
    />
  )
}

export default function AdaptivePlanPage() {
  return (
    <WordsProvider>
      <Suspense
        fallback={
          <div className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--wm-text-dim)]">
            加载中…
          </div>
        }
      >
        <AdaptivePlanPageInner />
      </Suspense>
    </WordsProvider>
  )
}
