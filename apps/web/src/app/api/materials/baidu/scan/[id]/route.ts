import { NextResponse } from 'next/server'
import { createAdminSupabase, getUserFromRequest, unauthorizedResponse } from '@/lib/api-auth'
import { getBaiduAccountContext } from '@/lib/baidu-token'
import { materialScanPage, MATERIAL_RESPONSE_BYTE_LIMIT } from '@/lib/baidu-material-page'
import { materialRoots, type ScanState } from '@/lib/baidu-material-catalog'
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req)
  if (!user) return unauthorizedResponse()
  try {
    const { id } = await params,
      account = await getBaiduAccountContext()
    const { data, error } = await createAdminSupabase()
      .from('material_scan_sessions')
      .select('id,root_id,path,recursive,subject,revision,state,account_id,account_generation')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (
      error ||
      !data ||
      data.account_id !== account.accountId ||
      data.account_generation !== account.generation
    )
      throw Error('scan_unavailable')
    const query = new URL(req.url).searchParams
    const offset = Number(query.get('offset') ?? '0')
    if (
      (offset > 0 && !query.has('revision')) ||
      (query.has('revision') && query.get('revision') !== String(data.revision))
    )
      throw Error('scan_revision_stale')
    const page = materialScanPage(data.id, data.state as ScanState, data.revision, offset)
    const body = {
      ...page,
      rootId: data.root_id,
      relativePath: data.path
        .slice(materialRoots[data.root_id as keyof typeof materialRoots].length)
        .replace(/^\//, ''),
      recursive: data.recursive,
      subject: data.subject,
    }
    if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MATERIAL_RESPONSE_BYTE_LIMIT)
      throw Error('scan_metadata_too_large')
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json(
      { error: 'scan_unavailable' },
      { status: 409, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
