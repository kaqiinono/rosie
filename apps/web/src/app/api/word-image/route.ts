import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { forbiddenResponse, requireAdminFromRequest } from '@/lib/api-auth'
// Deliberately NOT importing from the `@rosie/english` barrel — that pulls in
// `english.css` plus every client component in the package. Import the pure
// helper module directly so this server route stays free of client bundles.
import {
  WORD_IMAGES_BUCKET,
  wordImageStoragePath,
  buildPexelsQuery,
  scorePexelsCandidate,
} from '../../../../../../packages/english/src/utils/word-image'

export const runtime = 'nodejs'

let adminClient: SupabaseClient | null = null

function getAdminClient(): SupabaseClient | null {
  if (adminClient) return adminClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  adminClient = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return adminClient
}

interface PexelsPhoto {
  id: number
  alt?: string
  src?: { large?: string; medium?: string; original?: string }
}

interface PexelsSearchResponse {
  photos?: PexelsPhoto[]
}

interface WordRow {
  stage: string | null
  unit: string
  lesson: string
  word: string
  explanation: string | null
  image_source: string | null
  image_path: string | null
}

interface MatchParams {
  stage: string
  unit: string
  lesson: string
  word: string
  explanation: string
  query?: string
  excludePexelsIds?: string[]
}

interface MatchResult {
  imagePath: string
  imageMatchScore: number
  imageMatchQuery: string
  imagePexelsId: string
}

class WordImageError extends Error {
  status: number
  constructor(message: string, status = 500) {
    super(message)
    this.status = status
  }
}

