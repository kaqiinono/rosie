import { createHmac, timingSafeEqual } from 'node:crypto'
import { createAdminSupabase, isAdminRequestUser, lookupUserFromRequest } from '@/lib/api-auth'
import { ExamApiError } from '@/lib/exams/http'
import { getExamRecordingUploadSize } from '@/lib/exams/recordings'
import { getBaiduAccountContext } from '@/lib/baidu-token'
import {
  downloadProjectObject, finishProjectUpload, PART_BYTES, partHash, projectPath, startProjectUpload, uploadProjectPart,
} from '@/lib/baidu-project-transfer.mjs'
import { deleteProjectMedia, fetchProjectMedia, storeProjectMedia } from '@/lib/project-media'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ bucket: string; path: string[] }> }
type Upload = { owner: string; target: string; generation: string; expiry: number; size: number; hashes: string[]; uploadId: string }

const chineseRecordings = 'chinese-reading-recordings'
const englishRecordings = 'english-story-recordings'
const examRecordings = 'exam-recordings'
const personalRecordingTables: Record<string, string> = {
  [chineseRecordings]: 'chinese_reading_recordings',
  [englishRecordings]: 'reading_recordings',
}
const imageTypes: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
}
const audioTypes: Record<string, string> = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', webm: 'audio/webm', wav: 'audio/wav', ogg: 'audio/ogg',
}
const privateHeaders = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
const error = (status: number, message: string) => Response.json({ error: message }, { status, headers: privateHeaders })

async function fileFromContext(context: Context) {
  const { bucket, path: segments } = await context.params
  if (!segments.length || segments.some(segment => segment.includes('/'))) return null
  const path = segments.join('/')
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const types = Object.hasOwn(personalRecordingTables, bucket) || bucket === 'reading' ? audioTypes : imageTypes
  const mime = bucket === examRecordings ? 'application/octet-stream' : Object.hasOwn(types, ext) ? types[ext] : undefined
  if (!mime || !['math', 'grammar-pages', 'word-images', 'reading', chineseRecordings, englishRecordings, examRecordings].includes(bucket)) return null
  try { return { bucket, path, mime, segments, target: projectPath(bucket, path) } }
  catch { return null }
}

function signature(payload: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw Error('project_media_missing_key')
  return createHmac('sha256', secret).update('rosie/project-media/v1\0').update(payload).digest()
}

function verify(payload: string, encoded: string | null) {
  if (!encoded || !/^[\w-]{43}$/.test(encoded)) return false
  return timingSafeEqual(signature(payload), Buffer.from(encoded, 'base64url'))
}

function playbackToken(bucket: string, path: string, expiry: number) {
  return JSON.stringify(['playback', bucket, path, expiry])
}

export async function GET(request: Request, context: Context) {
  const file = await fileFromContext(context)
  if (!file || file.bucket === examRecordings) return error(404, '文件不存在')
  const params = new URL(request.url).searchParams
  const privateFile = Object.hasOwn(personalRecordingTables, file.bucket)
  if (privateFile) {
    const expiry = Number(params.get('expires'))
    if (!Number.isSafeInteger(expiry) || expiry <= Date.now() ||
      !verify(playbackToken(file.bucket, file.path, expiry), params.get('sig'))) return error(403, '录音链接已失效')
  }

  const range = request.headers.get('range')
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return new Response(null, { status: 416, headers: privateHeaders })
  try {
    const upstream = await fetchProjectMedia(file.bucket, file.path, range, request.signal)
    if (!upstream) return error(404, '文件不存在')
    const headers = new Headers({
      ...(privateFile ? privateHeaders : { 'Cache-Control': 'public, max-age=60' }),
      'Content-Type': file.mime, 'X-Content-Type-Options': 'nosniff',
    })
    for (const key of ['content-length', 'content-range', 'accept-ranges']) {
      const value = upstream.headers.get(key)
      if (value) headers.set(key, value)
    }
    return new Response(upstream.body, { status: upstream.status, headers })
  } catch {
    return error(503, '百度网盘文件暂时无法读取')
  }
}

async function authorize(request: Request, context: Context) {
  const file = await fileFromContext(context)
  if (!file) return error(404, '文件不存在')
  const { user, unreachable } = await lookupUserFromRequest(request)
  if (!user) return error(unreachable ? 503 : 401, unreachable ? '登录验证暂时不可用' : '请先登录')
  const [folder, attemptId, recordingId] = file.segments
  if (file.bucket === examRecordings) {
    if (folder !== user.id || file.segments.length !== 3 || request.method === 'DELETE') {
      return error(403, '无权修改此录音')
    }
    try {
      const expectedSize = await getExamRecordingUploadSize(createAdminSupabase(), user.id, attemptId, recordingId)
      return { file, user, expectedSize }
    } catch (cause) {
      return error(cause instanceof ExamApiError ? cause.status : 503, '考试录音当前无法上传')
    }
  }
  const allowed = (file.bucket === chineseRecordings && folder === user.id && file.segments.length === 4)
    || (file.bucket === englishRecordings && folder === user.id && attemptId === 'chapter' && file.segments.length >= 4)
    || (file.bucket === 'math' && ['analysis', 'figures', 'summaries', 'notes', 'drafts'].includes(folder) && file.segments.length >= 3)
    || (file.bucket === 'reading' && /^passages\/[a-z0-9-]+\/narration(?:-[\w-]+)?\.mp3$/.test(file.path))
    || (file.bucket === 'grammar-pages' && file.segments.includes('figures') && isAdminRequestUser(user))
  if (!allowed) return error(403, '无权修改此文件')
  return { file, user, expectedSize: null }
}

