import type { PlanningIssue } from './types'

/** Historical diagnostics never imply execution credit or a current arrangement conflict.
 * Unknown issue codes remain incomplete until their semantics are explicitly supported. */
export function classifyPlanningIssue(
  issue: PlanningIssue,
): 'advisory' | 'hard_conflicts' | 'incomplete' {
  switch (issue.code) {
    case 'fixed_expired':
    case 'fixed_release_suggested':
      return 'advisory'
    case 'fixed_invalid':
    case 'fixed_overlap':
    case 'fixed_outside_capacity':
    case 'fixed_task_window':
    case 'fixed_weekend_commitment':
      return 'hard_conflicts'
    default:
      return 'incomplete'
  }
}
