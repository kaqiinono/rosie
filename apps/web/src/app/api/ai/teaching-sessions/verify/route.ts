import {
  createAuthedSupabase,
  getBearerToken,
  getUserFromRequest,
  unauthorizedResponse,
} from '@/lib/api-auth'
import { TeachingSessionError, verifyTeachingSessionEvidence } from '@rosie/ai'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(req: Request) {
  const user = await getUserFromRequest(req)
  const token = getBearerToken(req)
  if (!user || !token) return unauthorizedResponse()

  try {
    const body = (await req.json()) as { sessionId?: unknown }
    if (typeof body.sessionId !== 'string' || !UUID_RE.test(body.sessionId)) {
      return Response.json({ error: 'bad_request' }, { status: 400 })
    }
    const result = await verifyTeachingSessionEvidence(
      createAuthedSupabase(token),
      user.id,
      body.sessionId,
    )
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof TeachingSessionError) {
      const status = error.code === 'teaching_session_not_found' ? 404 : 409
      return Response.json({ error: error.code }, { status })
    }
    return Response.json({ error: 'verification_failed' }, { status: 500 })
  }
}
