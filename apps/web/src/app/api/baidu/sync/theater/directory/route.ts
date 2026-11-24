import { NextResponse } from 'next/server'
import { getUserFromRequest, isAdminRequestUser } from '@/lib/api-auth'
import { getBaiduAccountContext } from '@/lib/baidu-token'
import {
  readTheaterMediaDirectory, saveTheaterMediaDirectory, theaterError, theaterPrivateHeaders, theaterRequestError,
} from '@/lib/baidu-theater'
import { validTheaterId, type TheaterMediaDirectorySettings } from '@/lib/theater/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function mediaDirectory(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return theaterError('登录已过期，请重新登录。', 401)
  if (!isAdminRequestUser(user)) return theaterError('需要管理员权限。', 403)

  try {
    const account = await getBaiduAccountContext()
    const generation = new URL(request.url).searchParams.get('generation')
    if (account.generation !== generation) throw Error('baidu_account_changed')
    if (request.method === 'GET') {
      const directory = await readTheaterMediaDirectory(account)
      return NextResponse.json({ directory } satisfies TheaterMediaDirectorySettings, { headers: theaterPrivateHeaders })
    }
    const input = await request.json().catch(() => null)
    if (!input || !validTheaterId(input.directoryId) || (input.revision !== null && !validTheaterId(input.revision)))
      return theaterError('请选择有效的授权目录。', 400)
    const directory = await saveTheaterMediaDirectory(account, input.directoryId, input.revision, request.signal)
    return NextResponse.json(directory, { headers: theaterPrivateHeaders })
  } catch (error) {
    return theaterRequestError(error)
  }
}

export const GET = mediaDirectory
export const PUT = mediaDirectory
