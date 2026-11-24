import { NextResponse } from 'next/server'
import { getUserFromRequest, isAdminRequestUser } from '@/lib/api-auth'
import { getBaiduAccountContext } from '@/lib/baidu-token'
import { matchTheaterSubtitles, theaterError, theaterPrivateHeaders, theaterRequestError } from '@/lib/baidu-theater'
import { ensureTheaterSubtitleJob, readTheaterSubtitleJob, theaterSubtitleJobError } from '@/lib/theater/subtitle-jobs'
import { importTheaterShareSubtitles } from '@/lib/theater/baidu-share-subtitles'
import { validTheaterId } from '@/lib/theater/types'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return theaterError('登录已过期，请重新登录。', 401)
  if (!isAdminRequestUser(user)) return theaterError('需要管理员权限。', 403)

  const input = await request.json().catch(() => null)
  if (!input || !validTheaterId(input.directoryId) ||
      typeof input.videoId !== 'string' || !/^[1-9][0-9]{0,19}$/.test(input.videoId))
    return theaterError('请先在授权目录选择影片。', 400)

  const timeout = AbortSignal.timeout(45_000)
  try {
    const account = await getBaiduAccountContext()
    if (input.generation !== account.generation) throw Error('baidu_account_changed')
    const selection = { directoryId: input.directoryId, videoId: input.videoId }
    const signal = AbortSignal.any([request.signal, timeout])
    if (input.action === 'importShare') {
      if (typeof input.link !== 'string' || !input.link || input.link.length > 500 ||
          typeof input.code !== 'string' || input.code.length > 16)
        return theaterError('请输入影片的百度网盘分享链接和提取码。', 400)
      const tracks = await importTheaterShareSubtitles(account, selection, input.link, input.code, signal)
      return NextResponse.json(tracks, { headers: theaterPrivateHeaders })
    }
    const result = await matchTheaterSubtitles(account, selection, signal)
    if (input.generate === true && !result.tracks.length && !result.failedCount && !result.remainingCount) {
      signal.throwIfAborted()
      try {
        result.job = await ensureTheaterSubtitleJob(account, selection, user.id)
      } catch (error) {
        result.jobError = theaterSubtitleJobError(error)
      }
    }
    return NextResponse.json(result, { headers: theaterPrivateHeaders })
  } catch (error) {
    if (timeout.aborted) return theaterError('处理网盘字幕超时，请重试或手动选择。', 504)
    return theaterRequestError(error)
  }
}

async function manageJob(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return theaterError('登录已过期，请重新登录。', 401)
  if (!isAdminRequestUser(user)) return theaterError('需要管理员权限。', 403)
  const query = new URL(request.url).searchParams
  const id = query.get('id')
  if (!validTheaterId(id)) return theaterError('这项字幕任务不存在。', 404)
  try {
    const account = await getBaiduAccountContext()
    if (query.get('generation') !== account.generation) throw Error('baidu_account_changed')
    const result = await readTheaterSubtitleJob(account, id, request.method === 'PATCH')
    return result ? NextResponse.json(result, { headers: theaterPrivateHeaders })
      : theaterError('这项字幕任务不存在。', 404)
  } catch (error) {
    return theaterRequestError(error)
  }
}

export const GET = manageJob
export const PATCH = manageJob
