import { describe, expect, it } from 'vitest'
import { isValidManagedEmail, isValidManagedUserId, selfMutationError } from '@/lib/user-admin'

describe('user admin guards', () => {
  it('validates UUIDs and email addresses', () => {
    expect(isValidManagedUserId('11111111-1111-4111-8111-111111111111')).toBe(true)
    expect(isValidManagedUserId('not-a-user-id')).toBe(false)
    expect(isValidManagedEmail('rosie@example.com')).toBe(true)
    expect(isValidManagedEmail('not-an-email')).toBe(false)
  })

  it('blocks self-demotion and self-deletion', () => {
    expect(selfMutationError({ actorId: 'a', targetId: 'a', action: 'demote' })).toBe(
      'cannot_demote_self',
    )
    expect(selfMutationError({ actorId: 'a', targetId: 'a', action: 'delete' })).toBe(
      'cannot_delete_self',
    )
    expect(selfMutationError({ actorId: 'a', targetId: 'b', action: 'delete' })).toBeNull()
  })
})
