import { NextResponse } from 'next/server'
import { getUserFromRequest, unauthorizedResponse } from '@/lib/api-auth'
import {
  materialRoots,
  scanMaterialDirectory,
  type ScanRequest,
} from '@/lib/baidu-material-catalog'
export const runtime = 'nodejs'
export async function GET(req: Request) {
  if (!(await getUserFromRequest(req))) return unauthorizedResponse()
  return NextResponse.json(
    { roots: Object.keys(materialRoots) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
export async function POST(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return unauthorizedResponse()
  try {
    const input = (await req.json()) as ScanRequest
    if (input.sessionId && !/^[a-f0-9-]{36}$/.test(input.sessionId)) throw Error('invalid_scan')
    return NextResponse.json(await scanMaterialDirectory(input, user.id), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json(
      { error: '目录读取未完成，请核对路径或重新授权后重试；已有文件与关联已保留。' },
      { status: 409, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