async function readPart(request: Request) {
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (!bytes.length || bytes.length > PART_BYTES) throw Error('project_media_part_size')
  return bytes
}

function readTicket(request: Request, target: string, owner: string): Upload | null {
  const encoded = request.headers.get('x-project-upload')
  const [body, mac, extra] = encoded?.split('.') ?? []
  if (!body || !mac || extra || !verify(body, mac)) return null
  const ticket = JSON.parse(Buffer.from(body, 'base64url').toString()) as Upload
  return ticket.target === target && ticket.owner === owner && ticket.expiry > Date.now() ? ticket : null
}

export async function PUT(request: Request, context: Context) {
  const auth = await authorize(request, context)
  if (auth instanceof Response) return auth
  const { file, user } = auth
  const params = new URL(request.url).searchParams
  try {
    const bytes = await readPart(request)
    if (params.get('operation') === 'hash') return Response.json({ hash: partHash(bytes) }, { headers: privateHeaders })
    if (params.get('operation') === 'part') {
      const ticket = readTicket(request, file.target, user.id)
      const rawIndex = params.get('index')
      const index = rawIndex && /^\d+$/.test(rawIndex) ? Number(rawIndex) : -1
      if (!ticket?.hashes[index] || bytes.length !== Math.min(PART_BYTES, ticket.size - index * PART_BYTES)) {
        return error(400, '上传分片已失效或长度不符')
      }
      const account = await getBaiduAccountContext()
      if (account.generation !== ticket.generation) return error(409, '网盘授权已变更，请重试')
      await uploadProjectPart(account.accessToken, file.target, ticket.uploadId, index, bytes, ticket.hashes[index])
    } else {
      if (file.bucket === examRecordings) return error(400, '请通过考试页面保存录音')
      await storeProjectMedia(file.bucket, file.path, bytes)
    }
    return Response.json({ ok: true }, { headers: privateHeaders })
  } catch (cause) {
    return cause instanceof Error && cause.message === 'project_media_part_size'
      ? error(413, '文件分片大小超出范围') : error(503, '百度网盘上传失败')
  }
}

export async function POST(request: Request, context: Context) {
  const auth = await authorize(request, context)
  if (auth instanceof Response) return auth
  const { file, user } = auth
  const params = new URL(request.url).searchParams
  const operation = params.get('operation')
  try {
    if (operation === 'sign' && Object.hasOwn(personalRecordingTables, file.bucket)) {
      const { data, error: lookupError } = await createAdminSupabase().from(personalRecordingTables[file.bucket])
        .select('id').eq('user_id', user.id).eq('storage_path', file.path).maybeSingle()
      if (lookupError) return error(503, '暂时无法核对录音')
      if (!data) return error(404, '录音不存在')
      const expiry = Date.now() + 15 * 60_000
      const sig = signature(playbackToken(file.bucket, file.path, expiry)).toString('base64url')
      const url = new URL(request.url)
      return Response.json({ url: `${url.pathname}?expires=${expiry}&sig=${sig}` }, { headers: privateHeaders })
    }

    if (operation === 'start') {
      const { size, hashes } = (await request.json().catch(() => null) ?? {}) as { size?: number; hashes?: unknown[] }
      if ((auth.expectedSize !== null && size !== auth.expectedSize) || typeof size !== 'number' || !Number.isSafeInteger(size) || size <= PART_BYTES || size > 50 * 1024 * 1024 || !Array.isArray(hashes)
        || hashes.length !== Math.ceil(size / PART_BYTES) || !hashes.every((hash): hash is string => typeof hash === 'string' && /^[a-f0-9]{32}$/.test(hash))) {
        return error(413, '文件分片无效或文件超过 50 MB')
      }
      const account = await getBaiduAccountContext()
      const plan = await startProjectUpload(account.accessToken, file.target, size, hashes, false)
      if (!plan) {
        const existing = await downloadProjectObject(account.accessToken, file.target, request.signal)
        const bytes = existing && new Uint8Array(await existing.arrayBuffer())
        if (bytes?.length === size && hashes.every((hash, index) =>
          hash === partHash(bytes.subarray(index * PART_BYTES, (index + 1) * PART_BYTES)))) {
          return Response.json({ complete: true }, { headers: privateHeaders })
        }
        return error(409, '同名文件内容冲突')
      }
      const ticket: Upload = { target: file.target, owner: user.id, generation: account.generation,
        expiry: Date.now() + 20 * 60_000, size, hashes, uploadId: plan.uploadId }
      const body = Buffer.from(JSON.stringify(ticket)).toString('base64url')
      return Response.json({ ticket: `${body}.${signature(body).toString('base64url')}`, missing: plan.missing }, { headers: privateHeaders })
    }

    if (operation === 'finish') {
      const ticket = readTicket(request, file.target, user.id)
      if (!ticket) return error(400, '上传已失效，请重试')
      const account = await getBaiduAccountContext()
      if (account.generation !== ticket.generation) return error(409, '网盘授权已变更，请重试')
      await finishProjectUpload(account.accessToken, file.target, ticket.size, ticket.hashes, false, ticket.uploadId)
      return Response.json({ ok: true }, { headers: privateHeaders })
    }
    return error(400, '文件操作无效')
  } catch {
    return error(503, '百度网盘操作暂时失败')
  }
}

export async function DELETE(request: Request, context: Context) {
  const auth = await authorize(request, context)
  if (auth instanceof Response) return auth
  try {
    await deleteProjectMedia(auth.file.bucket, auth.file.path)
    return Response.json({ ok: true }, { headers: privateHeaders })
  } catch {
    return error(503, '百度网盘删除失败')
  }
}
