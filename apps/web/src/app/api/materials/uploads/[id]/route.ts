import { uploadRoute } from '@/lib/material-route'
import { queryUpload } from '@/lib/baidu-material-upload'
type Params = { params: Promise<{ id: string }> }
export async function GET(req: Request, { params }: Params) {
  return uploadRoute(req, async (user) => queryUpload((await params).id, user))
}
export async function DELETE(req: Request, { params }: Params) {
  return uploadRoute(req, async (user) => queryUpload((await params).id, user, true))
}
