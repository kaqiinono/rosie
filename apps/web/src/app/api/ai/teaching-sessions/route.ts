import {
  createAuthedSupabase,
  getBearerToken,
  getUserFromRequest,
  unauthorizedResponse,
} from '@/lib/api-auth'
import {
  advanceTeachingSession,
  getTeachingSession,
  startTeachingSession,
  teachingSessionActionSchema,
  teachingSessionStartSchema,
  TeachingSessionError,
} from '@rosie/ai'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 16 * 1024
const MAX_STATE_BYTES = 10 * 1024
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseSessionId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw new Error('invalid_session_id')
  return value
}

function errorResponse(error: unknown): Response {
  if (error instanceof TeachingSessionError) {
    const statuses: Record<TeachingSessionError['code'], number> = {
      teaching_session_not_found: 404,
      teaching_session_not_active: 409,
      teaching_session_conflict: 409,
      teaching_session_write_failed: 500,
    }
    return Response.json({ error: error.code }, { status: statuses[error.code] })
  }
  return Response.json({ error: 'bad_request' }, { status: 400 })
}

async function readJson(req: Request): Promise<unknown> {
  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES) throw new Error('body_too_large')
  return req.json()
}

async function authenticate(req: Request) {
  const user = await getUserFromRequest(req)
  const token = getBearerToken(req)
  if (!user || !token) return null
  return { user, supabase: createAuthedSupabase(token) }
}

export async function POST(req: Request) {
  const auth = await authenticate(req)
  if (!auth) return unauthorizedResponse()

  try {
    const input = teachingSessionStartSchema.parse(await readJson(req))
    if (input.state && JSON.stringify(input.state).length > MAX_STATE_BYTES) {
      return Response.json({ error: 'state_too_large' }, { status: 400 })
    }
    let contentRef = input.contentRef
    if (!contentRef && input.conversationId) {
      const latest = await auth.supabase
        .from('ai_conversations')
        .select('sources')
        .eq('user_id', auth.user.id)
        .eq('session_id', input.conversationId)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (latest.error) throw latest.error
      const sources = Array.isArray(latest.data?.sources) ? latest.data.sources : []
      const matching = sources.find((source) => {
        if (!source || typeof source !== 'object') return false
        return (source as { subject?: unknown }).subject === input.subject
      }) as { sourceRef?: unknown } | undefined
      contentRef = typeof matching?.sourceRef === 'string' ? matching.sourceRef : undefined
    }
    const session = await startTeachingSession(auth.supabase, auth.user.id, {
      ...input,
      contentRef,
    })
    return Response.json({ session }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function GET(req: Request) {
  const auth = await authenticate(req)
  if (!auth) return unauthorizedResponse()

  try {
    const id = parseSessionId(new URL(req.url).searchParams.get('id'))
    const session = await getTeachingSession(auth.supabase, auth.user.id, id)
    return Response.json({ session }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(req: Request) {
  const auth = await authenticate(req)
  if (!auth) return unauthorizedResponse()

  try {
    const body = await readJson(req)
    if (!body || typeof body !== 'object') throw new Error('invalid_body')
    const raw = body as { sessionId?: unknown; action?: unknown }
    const sessionId = parseSessionId(raw.sessionId)
    const action = teachingSessionActionSchema.parse(raw.action)
    const session = await advanceTeachingSession(auth.supabase, auth.user.id, sessionId, action)
    return Response.json({ session })
  } catch (error) {
    return errorResponse(error)
  }
}
