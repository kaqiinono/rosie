import { uploadRoute } from '@/lib/material-route'
import { prepareUpload } from '@/lib/baidu-material-upload'
export const runtime = 'nodejs'
export const maxDuration = 300
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return uploadRoute(req, async (user) => prepareUpload((await params).id, user))
}
