import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/api-auth'
import { getBaiduAccountContext } from '@/lib/baidu-token'
import { BAIDU_VIDEO_COOKIE } from '@/lib/baidu-math-video'
import { lessonDirectory } from '@/lib/baidu-lesson-directory'
import { readBaiduDirectoryPage } from '@/lib/baidu-directory-page'
import { exactBaiduId } from '@/lib/baidu-identity'
import { fetchBaiduFileById } from '@/lib/baidu-media'
import { validVideoLessonKey } from '@/lib/baidu-math-video-catalog'
import { materialType } from '@rosie/math-kit/utils/lesson-material'

const headers = { 'Cache-Control': 'private, no-store' }
const fail = (status: number) => new Response(null, { status, headers })
const safeName = (s: string) => !!s && s !== '.' && s !== '..' && !/[/\\\u0000-\u001f]/.test(s)

export async function GET(req: NextRequest) {
  const token = req.cookies.get(BAIDU_VIDEO_COOKIE)?.value
  if (!token || !await getUserFromRequest(new Request(req.url, { headers: { Authorization: 'Bearer ' + token } }))) return fail(401)
  const params = req.nextUrl.searchParams
  const lesson = params.get('lesson')
  const parts = params.getAll('dir')
  if (!validVideoLessonKey(lesson) || !parts.every(safeName)) return fail(400)
  try {
    const account = await getBaiduAccountContext()
    const root = await lessonDirectory(lesson, account.accountId)
    if (!root) return fail(404)
    const dir = [root.replace(/\/$/, ''), ...parts].join('/') || '/'
    const prefix = dir === '/' ? '/' : dir + '/'
    const id = params.get('id')
    if (id !== null) {
      const name = params.get('name') ?? ''
      if (!safeName(name) || !/^[1-9]\d{0,19}$/.test(id)) return fail(400)
      const range = req.headers.get('range')
      if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return fail(416)
      const upstream = await fetchBaiduFileById(id, dir, range, req.signal, 'material', account.accessToken, prefix + name)
      if (!upstream) return fail(404)
      const mime = materialType(name)
      const disposition = mime === 'application/octet-stream' || params.has('download') ? 'attachment' : 'inline'
      const out = new Headers({ ...headers, 'Content-Type': mime, 'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'self'", 'Content-Disposition': disposition + "; filename*=UTF-8''" + encodeURIComponent(name).replace(/'/g,'%27') })
      for (const key of ['content-length','content-range','accept-ranges']) {
        const value = upstream.headers.get(key)
        if (value) out.set(key, value)
      }
      return new Response(upstream.body, { status: upstream.status, headers: out })
    }
    const start = Number(params.get('start') ?? 0)
    if (!Number.isSafeInteger(start) || start < 0) return fail(400)
    const rows = await readBaiduDirectoryPage(account.accessToken, dir, start, 100)
    const files = rows.flatMap(row => {
      if (typeof row.path !== 'string' || !row.path.startsWith(prefix)) return []
      const name = row.path.slice(prefix.length)
      if (!safeName(name) || (row.isdir !== 1 && row.isdir !== 0)) return []
      return [{ name, id: exactBaiduId(row.fs_id), directory: row.isdir === 1 }]
    })
    return NextResponse.json({ files, next: rows.length === 100 ? start + 100 : null }, { headers })
  } catch { return fail(503) }
}
