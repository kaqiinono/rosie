// @vitest-environment node

import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { parseExamReflectionCommand, readExamReflections, saveExamReflection } from '../src/lib/exams/reflections'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/api-auth', () => ({ getUserFromRequest: vi.fn(), isAdminRequestUser: vi.fn() }))

const userId = '10000000-0000-4000-8000-000000000001'
const attemptId = '20000000-0000-4000-8000-000000000002'
const requestId = '30000000-0000-4000-8000-000000000003'
const version = '40000000-0000-4000-8000-000000000004'
const questionId = 'synthetic:test-1:exam:reading_writing:part-1:1'
const command = { requestId, questionId, expectedVersion: null, reason: 'unsure' }

describe('optional exam reflections (synthetic mocks, no database)', () => {
  it('accepts exactly the five learner choices and an explicit clear', () => {
    for (const reason of ['unknown_word', 'unclear_audio', 'spelling', 'misunderstood_question', 'unsure', null]) {
      expect(parseExamReflectionCommand({ ...command, reason })).toMatchObject({ questionId, reason, expectedVersion: null })
    }
    expect(parseExamReflectionCommand({ ...command, expectedVersion: version }).expectedVersion).toBe(version)
  })

  it('rejects inferred tags, missing CAS fields, owner overrides and extra answer payloads', () => {
    const invalid = [
      { ...command, reason: 'grammar-tag' }, { ...command, reason: '' }, { ...command, expectedVersion: 'not-a-version' },
      { requestId, questionId, reason: null }, { ...command, userId }, { ...command, ownerId: userId },
      { ...command, answer: 'do not accept an answer here' }, { ...command, score: 0 },
    ]
    for (const value of invalid) expect(() => parseExamReflectionCommand(value)).toThrow()
  })

  it('passes only the authenticated owner and exact reflection command to the service RPC', async () => {
    const saved = { questionId, reason: 'unsure', version }
    const rpc = vi.fn().mockResolvedValue({ data: saved, error: null })
    const db = { rpc } as unknown as SupabaseClient
    expect(await saveExamReflection(db, userId, attemptId, parseExamReflectionCommand(command))).toEqual(saved)
    expect(rpc).toHaveBeenCalledWith('save_exam_reflection', {
      p_user: userId, p_attempt_id: attemptId, p_request_id: requestId, p_question_id: questionId,
      p_expected_version: null, p_reason: 'unsure',
    })
  })

  it('retains the current clear/version returned for an acknowledged older retry', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { questionId, reason: null, version }, error: null })
    const saved = await saveExamReflection({ rpc } as unknown as SupabaseClient, userId, attemptId, parseExamReflectionCommand(command))
    expect(saved).toEqual({ questionId, reason: null, version })
  })

  it('distinguishes version conflicts from unsubmitted/example scope denial', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'exam_conflict' } })
    const db = { rpc } as unknown as SupabaseClient
    await expect(saveExamReflection(db, userId, attemptId, parseExamReflectionCommand(command))).rejects.toMatchObject({ code: 'exam_conflict', status: 409 })
    rpc.mockResolvedValue({ data: null, error: { message: 'exam_reflection_unavailable' } })
    await expect(saveExamReflection(db, userId, attemptId, parseExamReflectionCommand(command))).rejects.toMatchObject({ code: 'exam_reflection_unavailable', status: 403 })
  })

  it('reads an owner-scoped attempt list and does not disguise storage errors as an empty list', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { items: [{ questionId, reason: null, version }] }, error: null })
    const db = { rpc } as unknown as SupabaseClient
    expect(await readExamReflections(db, userId, attemptId)).toEqual({ items: [{ questionId, reason: null, version }] })
    expect(rpc).toHaveBeenCalledWith('read_exam_reflections', { p_user: userId, p_attempt_id: attemptId })
    rpc.mockResolvedValue({ data: null, error: { message: 'raw internal database detail' } })
    await expect(readExamReflections(db, userId, attemptId)).rejects.toMatchObject({ code: 'exam_unavailable', status: 503 })
  })
})
