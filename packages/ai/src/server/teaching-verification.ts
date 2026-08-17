import type { SupabaseClient } from '@supabase/supabase-js'
import type { TeachingSessionState } from '../types'
import { getTeachingSession, TeachingSessionError } from './teaching-session-store'

export type TeachingEvidenceTarget =
  | { kind: 'english_word'; entryId: string }
  | { kind: 'math_problem'; problemId: string }
  | { kind: 'chinese_char'; charKey: string }
  | { kind: 'chinese_lesson'; lessonKey: string }

export interface TeachingVerificationResult {
  verified: boolean
  reason: 'verified' | 'no_content_ref' | 'unsupported_content' | 'no_new_evidence'
  session: TeachingSessionState
}

export function resolveTeachingEvidenceTarget(sourceRef?: string): TeachingEvidenceTarget | null {
  if (!sourceRef) return null
  if (sourceRef.startsWith('word_entries:')) {
    return { kind: 'english_word', entryId: sourceRef.slice('word_entries:'.length) }
  }
  if (sourceRef.startsWith('math:problem:')) {
    return { kind: 'math_problem', problemId: sourceRef.slice('math:problem:'.length) }
  }
  if (sourceRef.startsWith('chinese_char_entries:')) {
    return { kind: 'chinese_char', charKey: sourceRef.slice('chinese_char_entries:'.length) }
  }
  if (sourceRef.startsWith('chinese_lessons:')) {
    return { kind: 'chinese_lesson', lessonKey: sourceRef.slice('chinese_lessons:'.length) }
  }
  const chineseLesson = sourceRef.match(/^chinese:(?:lesson|passage):[^:]+:(.+)$/)
  return chineseLesson ? { kind: 'chinese_lesson', lessonKey: chineseLesson[1]! } : null
}

async function hasVerifiedEvidence(
  supabase: SupabaseClient,
  userId: string,
  target: TeachingEvidenceTarget,
  since: string,
): Promise<boolean> {
  if (target.kind === 'math_problem') {
    const result = await supabase
      .from('math_practice_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('problem_id', target.problemId)
      .eq('correct', true)
      .eq('status', 'completed')
      .eq('record_origin', 'native')
      .gte('attempted_at', since)
    if (result.error) throw result.error
    return (result.count ?? 0) > 0
  }

  if (target.kind === 'chinese_char') {
    const result = await supabase
      .from('chinese_char_mastery')
      .select('char_key', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('char_key', target.charKey)
      .gt('correct', 0)
      .gte('updated_at', since)
    if (result.error) throw result.error
    return (result.count ?? 0) > 0
  }

  if (target.kind === 'chinese_lesson') {
    const result = await supabase
      .from('chinese_roadmap_plan_lesson_runs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('lesson_key', target.lessonKey)
      .eq('completed', true)
      .gte('finished_at', since)
    if (result.error) throw result.error
    return (result.count ?? 0) > 0
  }

  const entry = await supabase
    .from('word_entries')
    .select('unit,lesson,word')
    .eq('id', target.entryId)
    .maybeSingle()
  if (entry.error) throw entry.error
  if (!entry.data) return false
  const wordKey = `${entry.data.unit}::${entry.data.lesson}::${entry.data.word}`
  const result = await supabase
    .from('word_mastery')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('word_key', wordKey)
    .gt('correct', 0)
    .gte('updated_at', since)
  if (result.error) throw result.error
  return (result.count ?? 0) > 0
}

export async function verifyTeachingSessionEvidence(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<TeachingVerificationResult> {
  const session = await getTeachingSession(supabase, userId, sessionId)
  if (!session.contentRef) return { verified: false, reason: 'no_content_ref', session }
  const target = resolveTeachingEvidenceTarget(session.contentRef)
  if (!target) return { verified: false, reason: 'unsupported_content', session }
  const verified = await hasVerifiedEvidence(supabase, userId, target, session.createdAt)
  if (!verified) return { verified: false, reason: 'no_new_evidence', session }

  const verifiedAt = new Date().toISOString()
  const updated = await supabase
    .from('ai_teaching_sessions')
    .update({
      teaching_stage: 'summary',
      status: 'completed',
      completed_at: verifiedAt,
      updated_at: verifiedAt,
      state: {
        ...session.state,
        completion: { kind: 'verified', completedAt: verifiedAt },
        verification: { kind: target.kind, verifiedAt },
      },
    })
    .eq('id', session.id)
    .eq('user_id', userId)
    .eq('updated_at', session.updatedAt)
    .select('id')
    .maybeSingle()
  if (updated.error) throw new TeachingSessionError('teaching_session_write_failed')
  if (!updated.data) throw new TeachingSessionError('teaching_session_conflict')
  const completed = await getTeachingSession(supabase, userId, session.id)
  return { verified: true, reason: 'verified', session: completed }
}
