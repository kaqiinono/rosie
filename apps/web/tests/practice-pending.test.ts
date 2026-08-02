import { describe, it, expect, beforeEach } from 'vitest'
import {
  clearLocalPending,
  countLocalPendingSessions,
  getTodayPlanSyncStatus,
  isPendingUnsynced,
  markLocalPendingSynced,
  mirrorResolvedPending,
  practicePendingLocalKey,
  readLocalPending,
  todayStr,
  writeLocalPending,
  type PracticePendingEnvelope,
} from '../../../packages/core/src/index'

const TODAY = todayStr()

function envelope<T>(stash: T, savedAt = new Date().toISOString()): PracticePendingEnvelope<T> {
  return { version: 1, savedAt, date: TODAY, stash }
}

beforeEach(() => {
  localStorage.clear()
})

describe('practice pending — local envelopes', () => {
  it('a fresh local write is always unsynced until marked', () => {
    const env = envelope({ idx: 1 })
    writeLocalPending('calc', 'daily', env)

    const read = readLocalPending<{ idx: number }>('calc', 'daily')
    expect(read).not.toBeNull()
    expect(isPendingUnsynced(read!)).toBe(true)

    markLocalPendingSynced('calc', 'daily', env.savedAt)
    expect(isPendingUnsynced(readLocalPending('calc', 'daily')!)).toBe(false)

    // Any newer local revision drops back to unsynced.
    writeLocalPending('calc', 'daily', envelope({ idx: 2 }))
    expect(isPendingUnsynced(readLocalPending('calc', 'daily')!)).toBe(true)
  })

  it('discards and removes envelopes from a previous day', () => {
    const key = practicePendingLocalKey('math', 'active-queue')
    localStorage.setItem(
      key,
      JSON.stringify({ version: 1, savedAt: new Date().toISOString(), date: '2020-01-01', stash: {} }),
    )
    expect(readLocalPending('math', 'active-queue')).toBeNull()
    expect(localStorage.getItem(key)).toBeNull()
  })

  it('counts same-day pending sessions and their unsynced subset', () => {
    const a = envelope({ n: 1 })
    const b = envelope({ n: 2 })
    writeLocalPending('calc', 'daily', a)
    writeLocalPending('chinese', 'g1b|u=1', b)
    markLocalPendingSynced('calc', 'daily', a.savedAt)

    expect(countLocalPendingSessions()).toEqual({ total: 2, unsynced: 1 })
  })

  it('maps kinds onto today-plan subjects, english aggregating weekly + adaptive', () => {
    const adaptive = envelope({ n: 1 })
    writeLocalPending('english_adaptive', 'plan-1', adaptive)
    markLocalPendingSynced('english_adaptive', 'plan-1', adaptive.savedAt)
    writeLocalPending('english_weekly', 'plan-2', envelope({ n: 2 }))
    writeLocalPending('math', 'active-queue', envelope({ n: 3 }))

    const status = getTodayPlanSyncStatus()
    // One english slot is synced and one is not — the card must warn.
    expect(status.english).toBe('unsynced')
    expect(status.math).toBe('unsynced')
    expect(status.calc).toBe('none')
    expect(status.chinese).toBe('none')
  })

  it('treats a local evening timestamp as today, not as tomorrow (UTC-offset guard)', () => {
    // 23:30 local on `TODAY`. Its ISO string rolls into the next UTC day for any
    // timezone west of UTC, which must not hide the session from the sync badge.
    const [y, m, d] = TODAY.split('-').map(Number)
    const lateTonight = new Date(y, m - 1, d, 23, 30, 0).toISOString()
    localStorage.setItem(`weekly_session_plan-9`, JSON.stringify({ savedAt: lateTonight }))

    expect(countLocalPendingSessions()).toEqual({ total: 1, unsynced: 1 })
    expect(getTodayPlanSyncStatus().english).toBe('unsynced')
  })

  it('mirroring a resolved snapshot keeps its synced state', () => {
    const cloudWinner = { ...envelope({ n: 1 }) }
    mirrorResolvedPending('calc', 'daily', { ...cloudWinner, syncedAt: cloudWinner.savedAt })
    expect(countLocalPendingSessions()).toEqual({ total: 1, unsynced: 0 })

    const localOnly = envelope({ n: 2 })
    mirrorResolvedPending('math', 'active-queue', localOnly)
    expect(countLocalPendingSessions()).toEqual({ total: 2, unsynced: 1 })
  })

  it('clearing an english_weekly scope removes the legacy stash and marker too', () => {
    writeLocalPending('english_weekly', 'plan-3', envelope({ n: 1 }))
    localStorage.setItem('weekly_session_plan-3', JSON.stringify({ savedAt: new Date().toISOString() }))
    localStorage.setItem('weekly_session_synced_plan-3', new Date().toISOString())

    clearLocalPending('english_weekly', 'plan-3')

    expect(localStorage.getItem(practicePendingLocalKey('english_weekly', 'plan-3'))).toBeNull()
    expect(localStorage.getItem('weekly_session_plan-3')).toBeNull()
    expect(localStorage.getItem('weekly_session_synced_plan-3')).toBeNull()
    expect(countLocalPendingSessions()).toEqual({ total: 0, unsynced: 0 })
  })
})
