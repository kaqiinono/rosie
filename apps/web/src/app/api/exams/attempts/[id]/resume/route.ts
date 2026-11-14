import { examAttemptMutation } from '@/lib/exams/attemptRoutes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const POST = examAttemptMutation('resume')
