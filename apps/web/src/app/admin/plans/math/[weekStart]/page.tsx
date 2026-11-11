'use client'

import { PageShell } from '@rosie/ui'
import { useParams } from 'next/navigation'
import MathWeeklyPlanEditor from '@rosie/math/components/MathWeeklyPlanEditor'
import { MATH_PLAN_PROBLEM_SETS } from '@/lib/math-plan-problem-sets'

export default function AdminEditMathPlanPage() {
  const params = useParams()
  const weekStart = typeof params.weekStart === 'string' ? decodeURIComponent(params.weekStart) : ''

  return (
    <PageShell
      tone="peach"
      width="narrow"
      padded={false}
      backHref="/setting/plans/math"
      title="编辑数学计划"
    >
      <MathWeeklyPlanEditor problemSets={MATH_PLAN_PROBLEM_SETS} editWeekStart={weekStart} />
    </PageShell>
  )
}
