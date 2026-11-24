import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/api-auth'
import { readTheaterCatalog, readTheaterFilm, theaterError, theaterPrivateHeaders, theaterRequestError } from '@/lib/baidu-theater'
import { validTheaterId } from '@/lib/theater/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!await getUserFromRequest(request)) return theaterError('登录已过期，请重新登录。', 401)
  const filmId = new URL(request.url).searchParams.get('filmId')
  try {
    if (filmId === null) return NextResponse.json(await readTheaterCatalog(), { headers: theaterPrivateHeaders })
    if (!validTheaterId(filmId)) return theaterError('这部影片不可播放。', 404)
    const film = await readTheaterFilm(filmId)
    if (!film) return theaterError('这部影片已下架或暂不可播放。', 404)
    return NextResponse.json(film, { headers: theaterPrivateHeaders })
  } catch (error) {
    return theaterRequestError(error)
  }
}
