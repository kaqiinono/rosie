'use client'

import { PageShell } from '@rosie/ui'
import MathWeeklyPlanManage from '@rosie/math/components/MathWeeklyPlanManage'
import { MATH_PLAN_PROBLEM_SETS } from '@/lib/math-plan-problem-sets'

export default function AdminMathPlansPage() {
  return (
    <PageShell
      tone="peach"
      width="wide"
      padded={false}
      backHref="/setting/plans"
      title="数学计划管理"
    >
      <MathWeeklyPlanManage problemSets={MATH_PLAN_PROBLEM_SETS} />
    </PageShell>
  )
}
