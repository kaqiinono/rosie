import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PetAnswer, PetSession, PetSessionAction } from '../../../packages/english/src/pet/types'
import { petSessionStates, usePetSessionActions } from '../../../packages/english/src/pet/usePetSessionActions'

vi.mock('@rosie/core', () => ({
  STORAGE_KEYS: { PET_PENDING_SESSION: 'pet-pending-session' },
}))

const userId = 'learner'
const sessionId = 'pet-session'
const storageKey = `pet-pending-session:${userId}:${sessionId}`
const startedAt = '2026-11-13T04:00:00.000Z'

function answer(overrides: Partial<PetAnswer>): PetAnswer {
  return {
    firstAnswers: null,
    firstCorrect: null,
    usedHelp: false,
    retries: [],
    skippedAudio: false,
    ...overrides,
  }
}

function session(overrides: Partial<PetSession> = {}): PetSession {
  return {
    id: sessionId,
    version: 0,
    status: 'active',
    mode: 'spelling',
    track: 'daily',
    feedbackMode: 'training',
    source: 'PET 独立拼写',
    setId: null,
    setRevision: null,
    items: [
      { id: 'first', kind: 'spelling', prompt: '______', acceptedAnswerSets: [['colour']] },
      { id: 'second', kind: 'spelling', prompt: '______', acceptedAnswerSets: [['centre']] },
    ],
    passage: null,
    wordPool: [],
    reviewWordIds: [],
    timerEnabled: false,
    answers: {},
    itemIndex: 0,
    startedAt,
    completedAt: null,
    updatedAt: startedAt,
    ...overrides,
  }
}

const unexpectedComplete = async (): Promise<PetSession> => {
  throw new Error('Unexpected completion')
}

describe('PET session restoration', () => {
  it('keeps the first wrong answer after a successful retry', () => {
    const state = petSessionStates(session({
      answers: {
        first: answer({
          firstAnswers: ['colur'],
          firstCorrect: false,
          retries: [{ answers: ['colour'], correct: true }],
        }),
      },
    }))[1]

    expect(state).toMatchObject({
      first: { values: ['colur'], correct: false, helped: false },
      values: ['colour'],
      status: 'correct',
      retries: 1,
    })
  })

  it('restores an explicitly revealed hint even when an unanswered draft exists', () => {
    const shown = answer({ draftAnswers: ['colo'], usedHelp: true, revealed: true })
    expect(petSessionStates(session({ answers: { first: shown } }))[1]).toMatchObject({
      values: ['colo'],
      helped: true,
      revealed: true,
    })
    expect(petSessionStates(session({
      answers: { first: { ...shown, revealed: false } },
    }))[1]).toMatchObject({ helped: true, revealed: false })
  })

  it('displays the last judged answer for completed training instead of an unfinished draft', () => {
    const state = petSessionStates(session({
      status: 'completed',
      completedAt: startedAt,
      answers: {
        first: answer({
          firstAnswers: ['colur'],
          firstCorrect: false,
          retries: [{ answers: ['colour'], correct: true }],
          draftAnswers: ['colo'],
        }),
      },
    }))[1]

    expect(state).toMatchObject({ values: ['colour'], status: 'correct' })
  })
})

