import { uploadRoute } from '@/lib/material-route'
import { completeUpload } from '@/lib/baidu-material-upload'
export const runtime = 'nodejs'
export const maxDuration = 300
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return uploadRoute(req, async (user) => completeUpload((await params).id, user))
}
