'use client'

import { PageShell } from '@rosie/ui'
import { ChineseRoadmapPlanEditor } from '@rosie/chinese'

export default function AdminNewChinesePlanPage() {
  return (
    <PageShell
      tone="peach"
      width="narrow"
      padded={false}
      backHref="/setting/plans/chinese"
      title="新建语文计划"
    >
      <ChineseRoadmapPlanEditor />
    </PageShell>
  )
}
