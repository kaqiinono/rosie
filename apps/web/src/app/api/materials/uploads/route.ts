import { uploadRoute } from '@/lib/material-route'
import { initUpload } from '@/lib/baidu-material-upload'
export const runtime = 'nodejs'
export const maxDuration = 300
export async function POST(req: Request) {
  return uploadRoute(req, async (user) => {
    const text = await req.text()
    if (text.length > 100000) throw Error('invalid_upload_manifest')
    return initUpload(JSON.parse(text), user)
  })
}
