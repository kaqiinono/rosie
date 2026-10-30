import { NextResponse } from 'next/server'
import { createAdminSupabase, getUserFromRequest, unauthorizedResponse } from '@/lib/api-auth'
import { getBaiduAccountContext } from '@/lib/baidu-token'
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req)
  if (!user) return unauthorizedResponse()
  try {
    const { id } = await params
    const account = await getBaiduAccountContext()
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
    const { account_id: _account, account_generation: _generation, ...safe } = data
    void _account
    void _generation
    return NextResponse.json(
      {
        ...safe,
        relative_path: safe.path
          .slice(
            (
              {
                english: '/airosie/english',
                chinese: '/airosie/chinese',
                math: '/airosie/math',
              } as Record<string, string>
            )[safe.root_id].length,
          )
          .replace(/^\//, ''),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return NextResponse.json(
      { error: 'scan_unavailable' },
      { status: 409, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
