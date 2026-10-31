import { startBaiduOAuth } from '@/lib/baidu-oauth-start'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function POST(req: Request) {
  return startBaiduOAuth(req, 'personal')
}
