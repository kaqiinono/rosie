import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExamSpeakingScript, MediaSlot } from '@rosie/exams'
import { ExamApiError } from './http'
import { attemptCommandHash, attemptUuid, commitAttemptState, expireAttemptIfNeeded,
  priorAttemptCommand, projectExamAttempt, readAttemptEnvelope, type AttemptEnvelope } from './attempts'

function scriptContent(current: AttemptEnvelope, partNumber: number) {
  const groupIds = new Set(current.draft.content.groups.filter(value => current.attempt.state.groupIds.includes(value.id)
    && value.sectionId === 'speaking' && value.partNumber === partNumber).map(value => value.id))
  const notes = current.draft.solutions.teacherNotes.filter(note => note.kind === 'examiner_script' && note.sectionId === 'speaking'
    && note.partNumber === partNumber && note.groupIds.length > 0 && note.groupIds.every(id => groupIds.has(id)))
  if (!notes.length) throw new ExamApiError('exam_script_unavailable', 403)
  const slots = new Set(notes.flatMap(note => note.blocks.flatMap(block => block.kind === 'image' || block.kind === 'audio' ? [block.mediaSlotId] : [])))
  const mediaSlots: MediaSlot<'parent'>[] = current.draft.solutions.mediaSlots.filter((slot): slot is MediaSlot<'parent'> => slot.audience === 'parent' && slots.has(slot.id))
  if (mediaSlots.length !== slots.size) throw new ExamApiError('exam_script_unavailable', 403)
  return { notes, mediaSlots }
}

export async function openExamSpeakingScript(db: SupabaseClient, ownerId: string, attemptId: string,
  sessionId: string, body: Record<string, unknown>): Promise<ExamSpeakingScript> {
  const requestId = attemptUuid(body.requestId)
  const expectedVersion = attemptUuid(body.expectedVersion)
  // PIN bytes never enter a request receipt/hash, attempt state, or audit.
  const hash = attemptCommandHash({ ownerId, attemptId, sessionId, expectedVersion, operation: 'script' })
  const prior = await priorAttemptCommand(db, ownerId, requestId, hash)
  let current = await expireAttemptIfNeeded(db, await readAttemptEnvelope(db, ownerId, attemptId))
  if (prior && prior !== attemptId) throw new ExamApiError('exam_conflict', 409)
  const group = current.draft.content.groups.find(value => value.id === current.attempt.state.currentGroupId)
  if (!group || group.sectionId !== 'speaking' || !current.attempt.state.groupIds.includes(group.id)
    || current.attempt.state.sections.speaking?.status !== 'active') throw new ExamApiError('exam_script_unavailable', 403)
  scriptContent(current, group.partNumber)
  if (!prior) {
    if (current.attempt.version !== expectedVersion) throw new ExamApiError('exam_conflict', 409)
    const next = { ...current.attempt.state, scriptGrant: { partNumber: group.partNumber, sessionId,
      expiresAt: new Date(Date.parse(current.serverNow) + 600_000).toISOString() } }
    await commitAttemptState(db, current, 'script', next, [], requestId, hash)
    current = await readAttemptEnvelope(db, ownerId, attemptId)
  }
  const grant = current.attempt.state.scriptGrant
  const active = current.draft.content.groups.find(value => value.id === current.attempt.state.currentGroupId)
  if (!grant || grant.sessionId !== sessionId || !active || active.sectionId !== 'speaking'
    || active.partNumber !== grant.partNumber || current.attempt.state.sections.speaking?.status !== 'active'
    || Date.parse(grant.expiresAt) <= Date.parse(current.serverNow)) throw new ExamApiError('exam_script_unavailable', 403)
  const { notes, mediaSlots } = scriptContent(current, grant.partNumber)
  return { attempt: projectExamAttempt(current), partNumber: grant.partNumber, expiresAt: grant.expiresAt, notes, mediaSlots }
}
