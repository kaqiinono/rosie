'use client'

import { useParams, useRouter } from 'next/navigation'
import { AdaptivePlanSession } from '@rosie/english'

/** Practice entry — opens in session (not the plan hub/detail). */
export default function AdaptivePlanPracticePage() {
  const router = useRouter()
  const params = useParams()
  const planId = typeof params.planId === 'string' ? params.planId : ''

  return (
    <AdaptivePlanSession
      planId={planId}
      autoStart
      onBack={() => router.push(`/english/words/adaptive/${planId}`)}
    />
  )
}
