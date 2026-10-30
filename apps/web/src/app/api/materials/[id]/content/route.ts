import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, getBearerToken, createAuthedSupabase } from '@/lib/api-auth'
import { getBaiduAccountContext } from '@/lib/baidu-token'
import {
  materialPrivateHeaders,
  materialRange,
  deliverMaterialStream,
  openProviderFile,
} from '@/lib/baidu-material-delivery'
export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = getBearerToken(req) ?? req.cookies.get('rosie_material_session')?.value
  const auth = new Request(req.url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  const user = await getUserFromRequest(auth)
  if (!user || !token)
    return NextResponse.json(
      { error: 'unauthorized' },
      { status: 401, headers: materialPrivateHeaders },
    )
  const { data: a, error } = await createAuthedSupabase(token)
    .from('material_assets')
    .select('*')
    .eq('id', (await params).id)
    .maybeSingle()
  if (error || !a)
    return NextResponse.json(
      { error: 'not_found' },
      { status: 404, headers: materialPrivateHeaders },
    )
  if (a.source !== 'baidu' || !['ready', 'archived'].includes(a.status))
    return NextResponse.json(
      { error: 'not_ready' },
      { status: 409, headers: materialPrivateHeaders },
    )
  let range
  try {
    range = materialRange(req.headers.get('range'), a.size)
  } catch {
    return new Response(null, {
      status: 416,
      headers: { ...materialPrivateHeaders, 'Content-Range': `bytes */${a.size}` },
    })
  }
  try {
    const c = await getBaiduAccountContext()
    if (c.accountId !== a.account_id) throw Error('account_changed')
    const upstream = await openProviderFile(c, a.fs_id, a.size, range, req.signal)
    const current = await getBaiduAccountContext()
    if (current.accountId !== c.accountId || current.generation !== c.generation) {
      await upstream.body?.cancel()
      throw Error('account_changed')
    }
    return deliverMaterialStream(
      upstream,
      a.size,
      range,
      a.mime_type,
      a.title,
      req.nextUrl.searchParams.get('download') === '1',
    )
  } catch {
    return NextResponse.json(
      { error: 'material_delivery_unavailable' },
      { status: 502, headers: materialPrivateHeaders },
    )
  }
}
