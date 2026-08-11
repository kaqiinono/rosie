import { NextResponse } from 'next/server'
import { loadStudentProfile } from '@rosie/ai'
import {
  createAuthedSupabase,
  getBearerToken,
  getUserFromRequest,
  unauthorizedResponse,
} from '@/lib/api-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  const token = getBearerToken(req)
  if (!user || !token) return unauthorizedResponse()

  try {
    const profile = await loadStudentProfile(createAuthedSupabase(token), user.id)
    return NextResponse.json(profile, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'student_profile_error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
