import { NextResponse } from 'next/server'
import { getUserFromRequest, isAdminRequestUser } from '@/lib/api-auth'
import { getBaiduAccountContext } from '@/lib/baidu-token'
import {
  attachTheaterPlaybackCopy, readTheaterAdminCatalog, readTheaterDirectoryInventory, saveTheaterFilm,
  setTheaterPublication, theaterError,
  theaterPrivateHeaders, theaterRequestError,
} from '@/lib/baidu-theater'
import { validTheaterId } from '@/lib/theater/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const validFileId = (value: unknown): value is string => typeof value === 'string' && /^[1-9][0-9]{0,19}$/.test(value)

async function manageTheater(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return theaterError('登录已过期，请重新登录。', 401)
  if (!isAdminRequestUser(user)) return theaterError('需要管理员权限。', 403)
  try {
    const account = await getBaiduAccountContext()
    const query = new URL(request.url).searchParams
    if (query.get('generation') !== account.generation) throw Error('baidu_account_changed')
    if (request.method !== 'GET') {
      const input = await request.json().catch(() => null)
      if (!input || typeof input !== 'object' || Array.isArray(input)) return theaterError('请求信息有误。', 400)
      if (request.method === 'POST') {
        const title = typeof input.title === 'string' ? input.title.trim() : ''
        const { directoryId, videoId, enId, zhId } = input
        if (!title || title.length > 120 || !validTheaterId(directoryId) || !validFileId(videoId) ||
            (enId !== null && !validFileId(enId)) || (zhId !== null && !validFileId(zhId)) || enId === zhId)
          return theaterError('请填写片名并选择视频和至少一份字幕。', 400)
        await saveTheaterFilm(account, { title, directoryId, videoId, enId, zhId }, request.signal)
        return new Response(null, { status: 204, headers: theaterPrivateHeaders })
      }
      if (!validTheaterId(input.id) || !validTheaterId(input.revision))
        return theaterError('影片信息有误，请重新读取片库。', 400)
      if (request.method === 'PATCH') {
        await attachTheaterPlaybackCopy(account, input.id, input.revision)
        return new Response(null, { status: 204, headers: theaterPrivateHeaders })
      }
      if (typeof input.published !== 'boolean') return theaterError('影片上架状态有误。', 400)
      await setTheaterPublication(account, input.id, input.revision, input.published)
      return new Response(null, { status: 204, headers: theaterPrivateHeaders })
    }
    const directoryId = query.get('directoryId')
    if (directoryId !== null) {
      if (!validTheaterId(directoryId)) return theaterError('请选择已授权的影片目录。', 400)
      const timeout = AbortSignal.timeout(45_000)
      try {
        const inventory = await readTheaterDirectoryInventory(account, directoryId,
          AbortSignal.any([request.signal, timeout]))
        return NextResponse.json(inventory, { headers: theaterPrivateHeaders })
      } catch (error) {
        if (timeout.aborted) return theaterError('扫描影片目录及子目录超时，请重试或选择范围更小的目录。', 504)
        throw error
      }
    }
    return NextResponse.json(await readTheaterAdminCatalog(account), { headers: theaterPrivateHeaders })
  } catch (error) {
    return theaterRequestError(error)
  }
}

export const GET = manageTheater
export const POST = manageTheater
export const PUT = manageTheater
export const PATCH = manageTheater
