import { NextResponse } from 'next/server'
import { getUserFromRequest, isAdminRequestUser } from '@/lib/api-auth'
import { theaterError, theaterPrivateHeaders, theaterRequestError } from '@/lib/baidu-theater'
import {
  clearTheaterSubtitleHistory, readTheaterRevisionStatus, saveTheaterSubtitleEdits, syncTheaterSubtitleBatch,
} from '@/lib/theater/theater-subtitle-revisions'
import { validTheaterId, type SubtitleCue, type TheaterSubtitleEdit, type TheaterSubtitleSplice } from '@/lib/theater/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const validText = (text: unknown): text is string => typeof text === 'string' && text === text.trim() &&
  text.length > 0 && text.length <= 1800 && !/[\x00-\x08\x0b-\x1f\x7f]/.test(text)

function validCue(value: unknown): value is SubtitleCue {
  if (!value || typeof value !== 'object') return false
  const { startMs, endMs, text } = value as SubtitleCue
  return Number.isInteger(startMs) && Number.isInteger(endMs) && startMs >= 0 &&
    endMs > startMs && endMs <= 86_400_000 &&
    typeof text === 'string' && text.length > 0 && text.length <= 1800
}

function validSplice(value: unknown): value is TheaterSubtitleSplice {
  if (!value || typeof value !== 'object') return false
  const { kind, language, index, before, after } = value as TheaterSubtitleSplice
  if (kind !== 'timeline' || (language !== 'en' && language !== 'zh') ||
      !Number.isInteger(index) || index < 0 || index > 12000 ||
      !Array.isArray(before) || !Array.isArray(after) ||
      !['0:1', '1:0', '1:2', '2:1'].includes(before.length + ':' + after.length) ||
      !before.every(validCue) || !after.every(cue => validCue(cue) && validText(cue.text))) return false
  if (after.length === 2) return after[0].startMs === before[0].startMs &&
    after[0].endMs === after[1].startMs && after[1].endMs === before[0].endMs
  if (before.length === 2) return after[0].startMs === before[0].startMs &&
    after[0].endMs === Math.max(before[0].endMs, before[1].endMs)
  return true
}

function validEdit(value: unknown): value is TheaterSubtitleEdit {
  if (!value || typeof value !== 'object' || 'kind' in value) return false
  const { index, language, before, text } = value as Partial<TheaterSubtitleEdit>
  return (language === 'en' || language === 'zh') && typeof index === 'number' &&
    Number.isInteger(index) && index >= 0 && index < 12000 &&
    typeof before === 'string' && before.length > 0 && before.length <= 1800 &&
    validText(text)
}

async function manageRevisions(request: Request, { params }: { params: Promise<{ filmId: string }> }) {
  const user = await getUserFromRequest(request)
  if (!user) return theaterError('登录已过期，请重新登录。', 401)
  if (!isAdminRequestUser(user)) return theaterError('需要管理员权限。', 403)
  const { filmId } = await params
  if (!validTheaterId(filmId)) return theaterError('影片不存在。', 404)
  const query = new URL(request.url).searchParams
  try {
    if (request.method === 'GET') {
      const page = Number(query.get('page') ?? '0')
      if (!Number.isSafeInteger(page) || page < 0 || page > 10000) return theaterError('页码无效。', 400)
      return NextResponse.json(await readTheaterRevisionStatus(filmId, page), { headers: theaterPrivateHeaders })
    }
    if (request.method === 'PATCH') {
      const body = await request.json().catch(() => null)
      const input = Array.isArray(body) ? body : body?.edits
      const version = typeof body?.version === 'string' && /^[0-9a-f-]{36}:(?:[0-9a-f-]{36})?$/i.test(body.version)
        ? body.version : undefined
      if (version && Array.isArray(input) && input.length === 1 && validSplice(input[0])) {
        await saveTheaterSubtitleEdits(filmId, user.id, input, version, request.signal)
        return new Response(null, { status: 204, headers: theaterPrivateHeaders })
      }
      if (!Array.isArray(body) && !version) return theaterError('请刷新字幕后重新编辑。', 400)
      if (!Array.isArray(input) || !input.length || input.length > 7 || !input.every(validEdit) ||
          new Set(input.map(edit => edit.language + ':' + edit.index)).size !== input.length)
        return theaterError('请核对字幕时间和文本，单句最多 1800 字符。', 400)
      await saveTheaterSubtitleEdits(filmId, user.id, input, version, request.signal)
    } else if (request.method === 'POST') {
      await syncTheaterSubtitleBatch(filmId, request.signal)
    } else {
      const batchId = query.get('batchId')
      if (!validTheaterId(batchId)) return theaterError('修订批次无效。', 400)
      await clearTheaterSubtitleHistory(filmId, batchId)
    }
    return new Response(null, { status: 204, headers: theaterPrivateHeaders })
  } catch (error) {
    return theaterRequestError(error)
  }
}

export const GET = manageRevisions
export const PATCH = manageRevisions
export const POST = manageRevisions
export const DELETE = manageRevisions
