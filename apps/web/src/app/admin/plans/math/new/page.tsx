'use client'

import { PageShell } from '@rosie/ui'
import MathWeeklyPlanEditor from '@rosie/math/components/MathWeeklyPlanEditor'
import { MATH_PLAN_PROBLEM_SETS } from '@/lib/math-plan-problem-sets'

export default function AdminNewMathPlanPage() {
  return (
    <PageShell
      tone="peach"
      width="narrow"
      padded={false}
      backHref="/setting/plans/math"
      title="新建数学计划"
    >
      <MathWeeklyPlanEditor problemSets={MATH_PLAN_PROBLEM_SETS} />
    </PageShell>
  )
}
