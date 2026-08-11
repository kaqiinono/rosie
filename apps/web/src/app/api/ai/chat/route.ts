import {
  createAuthedSupabase,
  getBearerToken,
  getUserFromRequest,
  unauthorizedResponse,
} from '@/lib/api-auth'
import { findManifestByHref, runChatStream } from '@rosie/ai'
import type { ChatContext } from '@rosie/ai'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return unauthorizedResponse()

  const token = getBearerToken(req)
  if (!token) return unauthorizedResponse()

  let body: {
    message?: unknown
    conversationId?: unknown
    teachingSessionId?: unknown
    context?: unknown
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: 'bad_request' }, { status: 400 })
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message || message.length > 2_000) {
    return Response.json({ error: 'bad_request' }, { status: 400 })
  }

  const conversationId = typeof body.conversationId === 'string' ? body.conversationId : undefined
  if (
    conversationId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      conversationId,
    )
  ) {
    return Response.json({ error: 'bad_request' }, { status: 400 })
  }

  const teachingSessionId =
    typeof body.teachingSessionId === 'string' ? body.teachingSessionId : undefined
  if (
    teachingSessionId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      teachingSessionId,
    )
  ) {
    return Response.json({ error: 'bad_request' }, { status: 400 })
  }

  const rawContext =
    body.context && typeof body.context === 'object'
      ? (body.context as Record<string, unknown>)
      : undefined
  const lessonId = typeof rawContext?.lessonId === 'string' ? rawContext.lessonId : undefined
  const manifestEntry = lessonId ? findManifestByHref(lessonId) : undefined
  const subject: ChatContext['subject'] =
    rawContext?.subject === 'english' ||
    rawContext?.subject === 'math' ||
    rawContext?.subject === 'chinese'
      ? rawContext.subject
      : undefined
  const context: ChatContext | undefined = rawContext
    ? {
        subject,
        lessonId,
        grade: typeof rawContext.grade === 'number' ? rawContext.grade : undefined,
        activeContent: manifestEntry
          ? {
              sourceRef: manifestEntry.sourceRef,
              title: manifestEntry.title,
              problemId: manifestEntry.problemId,
              wordKey: manifestEntry.wordKey,
            }
          : undefined,
      }
    : undefined

  const supabase = createAuthedSupabase(token)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        for await (const chunk of runChatStream({
          user,
          supabase,
          message,
          conversationId,
          teachingSessionId,
          context,
        })) {
          controller.enqueue(encoder.encode(chunk))
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