async function searchPexels(
  query: string,
  excludeIds: Set<string>,
): Promise<{ photo: PexelsPhoto; rankIndex: number } | null> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) throw new WordImageError('no_pexels_key', 503)

  let resp: Response
  try {
    resp = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8`,
      {
        headers: { Authorization: apiKey },
      },
    )
  } catch {
    throw new WordImageError('pexels_network_error', 502)
  }
  if (!resp.ok) throw new WordImageError(`pexels_error_${resp.status}`, 502)

  const data = (await resp.json()) as PexelsSearchResponse
  const photos = data.photos ?? []
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]
    if (excludeIds.has(String(photo.id))) continue
    return { photo, rankIndex: i }
  }
  return null
}

async function matchOne(admin: SupabaseClient, params: MatchParams): Promise<MatchResult> {
  const { stage, unit, lesson, word, explanation, excludePexelsIds } = params
  const query = params.query?.trim() || buildPexelsQuery(word, explanation)
  const excludeSet = new Set((excludePexelsIds ?? []).map((id) => String(id)))

  const found = await searchPexels(query, excludeSet)
  if (!found) throw new WordImageError('no_match', 404)
  const { photo, rankIndex } = found

  const score = scorePexelsCandidate(photo.alt ?? '', query, rankIndex)
  const imageUrl = photo.src?.large || photo.src?.medium || photo.src?.original
  if (!imageUrl) throw new WordImageError('no_image_url', 502)

  let imgResp: Response
  try {
    imgResp = await fetch(imageUrl)
  } catch {
    throw new WordImageError('download_network_error', 502)
  }
  if (!imgResp.ok) throw new WordImageError('download_failed', 502)
  const bytes = await imgResp.arrayBuffer()

  const path = wordImageStoragePath(stage, unit, lesson, word)
  const { error: uploadError } = await admin.storage
    .from(WORD_IMAGES_BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: true, cacheControl: '60' })
  if (uploadError) throw new WordImageError(`upload_failed: ${uploadError.message}`, 500)

  const imagePexelsId = String(photo.id)
  let updateQuery = admin
    .from('word_entries')
    .update({
      image_path: path,
      image_match_score: score,
      image_match_query: query,
      image_source: 'pexels',
      image_pexels_id: imagePexelsId,
    })
    .eq('unit', unit)
    .eq('lesson', lesson)
    .eq('word', word)
  updateQuery = stage ? updateQuery.eq('stage', stage) : updateQuery.is('stage', null)
  const { data: updatedRows, error: updateError } = await updateQuery.select('word')
  if (updateError) throw new WordImageError(`db_update_failed: ${updateError.message}`, 500)
  if (!updatedRows || updatedRows.length === 0) {
    // Row didn't exist (or filters didn't match) — clean up the object we just
    // uploaded so we don't leave orphaned files in Storage.
    try {
      await admin.storage.from(WORD_IMAGES_BUCKET).remove([path])
    } catch {
      // best-effort cleanup
    }
    throw new WordImageError('not_found', 404)
  }

  return { imagePath: path, imageMatchScore: score, imageMatchQuery: query, imagePexelsId }
}

interface BatchResultItem {
  word: string
  ok: boolean
  error?: string
  imagePath?: string
  imageMatchScore?: number
}

async function handleBatch(
  admin: SupabaseClient,
  stage: string,
  unit: string,
  force: boolean,
): Promise<BatchResultItem[]> {
  let query = admin
    .from('word_entries')
    .select('stage, unit, lesson, word, explanation, image_source, image_path')
    .eq('unit', unit)
  query = stage ? query.eq('stage', stage) : query.is('stage', null)
  const { data, error } = await query
  if (error) throw new WordImageError(`db_query_failed: ${error.message}`, 500)

  const rows = (data ?? []) as WordRow[]
  const results: BatchResultItem[] = []

  for (const row of rows) {
    if (!force && (row.image_source === 'upload' || row.image_path)) {
      results.push({ word: row.word, ok: true, imagePath: row.image_path ?? undefined })
      continue
    }
    try {
      const result = await matchOne(admin, {
        stage: row.stage ?? '',
        unit: row.unit,
        lesson: row.lesson,
        word: row.word,
        explanation: row.explanation ?? '',
      })
      results.push({
        word: row.word,
        ok: true,
        imagePath: result.imagePath,
        imageMatchScore: result.imageMatchScore,
      })
    } catch (err) {
      results.push({
        word: row.word,
        ok: false,
        error: err instanceof Error ? err.message : 'unknown_error',
      })
    }
  }
  return results
}

async function handleClear(
  admin: SupabaseClient,
  params: { stage: string; unit: string; lesson: string; word: string; imagePath?: string },
): Promise<void> {
  const { stage, unit, lesson, word } = params
  let imagePath = params.imagePath

  if (!imagePath) {
    // Look up the current image_path so Storage still gets cleaned up when the
    // caller doesn't already know it.
    let lookupQuery = admin
      .from('word_entries')
      .select('image_path')
      .eq('unit', unit)
      .eq('lesson', lesson)
      .eq('word', word)
    lookupQuery = stage ? lookupQuery.eq('stage', stage) : lookupQuery.is('stage', null)
    const { data: existing, error: lookupError } = await lookupQuery.maybeSingle()
    if (lookupError) throw new WordImageError(`db_query_failed: ${lookupError.message}`, 500)
    if (!existing) throw new WordImageError('not_found', 404)
    imagePath = (existing as { image_path: string | null }).image_path ?? undefined
  }

  if (imagePath) {
    try {
      await admin.storage.from(WORD_IMAGES_BUCKET).remove([imagePath])
    } catch {
      // best-effort; row update below is the source of truth
    }
  }

  let updateQuery = admin
    .from('word_entries')
    .update({
      image_path: null,
      image_match_score: null,
      image_match_query: null,
      image_source: null,
      image_pexels_id: null,
    })
    .eq('unit', unit)
    .eq('lesson', lesson)
    .eq('word', word)
  updateQuery = stage ? updateQuery.eq('stage', stage) : updateQuery.is('stage', null)
  const { data: updatedRows, error } = await updateQuery.select('word')
  if (error) throw new WordImageError(`db_update_failed: ${error.message}`, 500)
  if (!updatedRows || updatedRows.length === 0) throw new WordImageError('not_found', 404)
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

async function handleUpload(
  admin: SupabaseClient,
  params: {
    stage: string
    unit: string
    lesson: string
    word: string
    contentType: string
    base64: string
  },
): Promise<{ imagePath: string }> {
  const { stage, unit, lesson, word } = params
  const contentType = params.contentType || 'image/jpeg'
  if (!contentType.startsWith('image/')) {
    throw new WordImageError('invalid_content_type', 400)
  }

  let bytes: Buffer
  try {
    bytes = Buffer.from(params.base64, 'base64')
  } catch {
    throw new WordImageError('invalid_base64', 400)
  }
  if (!bytes.length) throw new WordImageError('empty_file', 400)
  if (bytes.length > MAX_UPLOAD_BYTES) throw new WordImageError('file_too_large', 413)

  const path = wordImageStoragePath(stage, unit, lesson, word)
  const { error: uploadError } = await admin.storage.from(WORD_IMAGES_BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
    cacheControl: '60',
  })
  if (uploadError) throw new WordImageError(`upload_failed: ${uploadError.message}`, 500)

  let updateQuery = admin
    .from('word_entries')
    .update({
      image_path: path,
      image_match_score: null,
      image_match_query: null,
      image_source: 'upload',
      image_pexels_id: null,
    })
    .eq('unit', unit)
    .eq('lesson', lesson)
    .eq('word', word)
  updateQuery = stage ? updateQuery.eq('stage', stage) : updateQuery.is('stage', null)
  const { data: updatedRows, error: updateError } = await updateQuery.select('word')
  if (updateError) throw new WordImageError(`db_update_failed: ${updateError.message}`, 500)
  if (!updatedRows || updatedRows.length === 0) {
    try {
      await admin.storage.from(WORD_IMAGES_BUCKET).remove([path])
    } catch {
      // best-effort cleanup
    }
    throw new WordImageError('not_found', 404)
  }

  return { imagePath: path }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function strArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v.filter((x): x is string => typeof x === 'string')
}

export async function POST(req: NextRequest) {
  const user = await requireAdminFromRequest(req)
  if (!user) return forbiddenResponse()

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const action = body.action

  if (!process.env.PEXELS_API_KEY && (action === 'match' || action === 'batch')) {
    return NextResponse.json({ error: 'no_pexels_key' }, { status: 503 })
  }
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'no_service_role' }, { status: 503 })
  }

  try {
    if (action === 'upload') {
      const stage = str(body.stage)
      const unit = str(body.unit)
      const lesson = str(body.lesson)
      const word = str(body.word)
      const base64 = str(body.base64)
      const contentType = str(body.contentType) || 'image/jpeg'
      if (!unit || !lesson || !word || !base64) {
        return NextResponse.json({ error: 'bad_request' }, { status: 400 })
      }
      const result = await handleUpload(admin, {
        stage,
        unit,
        lesson,
        word,
        contentType,
        base64,
      })
      return NextResponse.json({
        ok: true,
        imagePath: result.imagePath,
        imageSource: 'upload' as const,
      })
    }

    if (action === 'match') {
      const stage = str(body.stage)
      const unit = str(body.unit)
      const lesson = str(body.lesson)
      const word = str(body.word)
      const explanation = str(body.explanation)
      if (!unit || !lesson || !word) {
        return NextResponse.json({ error: 'bad_request' }, { status: 400 })
      }
      const result = await matchOne(admin, {
        stage,
        unit,
        lesson,
        word,
        explanation,
        query: typeof body.query === 'string' ? body.query : undefined,
        excludePexelsIds: strArray(body.excludePexelsIds),
      })
      return NextResponse.json({
        ok: true,
        imagePath: result.imagePath,
        imageMatchScore: result.imageMatchScore,
        imageMatchQuery: result.imageMatchQuery,
        imagePexelsId: result.imagePexelsId,
        imageSource: 'pexels' as const,
      })
    }

    if (action === 'batch') {
      const stage = str(body.stage)
      const unit = str(body.unit)
      if (!unit) {
        return NextResponse.json({ error: 'bad_request' }, { status: 400 })
      }
      const force = body.force === true
      const results = await handleBatch(admin, stage, unit, force)
      return NextResponse.json({ ok: true, results })
    }

    if (action === 'clear') {
      const stage = str(body.stage)
      const unit = str(body.unit)
      const lesson = str(body.lesson)
      const word = str(body.word)
      if (!unit || !lesson || !word) {
        return NextResponse.json({ error: 'bad_request' }, { status: 400 })
      }
      await handleClear(admin, {
        stage,
        unit,
        lesson,
        word,
        imagePath: typeof body.imagePath === 'string' ? body.imagePath : undefined,
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  } catch (err) {
    if (err instanceof WordImageError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
