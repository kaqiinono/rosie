import { NextResponse } from 'next/server'
import { upsertKnowledgeDocument } from '@rosie/ai'

export const runtime = 'nodejs'

function assertServiceRole(req: Request): boolean {
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!expected) return false
  const provided = req.headers.get('x-service-role-key')
  return provided === expected
}

export async function POST(req: Request) {
  if (!assertServiceRole(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: {
    subject?: unknown
    sourceType?: unknown
    sourceRef?: unknown
    title?: unknown
    content?: unknown
    metadata?: unknown
  }

  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const subject = body.subject
  const sourceType = body.sourceType
  const sourceRef = body.sourceRef
  const title = body.title
  const content = body.content

  if (
    (subject !== 'english' && subject !== 'math' && subject !== 'chinese') ||
    (sourceType !== 'db_sync' && sourceType !== 'catalog_sync' && sourceType !== 'import') ||
    typeof sourceRef !== 'string' ||
    typeof title !== 'string' ||
    typeof content !== 'string'
  ) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  try {
    const result = await upsertKnowledgeDocument({
      subject,
      sourceType,
      sourceRef,
      title,
      content,
      metadata:
        body.metadata && typeof body.metadata === 'object'
          ? (body.metadata as Record<string, unknown>)
          : {},
    })
    return NextResponse.json(result)
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
          ? err.message
          : 'ingest_error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
