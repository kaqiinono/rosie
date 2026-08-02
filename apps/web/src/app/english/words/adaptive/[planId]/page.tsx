'use client'

import { useParams, useRouter } from 'next/navigation'
import { AdaptivePlanSession } from '@rosie/english'

/** Plan hub / detail — tap「开始」to practice; never auto-starts. */
export default function AdaptivePlanPage() {
  const router = useRouter()
  const params = useParams()
  const planId = typeof params.planId === 'string' ? params.planId : ''

  // WordsProvider already wraps english/words via layout — don't nest another.
  return (
    <AdaptivePlanSession
      planId={planId}
      autoStart={false}
      onBack={() => router.push('/english/words/daily')}
    />
  )
}
