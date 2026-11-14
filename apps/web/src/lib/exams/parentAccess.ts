import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { getBearerToken } from '@/lib/api-auth'
import { isValidParentPin, verifyParentPin } from '@/lib/parent-pin'
import { isDistributedRateLimited, isLocallyRateLimited } from '@/lib/rate-limit'
import { ExamApiError } from './http'

/** Call only after authorizeExamRequest verified this exact Bearer token. */
export function verifiedExamSessionId(request: Request): string {
  const token = getBearerToken(request)
  try {
    const claims: unknown = JSON.parse(Buffer.from(token?.split('.')[1] ?? '', 'base64url').toString('utf8'))
    if (claims && typeof claims === 'object' && 'session_id' in claims && typeof claims.session_id === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.session_id)) return claims.session_id
  } catch { /* Missing verified session cannot authorize a script. */ }
  throw new ExamApiError('exam_session_required', 403)
}

export async function requireExamParentPin(db: SupabaseClient, ownerId: string, pin: unknown) {
  const identity = `exam-parent:${ownerId}`
  const policy = { maxRequests: 8, windowMs: 60_000 }
  // One owner budget across grading/scripts; fail closed if distributed protection
  // is unavailable, rather than weakening a short numeric PIN across instances.
  if (isLocallyRateLimited(identity, policy)) throw new ExamApiError('exam_pin_rate_limited', 429)
  const limited = await isDistributedRateLimited({ identity, pathname: '/api/exams/parent-pin', policy })
  if (limited === null) throw new ExamApiError('exam_pin_unavailable', 503)
  if (limited) throw new ExamApiError('exam_pin_rate_limited', 429)
  if (!isValidParentPin(pin)) throw new ExamApiError('invalid_parent_pin', 403)
  const { data, error } = await db.from('user_parent_pins').select('pin_hash,pin_salt').eq('user_id', ownerId).maybeSingle()
  if (error) throw new ExamApiError('exam_pin_unavailable', 503)
  if (!await verifyParentPin(pin, data)) throw new ExamApiError('invalid_parent_pin', 403)
}
