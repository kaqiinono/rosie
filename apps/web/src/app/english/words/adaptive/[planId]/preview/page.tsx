'use client'

import { useParams, useRouter } from 'next/navigation'
import { AdaptivePlanPreview } from '@rosie/english'

export default function AdaptivePlanPreviewPage() {
  const router = useRouter()
  const params = useParams()
  const planId = typeof params.planId === 'string' ? params.planId : ''

  // WordsProvider already wraps english/words via layout.
  return (
    <AdaptivePlanPreview
      planId={planId}
      onBack={() => router.push(`/english/words/adaptive/${planId}`)}
    />
  )
}
