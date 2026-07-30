export function resolveAdaptiveCreateStatus(hasActivePlan: boolean): 'active' | 'paused' {
  return hasActivePlan ? 'paused' : 'active'
}
