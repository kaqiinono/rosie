import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type {
  AiSubject,
  TeachingSessionState,
  TeachingSessionStatus,
  TeachingStage,
} from '../types'

const TEACHING_SELECT =
  'id,conversation_id,subject,content_ref,teaching_stage,hint_level,attempt_count,latest_answer,error_kind,state,status,created_at,updated_at,completed_at'

const uuidSchema = z.string().uuid()
const subjectSchema = z.enum(['english', 'math', 'chinese'])

export const teachingSessionStartSchema = z.object({
  subject: subjectSchema,
  conversationId: uuidSchema.optional(),
  contentRef: z.string().trim().min(1).max(300).optional(),
  state: z.record(z.unknown()).optional(),
})

export const teachingSessionActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('record_attempt'),
    answer: z.string().trim().min(1).max(2_000),
    errorKind: z.string().trim().min(1).max(100).optional(),
  }),
  z.object({ type: z.literal('request_hint') }),
  z.object({ type: z.literal('mark_correct') }),
  z.object({ type: z.literal('complete') }),
  z.object({ type: z.literal('abandon') }),
])

export type TeachingSessionStartInput = z.infer<typeof teachingSessionStartSchema>
export type TeachingSessionAction = z.infer<typeof teachingSessionActionSchema>

interface TeachingSessionRow {
  id: string
  conversation_id: string | null
  subject: AiSubject
  content_ref: string | null
  teaching_stage: TeachingStage
  hint_level: number
  attempt_count: number
  latest_answer: string | null
  error_kind: string | null
  state: Record<string, unknown>
  status: TeachingSessionStatus
  created_at: string
  updated_at: string
  completed_at: string | null
}

export class TeachingSessionError extends Error {
  constructor(
    public readonly code:
      | 'teaching_session_not_found'
      | 'teaching_session_not_active'
      | 'teaching_session_conflict'
      | 'teaching_session_write_failed',
  ) {
    super(code)
    this.name = 'TeachingSessionError'
  }
}

function optionalText(value: string | null): string | undefined {
  return value ?? undefined
}

function rowToState(row: TeachingSessionRow): TeachingSessionState {
  const hintLevel = Math.max(0, Math.min(3, row.hint_level)) as 0 | 1 | 2 | 3
  return {
    id: row.id,
    conversationId: optionalText(row.conversation_id),
    subject: row.subject,
    contentRef: optionalText(row.content_ref),
    teachingStage: row.teaching_stage,
    hintLevel,
    attemptCount: row.attempt_count,
    latestAnswer: optionalText(row.latest_answer),
    errorKind: optionalText(row.error_kind),
    state: row.state,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: optionalText(row.completed_at),
  }
}

async function findActiveTeachingSession(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  subject: AiSubject,
): Promise<TeachingSessionState | null> {
  const { data, error } = await supabase
    .from('ai_teaching_sessions')
    .select(TEACHING_SELECT)
    .eq('user_id', userId)
    .eq('conversation_id', conversationId)
    .eq('subject', subject)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw new TeachingSessionError('teaching_session_write_failed')
  return data ? rowToState(data as TeachingSessionRow) : null
}

export function transitionTeachingSession(
  current: TeachingSessionState,
  action: TeachingSessionAction,
  now = new Date().toISOString(),
): TeachingSessionState {
  if (current.status !== 'active') {
    throw new TeachingSessionError('teaching_session_not_active')
  }

  switch (action.type) {
    case 'record_attempt':
      return {
        ...current,
        teachingStage: 'check',
        attemptCount: current.attemptCount + 1,
        latestAnswer: action.answer,
        errorKind: action.errorKind,
        updatedAt: now,
      }
    case 'request_hint':
      return {
        ...current,
        teachingStage: 'hint',
        hintLevel: Math.min(3, current.hintLevel + 1) as 0 | 1 | 2 | 3,
        updatedAt: now,
      }
    case 'mark_correct':
      return {
        ...current,
        teachingStage: 'transfer',
        errorKind: undefined,
        updatedAt: now,
      }
    case 'complete':
      return {
        ...current,
        state: {
          ...current.state,
          completion: { kind: 'self_reported', completedAt: now },
        },
        teachingStage: 'summary',
        status: 'completed',
        completedAt: now,
        updatedAt: now,
      }
    case 'abandon':
      return {
        ...current,
        status: 'abandoned',
        updatedAt: now,
      }
  }
}

export function teachingCompletionKind(
  session: TeachingSessionState,
): 'verified' | 'self_reported' | null {
  const completion = session.state.completion
  if (!completion || typeof completion !== 'object') return null
  const kind = (completion as { kind?: unknown }).kind
  return kind === 'verified' || kind === 'self_reported' ? kind : null
}

export async function startTeachingSession(
  supabase: SupabaseClient,
  userId: string,
  input: TeachingSessionStartInput,
): Promise<TeachingSessionState> {
  const parsed = teachingSessionStartSchema.parse(input)
  if (parsed.conversationId) {
    const existing = await findActiveTeachingSession(
      supabase,
      userId,
      parsed.conversationId,
      parsed.subject,
    )
    if (existing) return existing
  }

  const { data, error } = await supabase
    .from('ai_teaching_sessions')
    .insert({
      user_id: userId,
      conversation_id: parsed.conversationId ?? null,
      subject: parsed.subject,
      content_ref: parsed.contentRef ?? null,
      state: parsed.state ?? {},
    })
    .select(TEACHING_SELECT)
    .single()

  if (error?.code === '23505' && parsed.conversationId) {
    const existing = await findActiveTeachingSession(
      supabase,
      userId,
      parsed.conversationId,
      parsed.subject,
    )
    if (existing) return existing
  }
  if (error || !data) throw new TeachingSessionError('teaching_session_write_failed')
  return rowToState(data as TeachingSessionRow)
}

export async function getTeachingSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<TeachingSessionState> {
  const { data, error } = await supabase
    .from('ai_teaching_sessions')
    .select(TEACHING_SELECT)
    .eq('id', uuidSchema.parse(sessionId))
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new TeachingSessionError('teaching_session_write_failed')
  if (!data) throw new TeachingSessionError('teaching_session_not_found')
  return rowToState(data as TeachingSessionRow)
}

export async function advanceTeachingSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  action: TeachingSessionAction,
): Promise<TeachingSessionState> {
  const current = await getTeachingSession(supabase, userId, sessionId)
  const parsedAction = teachingSessionActionSchema.parse(action)
  const next = transitionTeachingSession(current, parsedAction)

  const { data, error } = await supabase
    .from('ai_teaching_sessions')
    .update({
      teaching_stage: next.teachingStage,
      hint_level: next.hintLevel,
      attempt_count: next.attemptCount,
      latest_answer: next.latestAnswer ?? null,
      error_kind: next.errorKind ?? null,
      status: next.status,
      state: next.state,
      updated_at: next.updatedAt,
      completed_at: next.completedAt ?? null,
    })
    .eq('id', current.id)
    .eq('user_id', userId)
    .eq('updated_at', current.updatedAt)
    .select(TEACHING_SELECT)
    .maybeSingle()

  if (error) throw new TeachingSessionError('teaching_session_write_failed')
  if (!data) throw new TeachingSessionError('teaching_session_conflict')
  return rowToState(data as TeachingSessionRow)
}
