'use client'

import { useParams, useRouter } from 'next/navigation'
import { AdaptivePlanSession, WordsProvider } from '@rosie/english'

function AdaptivePlanPageInner() {
  const router = useRouter()
  const params = useParams()
  const planId = typeof params.planId === 'string' ? params.planId : ''

  return (
    <AdaptivePlanSession
      planId={planId}
      onBack={() => router.push('/english/words/daily')}
    />
  )
}

export default function AdaptivePlanPage() {
  return (
    <WordsProvider>
      <AdaptivePlanPageInner />
    </WordsProvider>
  )
}
