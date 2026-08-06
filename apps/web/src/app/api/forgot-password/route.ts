import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let adminClient: SupabaseClient | null = null

function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    }
    adminClient = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  }
  return adminClient
}

// Generic error to prevent user enumeration
const GENERIC_ERROR = { error: '用户名或恢复邮箱不正确' }

export async function POST(req: NextRequest) {
  let username: string
  let recoveryEmail: string

  try {
    const body = await req.json()
    username = body.username
    recoveryEmail = body.recoveryEmail
  } catch {
    return NextResponse.json({ error: '请填写用户名和恢复邮箱' }, { status: 400 })
  }

  if (!username || !recoveryEmail) {
    return NextResponse.json({ error: '请填写用户名和恢复邮箱' }, { status: 400 })
  }

  const fakeEmail = `${username.trim().toLowerCase()}@rosie.app`

  // Find the user by fake email
  const { data: { users }, error: listError } = await getAdminClient().auth.admin.listUsers()
  if (listError) {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }

  const user = users.find(u => u.email === fakeEmail)
  if (!user) {
    // Use same status/message as email mismatch to prevent enumeration
    return NextResponse.json(GENERIC_ERROR, { status: 403 })
  }

  // Verify recovery email matches
  const storedRecovery = user.user_metadata?.recovery_email as string | undefined
  if (!storedRecovery || storedRecovery.toLowerCase() !== recoveryEmail.trim().toLowerCase()) {
    return NextResponse.json(GENERIC_ERROR, { status: 403 })
  }

  // Generate a password reset link
  const origin = req.headers.get('origin') ?? ''
  const { data, error: linkError } = await getAdminClient().auth.admin.generateLink({
    type: 'recovery',
    email: fakeEmail,
    options: { redirectTo: `${origin}/auth/reset` },
  })

  if (linkError || !data.properties?.action_link) {
    return NextResponse.json({ error: '生成重置链接失败' }, { status: 500 })
  }

  return NextResponse.json({ actionLink: data.properties.action_link })
}
