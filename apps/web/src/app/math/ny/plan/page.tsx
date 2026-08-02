'use client'

import MathPlanPageShell from './MathPlanPageShell'

/** Plan detail / week view — does not auto-start practice. */
export default function MathDailyPage() {
  return <MathPlanPageShell autoStart={false} />
}
