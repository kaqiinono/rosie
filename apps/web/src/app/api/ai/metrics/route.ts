import {
  createAdminSupabase,
  forbiddenResponse,
  isAdminRequestUser,
  unauthorizedResponse,
  getUserFromRequest,
} from '@/lib/api-auth'
import { aggregateAiQualityMetrics } from '@rosie/ai'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return unauthorizedResponse()
  if (!isAdminRequestUser(user)) return forbiddenResponse()

  const rawDays = Number(new URL(req.url).searchParams.get('days') ?? 7)
  const days = Number.isInteger(rawDays) && rawDays >= 1 && rawDays <= 90 ? rawDays : 7
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const supabase = createAdminSupabase()
  const [conversations, sessions] = await Promise.all([
    supabase.from('ai_conversations').select('role,sources').gte('created_at', since).limit(10_000),
    supabase
      .from('ai_teaching_sessions')
      .select('subject,status,hint_level,attempt_count,state')
      .gte('created_at', since)
      .limit(10_000),
  ])
  if (conversations.error || sessions.error) {
    return Response.json(
      { error: conversations.error?.message ?? sessions.error?.message ?? 'metrics_failed' },
      { status: 500 },
    )
  }
  return Response.json(
    {
      days,
      generatedAt: new Date().toISOString(),
      metrics: aggregateAiQualityMetrics(conversations.data ?? [], sessions.data ?? []),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
