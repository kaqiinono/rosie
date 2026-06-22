import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  const { username, recoveryEmail } = await req.json()

  if (!username || !recoveryEmail) {
    return NextResponse.json({ error: '请填写用户名和恢复邮箱' }, { status: 400 })
  }

  const fakeEmail = `${username.trim().toLowerCase()}@rosie.app`

  // Find the user by fake email
  const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers()
  if (listError) {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }

  const user = users.find(u => u.email === fakeEmail)
  if (!user) {
    return NextResponse.json({ error: '用户名不存在' }, { status: 404 })
  }

  // Verify recovery email matches
  const storedRecovery = user.user_metadata?.recovery_email as string | undefined
  if (!storedRecovery || storedRecovery.toLowerCase() !== recoveryEmail.trim().toLowerCase()) {
    return NextResponse.json({ error: '恢复邮箱不匹配' }, { status: 403 })
  }

  // Generate a password reset link
  const origin = req.headers.get('origin') ?? ''
  const { data, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: fakeEmail,
    options: { redirectTo: `${origin}/auth/reset` },
  })

  if (linkError || !data.properties?.action_link) {
    return NextResponse.json({ error: '生成重置链接失败' }, { status: 500 })
  }

  return NextResponse.json({ actionLink: data.properties.action_link })
}
