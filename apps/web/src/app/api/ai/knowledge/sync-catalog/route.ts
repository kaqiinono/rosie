import { NextResponse } from 'next/server'
import type { CatalogSubject } from '@/lib/ai-catalog-sync'
import {
  CatalogSyncBusyError,
  catalogSyncRequestKey,
  runCatalogSyncSingleFlight,
} from '@/lib/catalog-sync-flight'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function assertServiceRole(req: Request): boolean {
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!expected) return false
  const provided = req.headers.get('x-service-role-key')
  return provided === expected
}

function parseSubjects(raw: string | null): CatalogSubject[] {
  if (!raw) return ['chinese', 'english', 'math']
  const allowed = new Set<CatalogSubject>(['chinese', 'english', 'math'])
  const subjects = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is CatalogSubject => allowed.has(s as CatalogSubject))
  return subjects.length > 0 ? subjects : ['chinese', 'english', 'math']
}

export async function POST(req: Request) {
  if (!assertServiceRole(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const subjects = parseSubjects(url.searchParams.get('subject'))
  const mathOffset = Number(url.searchParams.get('offset') ?? '0')
  const mathLimit = Number(url.searchParams.get('limit') ?? '80')
  const options = {
    mathOffset: Number.isFinite(mathOffset) ? mathOffset : 0,
    mathLimit: Number.isFinite(mathLimit) && mathLimit > 0 ? mathLimit : 80,
  }
  const runId = req.headers.get('x-rosie-sync-run-id')?.trim() || 'anonymous'

  try {
    const { runCatalogSync } = await import('@/lib/ai-catalog-sync')
    const flight = runCatalogSyncSingleFlight({
      key: `${runId}:${catalogSyncRequestKey(subjects, options)}`,
      subjects,
      run: () => runCatalogSync(subjects, options),
    })
    const summary = await flight.promise
    return NextResponse.json(summary, {
      headers: { 'x-rosie-sync-reused': flight.reused ? '1' : '0' },
    })
  } catch (err) {
    if (err instanceof CatalogSyncBusyError) {
      return NextResponse.json(
        { error: 'catalog_sync_busy', activeSubjects: err.activeSubjects },
        { status: 409, headers: { 'retry-after': '5' } },
      )
    }
    const message = err instanceof Error ? err.message : 'sync_catalog_error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
