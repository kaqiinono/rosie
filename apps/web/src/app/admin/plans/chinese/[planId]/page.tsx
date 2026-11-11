'use client'

import { PageShell } from '@rosie/ui'
import { useParams } from 'next/navigation'
import { ChineseRoadmapPlanEditor } from '@rosie/chinese'

export default function AdminEditChinesePlanPage() {
  const params = useParams()
  const planId = typeof params.planId === 'string' ? params.planId : ''

  return (
    <PageShell
      tone="peach"
      width="narrow"
      padded={false}
      backHref="/setting/plans/chinese"
      title="编辑语文计划"
    >
      <ChineseRoadmapPlanEditor editPlanId={planId} />
    </PageShell>
  )
}
