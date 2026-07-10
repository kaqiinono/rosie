'use client'

import { useParams, useRouter } from 'next/navigation'
import { AdaptivePlanPreview, WordsProvider } from '@rosie/english'

function AdaptivePlanPreviewPageInner() {
  const router = useRouter()
  const params = useParams()
  const planId = typeof params.planId === 'string' ? params.planId : ''

  return (
    <AdaptivePlanPreview
      planId={planId}
      onBack={() => router.push(`/english/words/adaptive/${planId}`)}
    />
  )
}

export default function AdaptivePlanPreviewPage() {
  return (
    <WordsProvider>
      <AdaptivePlanPreviewPageInner />
    </WordsProvider>
  )
}
