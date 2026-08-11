import { describe, expect, it } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { isAdminUser } from '@rosie/core'

function user(appMetadata: Record<string, unknown>): User {
  return {
    id: 'user-1',
    app_metadata: appMetadata,
    user_metadata: {},
    aud: 'authenticated',
    created_at: '',
  } as User
}

describe('isAdminUser', () => {
  it('accepts an admin role only from app_metadata', () => {
    expect(isAdminUser(user({ role: 'admin' }))).toBe(true)
  })

  it('does not trust user-editable metadata or other roles', () => {
    const forged = { ...user({ role: 'student' }), user_metadata: { role: 'admin' } }
    expect(isAdminUser(forged)).toBe(false)
    expect(isAdminUser(null)).toBe(false)
  })
})
