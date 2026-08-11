import type { User } from '@supabase/supabase-js'

/** Authorization claims must come from app_metadata, which users cannot edit themselves. */
export function isAdminUser(user: User | null | undefined): boolean {
  return user?.app_metadata?.role === 'admin'
}
