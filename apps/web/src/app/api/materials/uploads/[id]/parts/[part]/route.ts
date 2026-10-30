import { uploadRoute } from '@/lib/material-route'
import { uploadPart } from '@/lib/baidu-material-upload'
export const runtime = 'nodejs'
export const maxDuration = 300
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; part: string }> },
) {
  return uploadRoute(req, async (user) => {
    const { id, part } = await params
    if (!req.body || !/^\d+$/.test(part)) throw Error('invalid_upload_part')
    return uploadPart(id, user, Number(part), req.body)
  })
}
