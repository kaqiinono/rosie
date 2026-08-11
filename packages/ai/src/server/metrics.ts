import type { AiSubject } from '../types'

export interface AiConversationMetricRow {
  role: string
  sources: unknown
}

export interface AiTeachingMetricRow {
  subject: AiSubject
  status: string
  hint_level: number
  attempt_count: number
  state: unknown
}

export interface AiQualityMetrics {
  assistantResponses: number
  knowledgeHitRate: number
  noSourceRate: number
  teachingSessions: number
  teachingCompletionRate: number
  verifiedSessions: number
  averageHintLevel: number
  averageAttempts: number
  bySubject: Record<AiSubject, { sessions: number; completed: number; verified: number }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function aggregateAiQualityMetrics(
  conversations: AiConversationMetricRow[],
  sessions: AiTeachingMetricRow[],
): AiQualityMetrics {
  const assistant = conversations.filter((row) => row.role === 'assistant')
  const knowledgeHits = assistant.filter(
    (row) => Array.isArray(row.sources) && row.sources.length > 0,
  ).length
  const bySubject: AiQualityMetrics['bySubject'] = {
    english: { sessions: 0, completed: 0, verified: 0 },
    math: { sessions: 0, completed: 0, verified: 0 },
    chinese: { sessions: 0, completed: 0, verified: 0 },
  }
  let completed = 0
  let verified = 0
  let hintTotal = 0
  let attemptTotal = 0
  for (const row of sessions) {
    const subject = bySubject[row.subject]
    subject.sessions += 1
    hintTotal += row.hint_level
    attemptTotal += row.attempt_count
    if (row.status === 'completed') {
      completed += 1
      subject.completed += 1
    }
    if (isRecord(row.state) && isRecord(row.state.verification)) {
      verified += 1
      subject.verified += 1
    }
  }
  const responseCount = assistant.length
  const sessionCount = sessions.length
  return {
    assistantResponses: responseCount,
    knowledgeHitRate: responseCount ? knowledgeHits / responseCount : 0,
    noSourceRate: responseCount ? (responseCount - knowledgeHits) / responseCount : 0,
    teachingSessions: sessionCount,
    teachingCompletionRate: sessionCount ? completed / sessionCount : 0,
    verifiedSessions: verified,
    averageHintLevel: sessionCount ? hintTotal / sessionCount : 0,
    averageAttempts: sessionCount ? attemptTotal / sessionCount : 0,
    bySubject,
  }
}
