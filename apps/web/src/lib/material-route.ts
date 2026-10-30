import { NextResponse } from 'next/server'
import { getUserFromRequest } from './api-auth'
export const privateHeaders = { 'Cache-Control': 'private, no-store' }
export async function uploadRoute(req: Request, operation: (user: string) => Promise<unknown>) {
  const user = await getUserFromRequest(req)
  if (!user)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: privateHeaders })
  try {
    return NextResponse.json(await operation(user.id), { headers: privateHeaders })
  } catch (e) {
    const message = e instanceof Error ? e.message : ''
    const error =
      message.startsWith('configure_') ||
      message === 'upload_limit_configuration' ||
      message === 'invalid_upload_manifest'
        ? message
        : 'upload_unavailable_check_session_account_and_app_write_permission'
    return NextResponse.json({ error }, { status: 409, headers: privateHeaders })
  }
}
