import {
  createAuthedSupabase,
  getBearerToken,
  getUserFromRequest,
  unauthorizedResponse,
} from '@/lib/api-auth'
import { findManifestByHref, findManifestByProblemId, runChatStream, stripHtml } from '@rosie/ai'
import type { ChatContext, LessonNote, SimilarProblem } from '@rosie/ai'
import { SEA_POOL } from '@rosie/math/utils/sea-data'

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

  const supabase = createAuthedSupabase(token)

  const rawContext =
    body.context && typeof body.context === 'object'
      ? (body.context as Record<string, unknown>)
      : undefined
  const lessonId = typeof rawContext?.lessonId === 'string' ? rawContext.lessonId : undefined
  const rawActiveContent =
    rawContext?.activeContent && typeof rawContext.activeContent === 'object'
      ? (rawContext.activeContent as Record<string, unknown>)
      : undefined

  // ── Accept client context directly (manifest is incomplete for most lessons) ──
  const clientProblemId =
    typeof rawActiveContent?.problemId === 'string' ? rawActiveContent.problemId : undefined
  const clientSourceRef =
    typeof rawActiveContent?.sourceRef === 'string' ? rawActiveContent.sourceRef : undefined
  const clientTitle =
    typeof rawActiveContent?.title === 'string' ? rawActiveContent.title : undefined
  const clientHasAttempted = rawActiveContent?.hasAttempted === true

  // Verify hasAttempted server-side when client claims it
  let hasAttemptedActiveProblem = clientHasAttempted
  if (clientProblemId && clientHasAttempted) {
    const { data: attempts } = await supabase
      .from('math_practice_attempts')
      .select('id')
      .eq('problem_id', clientProblemId)
      .eq('status', 'completed')
      .limit(1)
    hasAttemptedActiveProblem = Boolean(attempts?.length)
  }

  // Prefer manifest entry if available, otherwise trust client context
  const manifestEntry = lessonId ? findManifestByHref(lessonId) : undefined
  const activeProblemEntry = clientProblemId
    ? findManifestByProblemId(clientProblemId)
    : undefined

  const subject: ChatContext['subject'] =
    activeProblemEntry?.subject ??
    (rawContext?.subject === 'english' ||
      rawContext?.subject === 'math' ||
      rawContext?.subject === 'chinese'
        ? rawContext.subject
        : undefined)

  const activeContent: ChatContext['activeContent'] = activeProblemEntry
    ? {
        sourceRef: activeProblemEntry.sourceRef,
        title: activeProblemEntry.title,
        problemId: activeProblemEntry.problemId,
        hasAttempted: hasAttemptedActiveProblem,
      }
    : clientProblemId && clientSourceRef
      ? {
          sourceRef: clientSourceRef,
          title: clientTitle ?? clientProblemId,
          problemId: clientProblemId,
          hasAttempted: hasAttemptedActiveProblem,
        }
      : manifestEntry
        ? {
            sourceRef: manifestEntry.sourceRef,
            title: manifestEntry.title,
            problemId: manifestEntry.problemId,
            wordKey: manifestEntry.wordKey,
          }
        : undefined

  const context: ChatContext | undefined = rawContext
    ? {
        subject,
        lessonId,
        grade: typeof rawContext.grade === 'number' ? rawContext.grade : undefined,
        activeContent,
      }
    : undefined

  // ── Accept client-provided enrichment data (notes + similar problem) ──
  // The client already has this data loaded (cached loadLessonNotes + static SEA_POOL),
  // so we avoid redundant Supabase queries and server-side SEA_POOL import.
  // Server-side fallback: if the client hasn't loaded the data yet (race condition
  // where user clicks before async enrichment completes), fetch it here.
  let lessonNotes: LessonNote[] | undefined
  let similarProblem: SimilarProblem | undefined

  // ── DEBUG: trace enrichment data flow ──
  console.log('[chat/route] rawContext:', JSON.stringify({
    subject: rawContext?.subject,
    lessonId: rawContext?.lessonId,
    hasLessonNotes: Array.isArray(rawContext?.lessonNotes),
    lessonNotesLen: Array.isArray(rawContext?.lessonNotes) ? rawContext.lessonNotes.length : 0,
    hasSimilarProblem: !!rawContext?.similarProblem,
    activeContent: rawContext?.activeContent,
  }))

  if (rawContext && context?.subject === 'math') {
    const rawNotes = Array.isArray(rawContext.lessonNotes) ? rawContext.lessonNotes : undefined
    console.log('[chat/route] client lessonNotes:', rawNotes ? `${rawNotes.length} notes` : 'MISSING')
    if (rawNotes?.length) {
      lessonNotes = rawNotes
        .filter(
          (n): n is Record<string, unknown> =>
            typeof n === 'object' && n !== null && typeof (n as Record<string, unknown>).bodyHtml === 'string',
        )
        .map((n) => ({
          title: typeof n.title === 'string' ? n.title : null,
          bodyHtml: n.bodyHtml as string,
        }))
    }

    const rawSimilar =
      rawContext.similarProblem && typeof rawContext.similarProblem === 'object'
        ? (rawContext.similarProblem as Record<string, unknown>)
        : undefined
    if (
      rawSimilar &&
      typeof rawSimilar.title === 'string' &&
      typeof rawSimilar.text === 'string' &&
      Array.isArray(rawSimilar.analysis) &&
      typeof rawSimilar.href === 'string' &&
      typeof rawSimilar.problemId === 'string'
    ) {
      similarProblem = {
        title: rawSimilar.title,
        text: rawSimilar.text,
        analysis: rawSimilar.analysis.filter(
          (s): s is string => typeof s === 'string',
        ),
        href: rawSimilar.href,
        problemId: rawSimilar.problemId,
      }
    }

    // ── Server-side fallback when client enrichment is missing ──
    // Extract short lessonId (e.g. "1-12") from the full pathname (e.g. "/math/ny/1/12")
    const lessonPathMatch = typeof lessonId === 'string'
      ? lessonId.match(/\/math\/ny\/(\d+)\/(\d+)/)
      : null
    const shortLessonId = lessonPathMatch
      ? `${lessonPathMatch[1]}-${lessonPathMatch[2]}`
      : undefined
    console.log('[chat/route] fallback: lessonId=%s shortLessonId=%s needsNotes=%s needsSimilar=%s',
      lessonId, shortLessonId, !lessonNotes, !similarProblem)

    if (shortLessonId && !lessonNotes) {
      try {
        const { data: noteRows } = await supabase
          .from('math_problem_notes')
          .select('title, body_html')
          .eq('lesson_id', shortLessonId)
          .order('problem_id')
          .order('sort_order')
        console.log('[chat/route] fallback supabase notes(%s): %d rows', shortLessonId, noteRows?.length ?? 0)
        if (noteRows?.length) {
          lessonNotes = noteRows.map((r) => ({
            title: r.title ?? null,
            bodyHtml: r.body_html,
          }))
        }
      } catch (err) {
        console.error('[chat/route] fallback notes query error:', err)
      }
    }

    if (shortLessonId && !similarProblem) {
      const activeProblemId = typeof rawActiveContent?.problemId === 'string'
        ? rawActiveContent.problemId
        : undefined
      const sameLesson = SEA_POOL.filter(
        (sp) => sp.lessonId === shortLessonId && sp.problem.id !== activeProblemId,
      )
      const withAnalysis = sameLesson.filter((sp) => sp.problem.analysis?.length > 0)
      const candidate = withAnalysis[0] ?? sameLesson[0]
      console.log('[chat/route] fallback SEA_POOL: sameLesson=%d withAnalysis=%d candidate=%s',
        sameLesson.length, withAnalysis.length, candidate?.problem.title ?? 'NONE')
      if (candidate) {
        similarProblem = {
          title: candidate.problem.title,
          text: stripHtml(candidate.problem.text),
          analysis: (candidate.problem.analysis ?? []).map((s) => stripHtml(s)),
          href: candidate.href,
          problemId: candidate.problem.id,
        }
      }
    }
  } else {
    console.log('[chat/route] skipping enrichment: rawContext=%s subject=%s',
      !!rawContext, context?.subject)
  }
  console.log('[chat/route] final: lessonNotes=%d similarProblem=%s',
    lessonNotes?.length ?? 0, similarProblem?.title ?? 'NONE')
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
          lessonNotes,
          similarProblem,
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
