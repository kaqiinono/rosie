const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidManagedUserId(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function isValidManagedEmail(value: string): boolean {
  return EMAIL_RE.test(value)
}

export function selfMutationError(input: {
  actorId: string
  targetId: string
  action: 'demote' | 'delete'
}): 'cannot_demote_self' | 'cannot_delete_self' | null {
  if (input.actorId !== input.targetId) return null
  return input.action === 'demote' ? 'cannot_demote_self' : 'cannot_delete_self'
}
