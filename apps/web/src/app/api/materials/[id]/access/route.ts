import { NextResponse } from 'next/server'
import { createAuthedSupabase, getBearerToken, getUserFromRequest } from '@/lib/api-auth'
import { safeMaterialHref } from '@rosie/materials'
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req)
  const token = getBearerToken(req)
  if (!user || !token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const { data, error } = await createAuthedSupabase(token)
    .from('material_assets')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  const headers = { 'Cache-Control': 'private, no-store' }
  if (error || !data) return NextResponse.json({ error: 'not_found' }, { status: 404, headers })
  if (!['ready', 'archived'].includes(data.status))
    return NextResponse.json({ error: 'not_ready' }, { status: 409, headers })
  if (data.kind === 'text') {
    if (new URL(req.url).searchParams.get('download') === '1')
      return new Response(data.text_content ?? '', {
        headers: {
          ...headers,
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': 'attachment; filename="material.txt"',
        },
      })
    return NextResponse.json({ text: data.text_content }, { headers })
  }
  const url = safeMaterialHref(data.href)
  if (url) return NextResponse.json({ url }, { headers })
  return NextResponse.json({ error: 'transport_not_available' }, { status: 409, headers })
}