describe('PET queued session actions', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('ignores a stale local snapshot when its action queue is empty', () => {
    localStorage.setItem(storageKey, JSON.stringify({
      sessionId,
      states: { 1: { values: ['old local value'] } },
      actions: [],
    }))
    const initial = session({
      version: 3,
      answers: { first: answer({ draftAnswers: ['new cloud value'] }) },
    })
    const save = vi.fn()
    const { result } = renderHook(() =>
      usePetSessionActions({ userId, initial, save, complete: unexpectedComplete }),
    )

    expect(result.current.states[1]?.values).toEqual(['new cloud value'])
    expect(result.current.pendingCount).toBe(0)
    expect(save).not.toHaveBeenCalled()
  })

  it('reuses the persisted action ID after an RPC failure and removes it after acknowledgement', async () => {
    const initial = session()
    const saved = session({
      version: 1,
      answers: { first: answer({ draftAnswers: ['colour'] }) },
    })
    const save = vi.fn<(current: PetSession, action: PetSessionAction) => Promise<PetSession>>()
      .mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce(saved)
    const { result } = renderHook(() =>
      usePetSessionActions({ userId, initial, save, complete: unexpectedComplete }),
    )

    act(() => result.current.enqueue({ type: 'draft', itemId: 'first', answers: ['colour'] }))
    await waitFor(() => expect(result.current.error).toBe('response lost'))
    expect(result.current.pendingCount).toBe(1)
    const firstCall = save.mock.calls[0][1]
    expect(firstCall.requestId).toEqual(expect.any(String))
    expect(JSON.parse(localStorage.getItem(storageKey) ?? 'null')).toMatchObject({
      actions: [firstCall],
    })

    await act(async () => { await result.current.flush() })

    expect(save).toHaveBeenCalledTimes(2)
    expect(save.mock.calls[1]).toEqual([initial, firstCall])
    expect(result.current.session.version).toBe(1)
    expect(result.current.pendingCount).toBe(0)
    expect(localStorage.getItem(storageKey)).toBeNull()
  })

  it('merges newer cloud answers with local state only for items with pending actions', async () => {
    const pending: PetSessionAction = {
      type: 'draft', itemId: 'first', answers: ['local draft'], requestId: 'draft-request',
    }
    localStorage.setItem(storageKey, JSON.stringify({
      sessionId,
      states: {
        1: { values: ['local draft'], first: { values: ['old answer'], correct: false, helped: false } },
        2: { values: ['stale untouched item'] },
      },
      actions: [pending],
    }))
    const initial = session({ version: 1 })
    const save = vi.fn<(current: PetSession, action: PetSessionAction) => Promise<PetSession>>()
      .mockRejectedValueOnce(new Error('offline'))
    const { result, rerender } = renderHook(({ initial }) =>
      usePetSessionActions({ userId, initial, save, complete: unexpectedComplete }),
    { initialProps: { initial } })

    await waitFor(() => expect(result.current.error).toBe('offline'))
    const cloud = session({
      version: 2,
      answers: {
        first: answer({ firstAnswers: ['colour'], firstCorrect: true }),
        second: answer({ draftAnswers: ['new cloud draft'] }),
      },
    })
    rerender({ initial: cloud })

    expect(result.current.session.version).toBe(2)
    expect(result.current.states[1]).toMatchObject({
      values: ['local draft'],
      first: { values: ['colour'], correct: true, helped: false },
    })
    expect(result.current.states[2]?.values).toEqual(['new cloud draft'])
    expect(result.current.pendingCount).toBe(1)
  })

  it('applies a newer cloud snapshot received during an in-flight save', async () => {
    const initial = session()
    const saved = session({
      version: 1,
      answers: { first: answer({ draftAnswers: ['colour'] }) },
    })
    const cloud = session({
      version: 2,
      answers: {
        ...saved.answers,
        second: answer({ firstAnswers: ['centre'], firstCorrect: true }),
      },
    })
    let resolveSave: (value: PetSession) => void = () => undefined
    const inFlight = new Promise<PetSession>((resolve) => { resolveSave = resolve })
    const save = vi.fn(() => inFlight)
    const { result, rerender } = renderHook(({ initial }) =>
      usePetSessionActions({ userId, initial, save, complete: unexpectedComplete }),
    { initialProps: { initial } })

    act(() => result.current.enqueue({ type: 'draft', itemId: 'first', answers: ['colour'] }))
    expect(save).toHaveBeenCalledTimes(1)
    rerender({ initial: cloud })
    await act(async () => {
      resolveSave(saved)
      await result.current.flush()
    })

    expect(result.current.session.version).toBe(2)
    expect(result.current.states[1]?.values).toEqual(['colour'])
    expect(result.current.states[2]).toMatchObject({
      values: ['centre'],
      first: { values: ['centre'], correct: true },
    })
    expect(result.current.pendingCount).toBe(0)
  })
})
