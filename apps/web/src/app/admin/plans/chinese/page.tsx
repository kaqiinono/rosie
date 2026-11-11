'use client'

import { PageShell } from '@rosie/ui'
import { ChineseRoadmapPlanManage } from '@rosie/chinese'

export default function AdminChinesePlansPage() {
  return (
    <PageShell
      tone="peach"
      width="wide"
      padded={false}
      backHref="/setting/plans"
      title="语文计划管理"
    >
      <ChineseRoadmapPlanManage />
    </PageShell>
  )
}
