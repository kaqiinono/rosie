import { describe, expect, it } from 'vitest'
import { resolveAdaptiveCreateStatus } from '../../../packages/english/src/utils/adaptivePlanCreateStatus'

describe('resolveAdaptiveCreateStatus', () => {
  it('creates active when no active plan exists', () => {
    expect(resolveAdaptiveCreateStatus(false)).toBe('active')
  })

  it('creates paused when an active plan already exists', () => {
    expect(resolveAdaptiveCreateStatus(true)).toBe('paused')
  })
})
