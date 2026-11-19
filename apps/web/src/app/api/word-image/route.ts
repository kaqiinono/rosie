import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { deleteProjectMedia, storeProjectMedia } from '@/lib/project-media'
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

const IMAGE_EXTENSIONS = new Map([
  ['image/jpeg', 'jpg'], ['image/jpg', 'jpg'], ['image/png', 'png'],
  ['image/webp', 'webp'], ['image/gif', 'gif'], ['image/avif', 'avif'],
])

function newImagePath(stage: string, unit: string, lesson: string, word: string, extension: string) {
  return wordImageStoragePath(stage, unit, lesson, word).replace(/\.jpg$/, `-${randomUUID()}.${extension}`)
}

async function saveProjectWordImage(path: string, bytes: Uint8Array) {
  try {
    await storeProjectMedia(WORD_IMAGES_BUCKET, path, bytes)
  } catch {
    throw new WordImageError('upload_failed', 503)
  }
}

async function removeProjectWordImage(path: string) {
  await deleteProjectMedia(WORD_IMAGES_BUCKET, path).catch(() => undefined)
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

async function activeImagePosition(
  admin: SupabaseClient, stage: string, unit: string, lesson: string, word: string,
) {
  let query = admin.from('vocabulary_positions').select('id,catalog_revision,image_path')
    .eq('unit', unit).eq('lesson', lesson).eq('word', word)
  query = stage ? query.eq('stage', stage) : query.is('stage', null)
  const { data, error } = await query.maybeSingle()
  if (error) throw new WordImageError(`db_query_failed: ${error.message}`, 500)
  if (!data) throw new WordImageError('not_found', 404)
  return data as { id: string; catalog_revision: number; image_path: string | null }
}

async function saveImagePosition(
  admin: SupabaseClient, position: { id: string; catalog_revision: number }, fields: {
    image_path: string | null
    image_match_score: number | null
    image_match_query: string | null
    image_source: 'pexels' | 'upload' | null
    image_pexels_id: string | null
  },
) {
  const { error } = await admin.rpc('write_vocabulary_positions', {
    p_action: 'save',
    p_rows: [{ id: position.id, expected_revision: position.catalog_revision, ...fields }],
  })
  if (error) throw new WordImageError(`db_update_failed: ${error.message}`, error.code === '40001' ? 409 : 500)
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

  const position = await activeImagePosition(admin, stage, unit, lesson, word)
  const path = newImagePath(stage, unit, lesson, word, 'jpg')
  await saveProjectWordImage(path, new Uint8Array(bytes))

  const imagePexelsId = String(photo.id)
  try {
    await saveImagePosition(admin, position, {
      image_path: path, image_match_score: score, image_match_query: query,
      image_source: 'pexels', image_pexels_id: imagePexelsId,
    })
  } catch (error) {
    const current = await activeImagePosition(admin, stage, unit, lesson, word).catch(() => null)
    if (current && current.image_path !== path) await removeProjectWordImage(path)
    throw error
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
    .from('vocabulary_positions')
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
  const position = await activeImagePosition(admin, stage, unit, lesson, word)
  await saveImagePosition(admin, position, {
    image_path: null, image_match_score: null, image_match_query: null,
    image_source: null, image_pexels_id: null,
  })
  if (position.image_path) {
    const { count, error } = await admin.from('vocabulary_positions').select('id', { count: 'exact', head: true }).eq('image_path', position.image_path)
    if (!error && count === 0) await removeProjectWordImage(position.image_path)
  }
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
  const extension = IMAGE_EXTENSIONS.get(contentType.toLowerCase())
  if (!extension) throw new WordImageError('invalid_content_type', 400)

  let bytes: Buffer
  try {
    bytes = Buffer.from(params.base64, 'base64')
  } catch {
    throw new WordImageError('invalid_base64', 400)
  }
  if (!bytes.length) throw new WordImageError('empty_file', 400)
  if (bytes.length > MAX_UPLOAD_BYTES) throw new WordImageError('file_too_large', 413)

  const position = await activeImagePosition(admin, stage, unit, lesson, word)
  const path = newImagePath(stage, unit, lesson, word, extension)
  await saveProjectWordImage(path, bytes)

  try {
    await saveImagePosition(admin, position, {
      image_path: path, image_match_score: null, image_match_query: null,
      image_source: 'upload', image_pexels_id: null,
    })
  } catch (error) {
    const current = await activeImagePosition(admin, stage, unit, lesson, word).catch(() => null)
    if (current && current.image_path !== path) await removeProjectWordImage(path)
    throw error
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
