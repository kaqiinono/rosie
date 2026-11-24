import { NextResponse } from 'next/server'
import { getUserFromRequest, isAdminRequestUser } from '@/lib/api-auth'
import { theaterError, theaterPrivateHeaders, theaterRequestError } from '@/lib/baidu-theater'
import { readTheaterEditedSubtitles } from '@/lib/theater/theater-subtitle-revisions'
import { validTheaterId } from '@/lib/theater/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ filmId: string }> }) {
  const user = await getUserFromRequest(request)
  if (!user) return theaterError('登录已过期，请重新登录。', 401)
  const { filmId } = await params
  if (!validTheaterId(filmId)) return theaterError('影片不存在。', 404)
  try {
    const tracks = await readTheaterEditedSubtitles(filmId, request.signal)
    if (!tracks) return theaterError('影片已下架或暂不可播放。', 404)
    return NextResponse.json({ tracks, canEdit: isAdminRequestUser(user) }, { headers: theaterPrivateHeaders })
  } catch (error) {
    return theaterRequestError(error)
  }
}
